"""Unit Tests for RECON-X Proxy Execution Gating and Safety Guarantees."""
import pytest
from app.core.proxy import ReconXProxy


def test_blocked_query_never_executes_and_releases_no_data():
    proxy = ReconXProxy()
    # Canary query is strictly blocked
    canary_query = "SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';"
    
    result = proxy.execute_query(canary_query)

    assert result["success"] is False
    assert result["blocked"] is True
    assert result["decision"] == "BLOCK"
    assert result["executed"] is False
    assert result["row_count"] == 0
    assert result["rows"] == []
    assert result["columns"] == []
    assert "Execution Prohibited" in result["message"]

    # Verify security event recorded
    events = proxy.security_events
    assert len(events) > 0
    assert events[0]["decision"] == "BLOCK"


def test_allowed_query_executes_and_returns_database_data():
    proxy = ReconXProxy()
    normal_query = "SELECT gender, city FROM patients WHERE city = 'San Francisco' LIMIT 5;"
    
    result = proxy.execute_query(normal_query)

    assert result["success"] is True
    assert result["blocked"] is False
    assert result["decision"] in ("ALLOW", "WARN")
    assert result["executed"] is True
    assert result["row_count"] > 0
    assert len(result["rows"]) > 0
    assert "gender" in result["columns"]
    assert "city" in result["columns"]


def test_stopped_proxy_rejects_all_execution():
    proxy = ReconXProxy()
    proxy.set_running(False)

    result = proxy.execute_query("SELECT 1;")
    assert result["success"] is False
    assert result["status_code"] == 503
    assert "STOPPED" in result["error"]


def test_audit_cryptographic_integrity_verification():
    proxy = ReconXProxy()
    proxy.execute_query("SELECT gender FROM patients LIMIT 2;")
    proxy.execute_query("SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';")

    integrity = proxy.audit_logger.verify_integrity()
    assert integrity["valid"] is True
    assert integrity["count"] >= 3  # startup log + 2 query logs
