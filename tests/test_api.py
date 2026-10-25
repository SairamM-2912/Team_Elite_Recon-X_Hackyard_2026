"""Direct Integration Tests for RECON-X API Route Functions."""
import pytest
from app.main import app, recon_proxy
from app.api.routes_proxy import inspect_query, execute_query, get_status, QueryRequest
from app.api.routes_connections import list_connections, select_connection, SelectConnectionRequest
from app.api.routes_audit import get_audit_logs, verify_audit_integrity


def test_api_proxy_status():
    data = get_status(proxy=recon_proxy)
    assert "proxy_running" in data
    assert "active_connection" in data
    assert "active_policy" in data


def test_api_inspect_query():
    req = QueryRequest(query="SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';")
    data = inspect_query(req, proxy=recon_proxy)
    assert data["decision"]["decision"] == "BLOCK"
    assert data["decision"]["canary_triggered"] is True


def test_api_execute_blocked_query():
    req = QueryRequest(query="SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';")
    data = execute_query(req, proxy=recon_proxy)
    assert data["blocked"] is True
    assert data["executed"] is False
    assert len(data["rows"]) == 0


def test_api_connections_list_never_leaks_secrets():
    data = list_connections(proxy=recon_proxy)
    for conn in data["connections"]:
        assert "server_credentials" not in conn
        assert conn["credentials_configured"] is True


def test_api_audit_verify_endpoint():
    data = verify_audit_integrity(proxy=recon_proxy)
    assert data["valid"] is True
