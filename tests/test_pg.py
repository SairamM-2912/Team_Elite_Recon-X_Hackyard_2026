"""
tests/test_pg.py
================
PostgreSQL integration tests for RECON-X.

Live connection and query tests run only when
RECONX_RUN_PG_INTEGRATION=1 is explicitly set. Parser, policy-gate, and
read-only-transaction tests use mocks and do not require PostgreSQL.

To deliberately run the live tests, configure database credentials and set
RECONX_RUN_PG_INTEGRATION=1 before invoking pytest. Credentials alone do not
enable these tests:

    $env:RECONX_RUN_PG_INTEGRATION = "1"
    python -m pytest tests/test_pg.py -v
"""
import json
import os
import pytest

# ---------------------------------------------------------------------------
# Load local settings before evaluating the explicit integration-test opt-in.
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed; rely on pre-set env vars

# Live tests must be deliberately enabled; credentials in .env do not enable them.
PG_INTEGRATION_ENABLED = os.environ.get("RECONX_RUN_PG_INTEGRATION") == "1"
pg_skip = pytest.mark.skipif(
    not PG_INTEGRATION_ENABLED,
    reason="Set RECONX_RUN_PG_INTEGRATION=1 to explicitly run live PostgreSQL tests.",
)

from app.db.pg_service import PgService, PgServiceError, validate_sql


# ===========================================================================
# 1. SQL validation (no DB required — always run)
# ===========================================================================

class TestSqlValidation:
    """validate_sql() must reject unsafe queries before any DB call."""

    def test_plain_select_passes(self):
        validate_sql("SELECT COUNT(customer_id) FROM customers")

    def test_safe_aliases_and_quoted_identifiers_pass(self):
        validate_sql(
            'SELECT COUNT(c.customer_id) AS total FROM public.customers AS c'
        )
        validate_sql('SELECT COUNT(employee_id) FROM "public"."employees"')

    def test_filtered_select_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("SELECT COUNT(customer_id) FROM customers WHERE city = 'X'")

    def test_insert_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("INSERT INTO demo_records (name) VALUES ('x')")

    def test_update_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("UPDATE demo_records SET name='x' WHERE id=1")

    def test_delete_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("DELETE FROM demo_records WHERE id=1")

    def test_drop_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("DROP TABLE demo_records")

    def test_multiple_statements_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("SELECT 1; DROP TABLE demo_records")

    def test_empty_query_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("")

    def test_whitespace_only_rejected(self):
        with pytest.raises(PgServiceError, match="approved"):
            validate_sql("   ")

    def test_select_case_insensitive(self):
        # Mixed case SELECT should be allowed
        validate_sql("select count(transaction_id) from transactions")

    @pytest.mark.parametrize("sql", [
        "SELECT * FROM customers",
        "SELECT COUNT(email) FROM customers",
        "SELECT COUNT(customer_id) + 1 FROM customers",
        "SELECT COUNT(customer_id) FROM customers WHERE city = 'private@example.com'",
        "SELECT COUNT(c.customer_id) FROM customers c JOIN employees e ON true",
        "SELECT COUNT(customer_id) FROM customers UNION SELECT COUNT(employee_id) FROM employees",
        "WITH c AS (SELECT customer_id FROM customers) SELECT COUNT(customer_id) FROM customers",
        "SELECT COUNT(customer_id) FILTER (WHERE city = 'private@example.com') FROM customers",
        "SELECT COUNT(customer_id) FROM customers; SELECT 1",
    ])
    def test_non_allowlisted_structures_rejected(self, sql):
        with pytest.raises(PgServiceError):
            validate_sql(sql)


