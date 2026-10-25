"""
app/db/pg_service.py
====================
Server-side PostgreSQL connection service for RECON-X.

Credentials are read exclusively from environment variables (populated by
python-dotenv from a local .env file).  The password is never logged or
returned in API responses.

Security rules enforced here
-----------------------------
- Only parsed whole-table primary-key COUNT queries on approved demo tables
  are permitted.
- Result rows are capped at MAX_ROWS (50).
- A per-statement timeout of STATEMENT_TIMEOUT_MS (5 000 ms) is applied via
  PostgreSQL SET LOCAL statement_timeout.
- Connection errors are replaced with generic messages before reaching callers.
"""

import os
import time
import psycopg
from sqlglot import exp, parse
from sqlglot.errors import ParseError

MAX_ROWS: int = 50
STATEMENT_TIMEOUT_MS: int = 5_000   # 5 seconds
CONNECT_TIMEOUT_S: int = 5
SAFE_COUNT_COLUMNS = {
    "customers": "customer_id",
    "employees": "employee_id",
    "transactions": "transaction_id",
    "audit_demo": "log_id",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _identifier_name(identifier: exp.Expression | None) -> str | None:
    if not isinstance(identifier, exp.Identifier):
        return None
    name = identifier.this
    return name if identifier.args.get("quoted") else name.lower()


def _safe_count_query(sql: str) -> tuple[str, str] | None:
    """Accept one COUNT(primary_key) over one approved demo table."""
    try:
        statements = [statement for statement in parse(sql, read="postgres") if statement is not None]
    except ParseError:
        return None

    if len(statements) != 1 or not isinstance(statements[0], exp.Select):
        return None

    select = statements[0]
    if any(
        value not in (None, False, [], {})
        for key, value in select.args.items()
        if key not in {"expressions", "from_"}
    ):
        return None
    if len(select.expressions) != 1:
        return None

    projection = select.expressions[0]
    if isinstance(projection, exp.Alias):
        if not isinstance(projection.args.get("alias"), exp.Identifier):
            return None
        projection = projection.this
    if not isinstance(projection, exp.Count):
        return None
    if any(
        value not in (None, False, [], {})
        for key, value in projection.args.items()
        if key not in {"this", "expressions", "big_int"}
    ):
        return None
    if projection.args.get("distinct") or projection.args.get("expressions"):
        return None

    count_column = projection.this
    if not isinstance(count_column, exp.Column):
        return None
    if count_column.args.get("db") or count_column.args.get("catalog"):
        return None
    column_name = _identifier_name(count_column.this)
    if column_name is None:
        return None

    from_clause = select.args.get("from_")
    table = from_clause.this if isinstance(from_clause, exp.From) else None
    if not isinstance(table, exp.Table):
        return None
    if any(
        value not in (None, False, [], {})
        for key, value in table.args.items()
        if key not in {"this", "db", "alias"}
    ):
        return None
    alias = table.args.get("alias")
    if alias and (
        not isinstance(alias, exp.TableAlias)
        or not isinstance(alias.this, exp.Identifier)
        or alias.args.get("columns")
    ):
        return None

    table_name = _identifier_name(table.this)
    schema_name = _identifier_name(table.args.get("db"))
    table_alias = _identifier_name(alias.this) if alias else None
    column_qualifier = _identifier_name(count_column.args.get("table"))
    if schema_name not in (None, "public") or table_name not in SAFE_COUNT_COLUMNS:
        return None
    if column_qualifier not in (None, table_name, table_alias):
        return None
    if SAFE_COUNT_COLUMNS[table_name] != column_name:
        return None
    return table_name, column_name


def _open_connection() -> psycopg.Connection:
    """Open a restricted connection in an explicitly read-only transaction."""
    conn = None
    try:
        user = os.environ.get("PGUSER", "reconx_demo_reader")
        if user != "reconx_demo_reader":
            raise PgServiceError("A restricted PostgreSQL application role is required.")
        conn = psycopg.connect(
            host=os.environ.get("PGHOST", "127.0.0.1"),
            port=os.environ.get("PGPORT", "5432"),
            dbname=os.environ.get("PGDATABASE", "reconx_demo"),
            user=user,
            password=os.environ.get("PGPASSWORD", ""),
            connect_timeout=CONNECT_TIMEOUT_S,
            application_name="reconx_proxy",
        )
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}")
            cur.execute(
                """
                SELECT r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
                       OR r.rolreplication OR r.rolbypassrls OR r.rolinherit
                       OR EXISTS (
                           SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid
                       )
                FROM pg_roles r
                WHERE r.rolname = current_user
                """
            )
            role_row = cur.fetchone()
        if not role_row or role_row[0]:
            conn.close()
            raise PgServiceError("A non-superuser PostgreSQL application role is required.")
        return conn
    except PgServiceError:
        if conn is not None and not conn.closed:
            conn.close()
        raise
    except (psycopg.Error, ValueError, TypeError):
        if conn is not None and not conn.closed:
            conn.close()
        raise PgServiceError("PostgreSQL connection unavailable.") from None


