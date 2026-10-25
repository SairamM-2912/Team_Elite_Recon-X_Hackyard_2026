"""Unit Tests for RECON-X Security & Inference Detection Engine."""
import pytest
from app.core.engine import SecurityEngine
from app.core.parser import ParsedQuery


def test_canary_honeytoken_immediate_block():
    engine = SecurityEngine(active_policy_id="BALANCED_PRIVACY")
    query = "SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';"
    decision = engine.analyze_query(query)

    assert decision.decision == "BLOCK"
    assert decision.risk_score >= 90
    assert decision.canary_triggered is True
    assert any("Canary" in r for r in decision.reasons)


def test_differencing_attack_detection():
    engine = SecurityEngine(active_policy_id="BALANCED_PRIVACY")
    session_id = "test_diff_session"

    # Query 1: Cohort aggregate
    q1 = "SELECT SUM(salary) FROM employees WHERE department = 'Engineering';"
    p1 = ParsedQuery(q1)
    engine.record_session_query(session_id, q1, p1, "ALLOW")

    # Query 2: Same aggregate excluding one individual (EMP-104)
    q2 = "SELECT SUM(salary) FROM employees WHERE department = 'Engineering' AND emp_id != 'EMP-104';"
    decision = engine.analyze_query(q2, session_id=session_id)

    assert decision.factors["differencing_attack"] is True
    assert decision.decision in ("BLOCK", "RESTRICT")
    assert decision.differencing_match is not None
    assert any("Differencing" in r or "RECONSTRUCTION" in r for r in decision.reasons)


def test_population_narrowing_k1_singling_out():
    engine = SecurityEngine(active_policy_id="BALANCED_PRIVACY")

    # Mock row estimator returning 1 row (singling out)
    row_estimator = lambda q: 1

    query = "SELECT name, salary FROM employees WHERE department = 'Engineering' AND job_title = 'Director of Platform';"
    decision = engine.analyze_query(query, db_row_estimator=row_estimator)

    assert decision.factors["population_narrowing"] is True
    assert decision.decision in ("BLOCK", "RESTRICT", "WARN")
    assert any("k=1" in r or "isolates exactly 1" in r for r in decision.reasons)


def test_progressive_filtering_detection():
    engine = SecurityEngine(active_policy_id="BALANCED_PRIVACY")
    session_id = "test_prog_session"

    # Sequence of 3 narrowing queries
    queries = [
        "SELECT * FROM patients WHERE city = 'San Francisco';",
        "SELECT * FROM patients WHERE city = 'San Francisco' AND gender = 'F';",
        "SELECT * FROM patients WHERE city = 'San Francisco' AND gender = 'F' AND dob > '1990-01-01';"
    ]

    for q in queries[:-1]:
        p = ParsedQuery(q)
        engine.record_session_query(session_id, q, p, "ALLOW")

    decision = engine.analyze_query(queries[-1], session_id=session_id)
    assert decision.factors["progressive_filtering"] is True