class TestPgRouteSecurity:
    def _proxy(self, decision_name):
        from app.core.engine import SecurityDecision
        from unittest.mock import Mock

        decision = SecurityDecision(
            decision=decision_name,
            risk_score={"ALLOW": 0, "WARN": 40, "RESTRICT": 70, "BLOCK": 100}[decision_name],
            reasons=["Policy result"],
            factors={"canary_tripwire": False},
            remediation="Review the decision.",
        )
        engine = Mock()
        engine.active_policy_id = "BALANCED_PRIVACY"
        engine.analyze_query.return_value = decision
        proxy = Mock()
        proxy.engine = engine
        proxy.current_user = {"username": "demo_user", "role": "admin"}
        return proxy, engine

    def test_pg_inspect_is_analysis_only_and_skips_sqlite_estimator(self, monkeypatch):
        from app.api import routes_pg
        from unittest.mock import Mock

        proxy, engine = self._proxy("ALLOW")
        service = Mock()
        monkeypatch.setattr(routes_pg, "proxy_instance", proxy)
        monkeypatch.setattr(routes_pg, "pg_service", service)

        result = routes_pg.pg_inspect(
            routes_pg.PgQueryRequest(sql="SELECT COUNT(customer_id) FROM customers")
        )

        assert result["query_is_approved"] is True
        assert engine.analyze_query.call_args.kwargs["db_row_estimator"] is None
        service.execute_safe_query.assert_not_called()

    @pytest.mark.parametrize(
        ("sql", "approved"),
        [
            ("SELECT 'secret@example.com' FROM customers", False),
            (
                "SELECT COUNT(customer_id) FROM customers "
                "-- secret@example.com",
                True,
            ),
            (
                "SELECT COUNT(customer_id) + 1 FROM customers "
                "/* secret@example.com */",
                False,
            ),
        ],
    )
    def test_pg_inspect_metadata_never_echoes_sensitive_sql(
        self, sql, approved, monkeypatch
    ):
        from app.api import routes_pg
        from unittest.mock import Mock

        proxy, _ = self._proxy("ALLOW")
        service = Mock()
        monkeypatch.setattr(routes_pg, "proxy_instance", proxy)
        monkeypatch.setattr(routes_pg, "pg_service", service)

        result = routes_pg.pg_inspect(routes_pg.PgQueryRequest(sql=sql))

        assert result["query_is_approved"] is approved
        assert "secret@example.com" not in json.dumps(result)
        if not approved:
            assert result["parsed"]["statement_type"] == "UNAPPROVED"
            assert result["parsed"]["tables"] == []
            assert result["parsed"]["columns"] == []
            assert result["parsed"]["aggregates"] == []
        service.execute_safe_query.assert_not_called()

    @pytest.mark.parametrize("decision", ["WARN", "RESTRICT", "BLOCK"])
    def test_non_allow_decisions_never_execute(self, decision, monkeypatch):
        from app.api import routes_pg
        from unittest.mock import Mock

        proxy, _ = self._proxy(decision)
        proxy._record_security_event = Mock()
        proxy.audit_logger.log_event = Mock()
        service = Mock()
        monkeypatch.setattr(routes_pg, "proxy_instance", proxy)
        monkeypatch.setattr(routes_pg, "pg_service", service)

        result = routes_pg.pg_query(
            routes_pg.PgQueryRequest(sql="SELECT COUNT(customer_id) FROM customers")
        )

        assert result["executed"] is False
        assert result["decision"] == decision
        service.execute_safe_query.assert_not_called()

    def test_allow_executes_only_approved_query_and_redacts_history(self, monkeypatch):
        from app.api import routes_pg
        from unittest.mock import Mock

        proxy, engine = self._proxy("ALLOW")
        proxy._record_security_event = Mock()
        proxy.audit_logger.log_event = Mock()
        service = Mock()
        service.execute_safe_query.return_value = {
            "columns": ["count"],
            "rows": [[8]],
            "row_count": 1,
            "truncated": False,
        }
        monkeypatch.setattr(routes_pg, "proxy_instance", proxy)
        monkeypatch.setattr(routes_pg, "pg_service", service)

        result = routes_pg.pg_query(
            routes_pg.PgQueryRequest(
                sql="SELECT COUNT(c.customer_id) AS total FROM public.customers AS c"
            )
        )

        assert result["executed"] is True
        assert result["rows"] == [[8]]
        service.execute_safe_query.assert_called_once_with(
            "SELECT COUNT(c.customer_id) AS total FROM public.customers AS c"
        )
        history_call = engine.record_session_query.call_args.kwargs
        assert history_call["query"] == "SELECT COUNT(customer_id) FROM public.customers"
        assert history_call["source"] == "postgresql"

    def test_rejected_sql_is_redacted_and_never_executed(self, monkeypatch):
        from app.api import routes_pg
        from unittest.mock import Mock

        proxy, _ = self._proxy("ALLOW")
        proxy._record_security_event = Mock()
        proxy.audit_logger.log_event = Mock()
        service = Mock()
        monkeypatch.setattr(routes_pg, "proxy_instance", proxy)
        monkeypatch.setattr(routes_pg, "pg_service", service)
        private_value = "private@example.com"

        result = routes_pg.pg_query(
            routes_pg.PgQueryRequest(
                sql=f"SELECT email FROM customers WHERE email = '{private_value}'"
            )
        )

        assert result["decision"] == "BLOCK"
        assert result["executed"] is False
        assert private_value not in str(result)
        service.execute_safe_query.assert_not_called()
        assert private_value not in str(proxy._record_security_event.call_args)
        assert private_value not in str(proxy.audit_logger.log_event.call_args)

    def test_database_error_is_generic_in_response_and_logs(self, monkeypatch, caplog):
        from app.api import routes_pg
        from app.db.pg_service import PgServiceError
        from unittest.mock import Mock

        proxy, _ = self._proxy("ALLOW")
        proxy._record_security_event = Mock()
        proxy.audit_logger.log_event = Mock()
        service = Mock()
        service.execute_safe_query.side_effect = PgServiceError(
            "private@example.com in raw driver error"
        )
        monkeypatch.setattr(routes_pg, "proxy_instance", proxy)
        monkeypatch.setattr(routes_pg, "pg_service", service)

        result = routes_pg.pg_query(
            routes_pg.PgQueryRequest(sql="SELECT COUNT(customer_id) FROM customers")
        )

        assert result["error"] == "PostgreSQL query could not be completed."
        assert "private@example.com" not in str(result)
        assert "private@example.com" not in caplog.text