# ---------------------------------------------------------------------------
# Public exception
# ---------------------------------------------------------------------------

class PgServiceError(Exception):
    """Raised for all expected PostgreSQL service errors."""


# ---------------------------------------------------------------------------
# SQL safety validation
# ---------------------------------------------------------------------------

def validate_sql(sql: str) -> tuple[str, str]:
    """Return the approved table and key, or reject uncertain SQL shapes."""
    shape = _safe_count_query(sql)
    if shape is None:
        raise PgServiceError(
            "Query is outside the approved PostgreSQL demo read-only query profile."
        )
    return shape


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
        user = os.environ.get("PGUSER", "reconx_demo_reader")
        host = os.environ.get("PGHOST", "127.0.0.1")
        t0 = time.monotonic()
        conn = None
        try:
            conn = _open_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            latency_ms = round((time.monotonic() - t0) * 1000, 2)
            return {
                "healthy": True,
                "latency_ms": latency_ms,
                "db": db,
                "user": user,
                "host": host,
                "error": None,
            }
        except (PgServiceError, psycopg.Error):
            return {
                "healthy": False,
                "latency_ms": None,
                "db": db,
                "user": user,
                "host": host,
                "error": "PostgreSQL connection unavailable.",
            }
        finally:
            if conn is not None and not conn.closed:
                conn.rollback()
                conn.close()

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
        conn = None
        try:
            conn = _open_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT allowed.table_name, c.column_name, c.data_type
                    FROM (
                        VALUES
                            ('customers', 'customer_id'),
                            ('employees', 'employee_id'),
                            ('transactions', 'transaction_id'),
                            ('audit_demo', 'log_id')
                    ) AS allowed(table_name, column_name)
                    JOIN information_schema.columns AS c
                      ON c.table_schema = 'public'
                     AND c.table_name = allowed.table_name
                     AND c.column_name = allowed.column_name
                    ORDER BY allowed.table_name
                    """
                )
                column_rows = cur.fetchall()

            tables = [
                {
                    "schema": "public",
                    "table": table_name,
                    "columns": [{"name": column_name, "type": data_type}],
                }
                for table_name, column_name, data_type in column_rows
                if SAFE_COUNT_COLUMNS.get(table_name) == column_name
            ]
            return {"tables": tables}

        except PgServiceError:
            raise PgServiceError("PostgreSQL schema is unavailable.") from None
        except psycopg.Error:
            raise PgServiceError("PostgreSQL schema is unavailable.") from None
        finally:
            if conn is not None and not conn.closed:
                conn.rollback()
                conn.close()

    # ---- safe query execution ---------------------------------------------

    def execute_safe_query(self, sql: str) -> dict:
        """
        Validate and execute an allowlisted aggregate, returning at most
        MAX_ROWS result rows.

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

        conn = None
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
        except psycopg.Error:
            raise PgServiceError("PostgreSQL query could not be completed.") from None
        finally:
            if conn is not None and not conn.closed:
                conn.rollback()
                conn.close()

    # ---- configuration summary (no secrets) --------------------------------

    def config_summary(self) -> dict:
        """Return non-secret connection configuration for the UI."""
        return {
            "host": os.environ.get("PGHOST", "127.0.0.1"),
            "port": os.environ.get("PGPORT", "5432"),
            "db": os.environ.get("PGDATABASE", "reconx_demo"),
            "user": os.environ.get("PGUSER", "reconx_demo_reader"),
            "configured": bool(os.environ.get("PGPASSWORD")),
        }
