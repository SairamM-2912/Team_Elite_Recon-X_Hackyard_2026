"""
app/db/pg_service.py
====================
Server-side PostgreSQL connection service for RECON-X.

Credentials are read exclusively from environment variables (populated by
python-dotenv from a local .env file).  The password is never logged, never
returned in API responses, and never written to any string that might reach
the frontend.

Security rules enforced here
-----------------------------
- Only SELECT statements are permitted.
- Multiple statements (semicolons inside the query body) are rejected.
- Result rows are capped at MAX_ROWS (50).
- A per-statement timeout of STATEMENT_TIMEOUT_MS (5 000 ms) is applied via
  PostgreSQL SET LOCAL statement_timeout.
- All connection errors are sanitised before being returned to the caller —
  the raw exception message (which may contain the password in some psycopg
  builds) is inspected and the password string is redacted just in case.
"""

import os
import re
import time
import logging

import psycopg

logger = logging.getLogger(__name__)

MAX_ROWS: int = 50
STATEMENT_TIMEOUT_MS: int = 5_000   # 5 seconds
CONNECT_TIMEOUT_S: int = 5


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _redact(text: str) -> str:
    """Remove the PG password from an error string, just in case."""
    pwd = os.environ.get("PGPASSWORD", "")
    if pwd and pwd in text:
        text = text.replace(pwd, "***")
    return text


def _build_connstring() -> str:
    """Build a libpq connection string from environment variables."""
    host = os.environ.get("PGHOST", "127.0.0.1")
    port = os.environ.get("PGPORT", "5432")
    dbname = os.environ.get("PGDATABASE", "reconx_demo")
    user = os.environ.get("PGUSER", "reconx_reader")
    password = os.environ.get("PGPASSWORD", "")
    # password intentionally not logged
    return (
        f"host={host} port={port} dbname={dbname} "
        f"user={user} password={password} "
        f"connect_timeout={CONNECT_TIMEOUT_S} "
        "application_name=reconx_proxy"
    )


def _open_connection() -> psycopg.Connection:
    """Open a new psycopg3 connection.  Raises PgServiceError on failure."""
    try:
        conn = psycopg.connect(_build_connstring())
        conn.autocommit = True   # read-only; autocommit avoids idle tx
        return conn
    except Exception as exc:
        raise PgServiceError(_redact(str(exc))) from None


# ---------------------------------------------------------------------------
# Public exception
# ---------------------------------------------------------------------------

class PgServiceError(Exception):
    """Raised for all expected PostgreSQL service errors."""


# ---------------------------------------------------------------------------
# SQL safety validation
# ---------------------------------------------------------------------------

# Allowed: leading whitespace, optional trailing whitespace, case-insensitive
_SELECT_RE = re.compile(r"^\s*SELECT\b", re.IGNORECASE)