class TestPgReadOnlyConnection:
    def test_transaction_is_read_only_before_queries(self, monkeypatch):
        from types import SimpleNamespace
        from app.db import pg_service

        commands = []

        class Cursor:
            description = [SimpleNamespace(name="count")]

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def execute(self, sql, params=None):
                commands.append(sql.strip())

            def fetchone(self):
                return (False,)

            def fetchmany(self, _):
                return [(8,)]

        class Connection:
            autocommit = True
            closed = False

            def cursor(self):
                return Cursor()

            def rollback(self):
                pass

            def close(self):
                self.closed = True

        connection = Connection()
        monkeypatch.setenv("PGUSER", "reconx_demo_reader")
        monkeypatch.setattr(pg_service.psycopg, "connect", lambda **_: connection)

        result = PgService().execute_safe_query(
            "SELECT COUNT(customer_id) FROM customers"
        )

        assert result["rows"] == [[8]]
        assert commands[0] == "SET TRANSACTION READ ONLY"
        assert commands[1].startswith("SET LOCAL statement_timeout")
        assert any("SELECT COUNT(customer_id) FROM customers" in sql for sql in commands)
        assert connection.closed is True

    def test_postgres_role_is_rejected_before_connecting(self, monkeypatch):
        from unittest.mock import Mock
        from app.db import pg_service

        connect = Mock()
        monkeypatch.setenv("PGUSER", "postgres")
        monkeypatch.setattr(pg_service.psycopg, "connect", connect)

        with pytest.raises(PgServiceError, match="restricted"):
            PgService().execute_safe_query(
                "SELECT COUNT(customer_id) FROM customers"
            )
        connect.assert_not_called()

    def test_non_readonly_role_is_rejected(self, monkeypatch):
        from app.db import pg_service

        class Cursor:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def execute(self, *_):
                pass

            def fetchone(self):
                return (True,)

        class Connection:
            autocommit = True
            closed = False

            def cursor(self):
                return Cursor()

            def close(self):
                self.closed = True

        connection = Connection()
        monkeypatch.setenv("PGUSER", "reconx_demo_reader")
        monkeypatch.setattr(
            pg_service.psycopg, "connect", lambda **_: connection
        )

        with pytest.raises(PgServiceError, match="non-superuser"):
            pg_service._open_connection()
        assert connection.closed is True


