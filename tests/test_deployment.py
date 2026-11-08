import asyncio
import base64
import sqlite3
from types import SimpleNamespace

import pytest

from app import config
from app.db import seed_data
from app.db.sqlite_utils import connect_sqlite


def _database_paths(tmp_path):
    return {
        sector: str(tmp_path / f"{sector}.db")
        for sector in ("healthcare", "banking", "corporate_hr", "retail")
    }


def test_initialization_creates_schema_without_seeding_by_default(
    tmp_path, monkeypatch
):
    paths = _database_paths(tmp_path)
    monkeypatch.setattr(seed_data, "DB_PATHS", paths)

    seed_data.init_all_databases(seed_demo=False)
    seed_data.init_all_databases(seed_demo=False)

    with connect_sqlite(paths["healthcare"]) as conn:
        assert conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == 0
        assert conn.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 30_000


def test_initialization_never_overwrites_or_seeds_nonempty_databases(
    tmp_path, monkeypatch
):
    paths = _database_paths(tmp_path)
    monkeypatch.setattr(seed_data, "DB_PATHS", paths)
    seed_data.init_all_databases(seed_demo=False)

    with sqlite3.connect(paths["healthcare"]) as conn:
        conn.execute(
            "INSERT INTO patients VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("local-record", "Local User", "1980-01-01", "X", "00000", "x", "x", "x"),
        )

    seed_data.init_all_databases(seed_demo=True)

    with sqlite3.connect(paths["healthcare"]) as conn:
        assert conn.execute(
            "SELECT full_name FROM patients WHERE patient_id = ?",
            ("local-record",),
        ).fetchone() == ("Local User",)
        assert conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM diagnoses").fetchone()[0] == 0


def test_explicit_demo_seed_runs_only_once_on_empty_database(tmp_path, monkeypatch):
    paths = _database_paths(tmp_path)
    monkeypatch.setattr(seed_data, "DB_PATHS", paths)

    seed_data.init_all_databases(seed_demo=True)
    with sqlite3.connect(paths["healthcare"]) as conn:
        patient_count = conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
        assert patient_count > 0

    seed_data.init_all_databases(seed_demo=True)
    with sqlite3.connect(paths["healthcare"]) as conn:
        assert conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == patient_count


def test_render_auth_requires_configured_credentials():
    with pytest.raises(RuntimeError, match="RECONX_AUTH_USERNAME"):
        config.validate_auth_configuration(True, "", "")
    with pytest.raises(RuntimeError, match="at least 16 characters"):
        config.validate_auth_configuration(True, "operator", "short")


def test_cors_origins_are_limited_and_include_render_service_domain(monkeypatch):
    monkeypatch.setenv(
        "RECONX_CORS_ORIGINS", "https://dashboard.example.com,http://localhost:3000"
    )
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://recon-x.onrender.com")

    assert config.get_cors_origins() == [
        "https://dashboard.example.com",
        "http://localhost:3000",
        "https://recon-x.onrender.com",
    ]

    monkeypatch.setenv("RECONX_CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="HTTP\\(S\\) origins"):
        config.get_cors_origins()


def test_dashboard_and_static_files_are_protected_when_auth_is_enabled(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "AUTH_ENABLED", True)
    monkeypatch.setattr(main, "AUTH_USERNAME", "operator")
    monkeypatch.setattr(main, "AUTH_PASSWORD", "long-test-password")
    async def next_response(_request):
        from starlette.responses import Response
        return Response(status_code=200)

    def request(path, authorization=""):
        return SimpleNamespace(
            url=SimpleNamespace(path=path),
            method="GET",
            headers={"authorization": authorization} if authorization else {},
        )

    denied = asyncio.run(main.require_production_auth(request("/"), next_response))
    assert denied.status_code == 401
    assert denied.headers["www-authenticate"].startswith("Basic")

    encoded = base64.b64encode(b"operator:long-test-password").decode("ascii")
    allowed = asyncio.run(
        main.require_production_auth(
            request("/", f"Basic {encoded}"), next_response
        )
    )
    assert allowed.status_code == 200

    health = asyncio.run(
        main.require_production_auth(request("/health"), next_response)
    )
    assert health.status_code == 200


def test_supabase_browser_config_contains_public_values_only(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main, "SUPABASE_PUBLISHABLE_KEY", "public-test-key")
    response = main.public_frontend_config()
    body = response.body.decode("utf-8")

    assert response.status_code == 200
    assert "https://example.supabase.co" in body
    assert "public-test-key" in body
    assert "PGPASSWORD" not in body
    assert "DATABASE_URL" not in body