def validate_sql(sql: str) -> None:
    """
    Raise PgServiceError if *sql* is not a safe, single SELECT statement.

    Checks performed
    ----------------
    1. Must start with SELECT (after optional whitespace).
    2. Must not contain multiple statements (no bare semicolons that are not
       inside a string literal — we use a conservative heuristic).
    3. Must not be empty.
    """
    if not sql or not sql.strip():
        raise PgServiceError("Query is empty.")

    if not _SELECT_RE.match(sql):
        raise PgServiceError(
            "Only SELECT statements are permitted. "
            "INSERT, UPDATE, DELETE, DROP, CREATE, and similar "
            "operations are not allowed."
        )

    # Conservative semicolon check: strip string literals, then look for ';'
    stripped = re.sub(r"'[^']*'", "", sql)   # remove single-quoted strings
    stripped = re.sub(r'"[^"]*"', "", stripped)  # remove double-quoted identifiers
    if ";" in stripped:
        raise PgServiceError(
            "Multiple SQL statements are not permitted. "
            "Remove all semicolons from your query."
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class PgService:
    """
    Stateless service object.  Each method opens and closes its own
    connection so that the application does not hold idle connections.
    """

    # ---- connection health -------------------------------------------------

    def test_connection(self) -> dict:
        """
        Open a connection, run SELECT 1, close it.

        Returns
        -------
        {
            "healthy": bool,
            "latency_ms": float | None,
            "db": str,
            "user": str,
            "host": str,
            "error": str | None
        }
        """
        db = os.environ.get("PGDATABASE", "reconx_demo")
        user = os.environ.get("PGUSER", "reconx_reader")
        host = os.environ.get("PGHOST", "127.0.0.1")
        t0 = time.monotonic()
        try:
            conn = _open_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            conn.close()
            latency_ms = round((time.monotonic() - t0) * 1000, 2)
            return {
                "healthy": True,
                "latency_ms": latency_ms,
                "db": db,
                "user": user,
                "host": host,
                "error": None,
            }
        except PgServiceError as exc:
            return {
                "healthy": False,
                "latency_ms": None,
                "db": db,
                "user": user,
                "host": host,
                "error": str(exc),
            }

    # ---- schema introspection ---------------------------------------------

    def get_schema_info(self) -> dict:
        """
        Return accessible tables and their columns for the public schema.

        Returns
        -------
        {
            "tables": [
                {
                    "schema": str,
                    "table": str,
                    "columns": [{"name": str, "type": str}, ...]
                },
                ...
            ]
        }
        """
        try:
            conn = _open_connection()
            tables: list[dict] = []

            with conn.cursor() as cur:
                # Tables
                cur.execute(
                    """
                    SELECT table_schema, table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_type   = 'BASE TABLE'
                    ORDER BY table_name
                    """
                )
                table_rows = cur.fetchall()

                for schema_name, table_name in table_rows:
                    # Columns for this table
                    cur.execute(
                        """
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema = %s
                          AND table_name   = %s
                        ORDER BY ordinal_position
                        """,
                        (schema_name, table_name),
                    )
                    columns = [
                        {"name": col[0], "type": col[1]}
                        for col in cur.fetchall()
                    ]
                    tables.append(
                        {
                            "schema": schema_name,
                            "table": table_name,
                            "columns": columns,
                        }
                    )

            conn.close()
            return {"tables": tables}

        except PgServiceError as exc:
            raise
        except Exception as exc:
            raise PgServiceError(_redact(str(exc))) from None

    # ---- safe query execution ---------------------------------------------

    def execute_safe_query(self, sql: str) -> dict:
        """
        Validate *sql*, execute it (SELECT only), and return at most MAX_ROWS
        rows.

        Returns
        -------
        {
            "columns": [str, ...],
            "rows": [[value, ...], ...],
            "row_count": int,
            "truncated": bool
        }

        Raises PgServiceError for all expected failures.
        """
        validate_sql(sql)

        try:
            conn = _open_connection()

            with conn.cursor() as cur:
                # Apply a server-side statement timeout
                cur.execute(
                    f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"
                )
                cur.execute(sql)
                columns = [desc.name for desc in cur.description] if cur.description else []
                rows = cur.fetchmany(MAX_ROWS + 1)   # fetch one extra to detect truncation

            conn.close()

            truncated = len(rows) > MAX_ROWS
            rows = rows[:MAX_ROWS]

            # Convert all values to JSON-safe primitives
            safe_rows = [
                [v if isinstance(v, (int, float, str, bool, type(None))) else str(v)
                 for v in row]
                for row in rows
            ]

            return {
                "columns": columns,
                "rows": safe_rows,
                "row_count": len(safe_rows),
                "truncated": truncated,
            }

        except PgServiceError:
            raise
        except psycopg.errors.QueryCanceled:
            raise PgServiceError(
                f"Query exceeded the {STATEMENT_TIMEOUT_MS // 1000}-second timeout and was cancelled."
            ) from None
        except Exception as exc:
            raise PgServiceError(_redact(str(exc))) from None

    # ---- configuration summary (no secrets) --------------------------------

    def config_summary(self) -> dict:
        """Return non-secret connection configuration for the UI."""
        return {
            "host": os.environ.get("PGHOST", "127.0.0.1"),
            "port": os.environ.get("PGPORT", "5432"),
            "db": os.environ.get("PGDATABASE", "reconx_demo"),
            "user": os.environ.get("PGUSER", "reconx_reader"),
            "configured": bool(os.environ.get("PGPASSWORD")),
        }