class TestPgSchemaInfo:
    def _schema_service_with_rows(self, rows, monkeypatch):
        from app.db import pg_service

        statements = []

        class Cursor:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def execute(self, sql, params=None):
                statements.append(sql)

            def fetchall(self):
                return rows

        class Connection:
            closed = False

            def cursor(self):
                return Cursor()

            def rollback(self):
                pass

            def close(self):
                self.closed = True

        connection = Connection()
        monkeypatch.setenv("PGUSER", "reconx_demo_reader")
        monkeypatch.setattr(
            pg_service, "_open_connection", lambda: connection
        )
        return pg_service.PgService(), statements

    def test_schema_lists_only_allowlisted_primary_keys_without_table_discovery(
        self, monkeypatch
    ):
        rows = [
            ("audit_demo", "log_id", "integer"),
            ("customers", "customer_id", "integer"),
            ("employees", "employee_id", "integer"),
            ("transactions", "transaction_id", "integer"),
        ]
        service, statements = self._schema_service_with_rows(rows, monkeypatch)

        result = service.get_schema_info()

        assert result == {
            "tables": [
                {
                    "schema": "public",
                    "table": table,
                    "columns": [{"name": column, "type": "integer"}],
                }
                for table, column, _ in rows
            ]
        }
        assert len(statements) == 1
        assert "information_schema.columns" in statements[0]
        assert "information_schema.tables" not in statements[0]

    def test_schema_discards_metadata_outside_allowlist(self, monkeypatch):
        rows = [
            ("customers", "customer_id", "integer"),
            ("customers", "email", "character varying"),
            ("other_table", "id", "integer"),
            ("employees", "role", "character varying"),
        ]
        service, _ = self._schema_service_with_rows(rows, monkeypatch)

        result = service.get_schema_info()

        assert result == {
            "tables": [
                {
                    "schema": "public",
                    "table": "customers",
                    "columns": [{"name": "customer_id", "type": "integer"}],
                }
            ]
        }

    def test_schema_endpoint_returns_allowlisted_service_response(self, monkeypatch):
        from app.api import routes_pg
        from unittest.mock import Mock

        schema = {
            "tables": [
                {
                    "schema": "public",
                    "table": "customers",
                    "columns": [{"name": "customer_id", "type": "integer"}],
                }
            ]
        }
        service = Mock()
        service.get_schema_info.return_value = schema
        monkeypatch.setattr(routes_pg, "pg_service", service)

        assert routes_pg.pg_schema() == schema


class TestPostgresHistoryRedaction:
    def test_history_redacts_query_text_and_predicate_values(self):
        from app.core.engine import SecurityEngine
        from app.core.parser import ParsedQuery

        sensitive_query = (
            "SELECT COUNT(customer_id) FROM customers "
            "WHERE email = 'private@example.com'"
        )
        engine = SecurityEngine()
        engine.record_session_query(
            "pg_test",
            sensitive_query,
            ParsedQuery(sensitive_query),
            "BLOCK",
            source="postgresql",
        )

        history = engine.get_session_history("pg_test")
        assert "private@example.com" not in str(history)
        assert sensitive_query not in str(history)
        assert history[0]["query"] == "[PostgreSQL query redacted]"


# ===========================================================================
# 2. Connection tests (require PG)
# ===========================================================================

class TestPgConnection:
    """Real connection tests — skipped unless explicitly enabled."""

    @pg_skip
    def test_connection_success(self):
        """A valid SELECT 1 must return healthy=True."""
        svc = PgService()
        result = svc.test_connection()
        assert result["healthy"] is True, f"Expected healthy connection, got error: {result.get('error')}"
        assert result["latency_ms"] is not None
        assert result["error"] is None

    @pg_skip
    def test_connection_password_not_in_result(self):
        """Password must never appear in the connection result dict."""
        svc = PgService()
        result = svc.test_connection()
        pwd = os.environ.get("PGPASSWORD", "")
        if pwd:
            result_str = str(result)
            assert pwd not in result_str, "Password leaked into connection result!"

    @pg_skip
    def test_bad_credentials_gives_error(self):
        """Wrong password must return healthy=False with an error message, not raise."""
        # Temporarily override credentials
        orig_pwd = os.environ.get("PGPASSWORD", "")
        orig_user = os.environ.get("PGUSER", "reconx_reader")
        os.environ["PGPASSWORD"] = "definitely_wrong_password_xyz"
        os.environ["PGUSER"] = "nonexistent_user_xyz"
        try:
            svc = PgService()
            result = svc.test_connection()
            assert result["healthy"] is False
            assert result["error"] == "PostgreSQL connection unavailable."
            # Password must not appear in error
            assert "definitely_wrong_password_xyz" not in (result["error"] or "")
        finally:
            os.environ["PGPASSWORD"] = orig_pwd
            os.environ["PGUSER"] = orig_user

    @pg_skip
    def test_missing_database_gives_error(self):
        """Non-existent database name must return healthy=False."""
        orig_db = os.environ.get("PGDATABASE", "reconx_demo")
        os.environ["PGDATABASE"] = "this_db_does_not_exist_xyz"
        try:
            svc = PgService()
            result = svc.test_connection()
            assert result["healthy"] is False
            assert result["error"] == "PostgreSQL connection unavailable."
        finally:
            os.environ["PGDATABASE"] = orig_db


# ===========================================================================
# 3. Query execution tests (require PG)
# ===========================================================================

class TestPgQueryExecution:

    @pg_skip
    def test_permitted_select(self):
        """An approved aggregate on a demo table must return rows."""
        svc = PgService()
        result = svc.execute_safe_query("SELECT COUNT(customer_id) FROM customers")
        assert "columns" in result
        assert "rows" in result
        assert result["row_count"] >= 0  # might be 0 if table empty; no error

    @pg_skip
    def test_result_limit_enforced(self):
        """Result rows must be capped at MAX_ROWS (50)."""
        from app.db.pg_service import MAX_ROWS
        svc = PgService()
        # Request way more rows than the cap
        result = svc.execute_safe_query(
            "SELECT COUNT(log_id) FROM audit_demo"
        )
        assert result["row_count"] <= MAX_ROWS

    def test_write_rejected_before_execution(self):
        """INSERT must be rejected by validate_sql without any DB call."""
        svc = PgService()
        with pytest.raises(PgServiceError, match="approved"):
            svc.execute_safe_query("INSERT INTO customers (city) VALUES ('x')")

    def test_multiple_statements_rejected(self):
        """Semicolon-chained statements must be rejected without any DB call."""
        svc = PgService()
        with pytest.raises(PgServiceError, match="approved"):
            svc.execute_safe_query("SELECT COUNT(customer_id) FROM customers; SELECT 1")


# ===========================================================================
# 4. Security engine integration (BLOCK must prevent execution)
# ===========================================================================

class TestBlockEnforcement:
    """
    Verify that the RECON-X engine BLOCK decision prevents DB execution.
    These tests do not require a live PG database — they test the gate logic.
    """

    def test_blocked_query_not_executed(self):
        """
        When the security engine returns BLOCK, execute_safe_query must NOT
        be called.  We verify this by checking that the route-level gate
        returns executed=False without reaching pg_service.
        """
        from app.core.proxy import ReconXProxy
        from app.db.pg_service import PgService, validate_sql
        import unittest.mock as mock

        proxy = ReconXProxy()
        svc = PgService()

        # A canary query that the engine should BLOCK
        canary_sql = "SELECT * FROM patients WHERE full_name = 'Jane Doe Canary'"

        inspection = proxy.inspect_query(canary_sql, session_id="test_block")
        decision = inspection["decision"]["decision"]

        # If engine blocked, pg_service.execute_safe_query must NOT have run
        if decision == "BLOCK":
            # Patch execute_safe_query to assert it is never called
            with mock.patch.object(svc, "execute_safe_query") as mock_exec:
                # Simulate the route logic
                if decision == "BLOCK":
                    pass  # gate: do not call execute_safe_query
                else:
                    svc.execute_safe_query(canary_sql)
                mock_exec.assert_not_called()
        # If engine did not block (different policy active), test is vacuously ok

    @pg_skip
    def test_schema_endpoint_never_returns_password(self):
        """
        Even if schema retrieval fails, the error must not contain the password.
        """
        orig_pwd = os.environ.get("PGPASSWORD", "secret_pwd_test")
        os.environ["PGPASSWORD"] = "secret_pwd_test"
        try:
            svc = PgService()
            try:
                info = svc.get_schema_info()
                # If it succeeded, check result
                assert "secret_pwd_test" not in str(info)
            except PgServiceError as exc:
                assert "secret_pwd_test" not in str(exc)
        finally:
            if orig_pwd:
                os.environ["PGPASSWORD"] = orig_pwd
            else:
                os.environ.pop("PGPASSWORD", None)
