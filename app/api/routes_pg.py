"""
app/api/routes_pg.py
====================
PostgreSQL integration routes for RECON-X.

All endpoints enforce security rules BEFORE touching the database:
- BLOCK decisions from the RECON-X engine prevent any database execution.
- Only allowlisted whole-table primary-key counts can reach psycopg.
- Database transactions are explicitly read-only.
- Credentials are never returned in any response.
"""
import time
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/pg", tags=["PostgreSQL Integration"])
logger = logging.getLogger(__name__)

# Set by main.py after startup
pg_service = None          # PgService instance
proxy_instance = None      # ReconXProxy instance (for security engine)


def _get_pg():
    if pg_service is None:
        raise HTTPException(status_code=500, detail="PostgreSQL service not initialised.")
    return pg_service


def _get_proxy():
    if proxy_instance is None:
        raise HTTPException(status_code=500, detail="Security proxy not initialised.")
    return proxy_instance


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class PgQueryRequest(BaseModel):
    sql: str
    session_id: Optional[str] = "pg_default"


def _safe_decision_reasons(decision) -> list[str]:
    if decision.canary_triggered:
        return ["A configured canary policy blocked this query."]
    if decision.differencing_match:
        return ["The policy flagged a repeated aggregate pattern."]
    return decision.reasons


def _analyze_pg_query(sql: str, session_id: str, proxy) -> dict:
    from app.db.pg_service import PgServiceError, validate_sql

    if len(sql) > 4096:
        raise HTTPException(
            status_code=413,
            detail="Query exceeds the PostgreSQL demo limit.",
        )
    started = time.perf_counter()
    decision = proxy.engine.analyze_query(
        query=sql,
        user_role=proxy.current_user["role"],
        session_id=session_id,
        db_row_estimator=None,
    )
    try:
        table_name, key_column = validate_sql(sql)
        query_is_approved = True
    except PgServiceError:
        table_name = key_column = None
        query_is_approved = False

    if not query_is_approved and decision.decision != "BLOCK":
        decision.decision = "BLOCK"
        decision.risk_score = 100
        decision.reasons = [
            "Query is outside the approved PostgreSQL demo query profile."
        ]
        decision.remediation = (
            "Use a whole-table COUNT over an approved demo table and primary key."
        )

    if query_is_approved:
        parsed_metadata = {
            "statement_type": "SELECT",
            "tables": [table_name],
            "columns": [key_column],
            "aggregates": [{"func": "COUNT", "arg": "[approved key]"}],
            "predicates": [],
            "sensitive_columns": [],
            "canary_hits": [],
        }
        decision_metadata = {
            **decision.to_dict(),
            "reasons": _safe_decision_reasons(decision),
            "differencing_match": None,
        }
    else:
        parsed_metadata = {
            "statement_type": "UNAPPROVED",
            "tables": [],
            "columns": [],
            "aggregates": [],
            "predicates": [],
            "sensitive_columns": [],
            "canary_hits": [],
        }
        decision_metadata = {
            "decision": decision.decision,
            "risk_score": decision.risk_score,
            "reasons": ["Query is outside the approved PostgreSQL demo query profile."],
            "factors": {},
            "remediation": (
                "Use a whole-table COUNT over an approved demo table and primary key."
            ),
            "differencing_match": None,
            "canary_triggered": False,
            "requires_diff_privacy": False,
        }

    return {
        "query": "[PostgreSQL query redacted]",
        "parsed": parsed_metadata,
        "decision": decision_metadata,
        "analysis_latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "user": proxy.current_user["username"],
        "role": proxy.current_user["role"],
        "policy_id": proxy.engine.active_policy_id,
        "query_is_approved": query_is_approved,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
def pg_status():
    """
    Return non-secret PG configuration and whether credentials are present.
    Does NOT attempt a connection — call /test for that.
    """
    svc = _get_pg()
    summary = svc.config_summary()
    return {
        "configured": summary["configured"],
        "host": summary["host"],
        "port": summary["port"],
        "db": summary["db"],
        "user": summary["user"],
    }


@router.post("/test")
def pg_test():
    """
    Perform a real SELECT 1 health-check against the PostgreSQL server.
    Returns healthy=true only when the server responds successfully.
    The password is never included in the response.
    """
    svc = _get_pg()
    result = svc.test_connection()
    # Never include password or full connection string in response
    return {
        "healthy": result["healthy"],
        "latency_ms": result["latency_ms"],
        "db": result["db"],
        "user": result["user"],
        "host": result["host"],
        "error": None if result["healthy"] else "PostgreSQL connection unavailable.",
    }


@router.get("/schema")
def pg_schema():
    """
    Return the list of accessible tables and their columns (public schema).
    Read-only — no data rows are returned.
    """
    from app.db.pg_service import PgServiceError
    svc = _get_pg()
    try:
        info = svc.get_schema_info()
        return info
    except PgServiceError:
        raise HTTPException(status_code=503, detail="PostgreSQL schema is unavailable.")


@router.post("/inspect")
def pg_inspect(req: PgQueryRequest):
    """Analyze a PostgreSQL query without opening a database connection."""
    proxy = _get_proxy()
    session_id = f"pg_{req.session_id or 'default'}"
    return _analyze_pg_query(req.sql, session_id, proxy)


@router.post("/query")
def pg_query(req: PgQueryRequest):
    """Analyze and execute only allowlisted ALLOW queries in read-only transactions."""
    from app.core.parser import ParsedQuery
    from app.db.pg_service import PgServiceError, validate_sql

    svc = _get_pg()
    proxy = _get_proxy()
    sql = req.sql.strip()
    session_id = f"pg_{req.session_id or 'default'}"
    inspection = _analyze_pg_query(sql, session_id, proxy)
    decision_meta = inspection["decision"]
    decision = decision_meta["decision"]
    safe_query_label = "[PostgreSQL query redacted]"

    try:
        table_name, key_column = validate_sql(sql)
    except PgServiceError:
        table_name = key_column = None
    if table_name and key_column:
        safe_history_query = (
            f"SELECT COUNT({key_column}) FROM public.{table_name}"
        )
        proxy.engine.record_session_query(
            session_id=session_id,
            query=safe_history_query,
            parsed=ParsedQuery(safe_history_query),
            decision=decision,
            estimated_rows=None,
            source="postgresql",
        )

    if decision != "ALLOW":
        proxy._record_security_event(
            event_type="PG_BLOCKED_QUERY_ATTEMPT",
            severity="HIGH" if decision == "BLOCK" else "MEDIUM",
            decision=decision,
            risk_score=decision_meta["risk_score"],
            query=safe_query_label,
            reasons=decision_meta["reasons"],
            factors=decision_meta["factors"],
        )
        proxy.audit_logger.log_event(
            event_type="PG_QUERY_NOT_EXECUTED",
            user=proxy.current_user["username"],
            role=proxy.current_user["role"],
            query=safe_query_label,
            decision=decision,
            risk_score=decision_meta["risk_score"],
            details={"source": "postgresql"},
            executed=False,
        )
        return {
            "success": False,
            "executed": False,
            "blocked": True,
            "decision": decision,
            "risk_score": decision_meta["risk_score"],
            "reasons": decision_meta["reasons"],
            "remediation": decision_meta["remediation"],
            "factors": decision_meta["factors"],
            "columns": [],
            "rows": [],
            "row_count": 0,
            "analysis_latency_ms": inspection["analysis_latency_ms"],
            "message": "PostgreSQL execution was denied by the analysis gate.",
        }

    try:
        validate_sql(sql)
    except PgServiceError:
        raise HTTPException(
            status_code=403,
            detail="Query is outside the approved PostgreSQL demo profile.",
        )

    started = time.perf_counter()
    try:
        result = svc.execute_safe_query(sql)
    except PgServiceError:
        logger.warning("PostgreSQL query failed; database details were suppressed.")
        return {
            "success": False,
            "executed": False,
            "blocked": False,
            "decision": decision,
            "risk_score": decision_meta["risk_score"],
            "reasons": decision_meta["reasons"],
            "remediation": decision_meta["remediation"],
            "factors": decision_meta["factors"],
            "columns": [],
            "rows": [],
            "row_count": 0,
            "analysis_latency_ms": inspection["analysis_latency_ms"],
            "error": "PostgreSQL query could not be completed.",
        }

    proxy.audit_logger.log_event(
        event_type="PG_QUERY_EXECUTED",
        user=proxy.current_user["username"],
        role=proxy.current_user["role"],
        query=safe_query_label,
        decision=decision,
        risk_score=decision_meta["risk_score"],
        details={"source": "postgresql"},
        executed=True,
        execution_latency_ms=(time.perf_counter() - started) * 1000,
    )
    return {
        "success": True,
        "executed": True,
        "blocked": False,
        "decision": decision,
        "risk_score": decision_meta["risk_score"],
        "reasons": decision_meta["reasons"],
        "remediation": decision_meta["remediation"],
        "factors": decision_meta["factors"],
        "columns": result["columns"],
        "rows": result["rows"],
        "row_count": result["row_count"],
        "truncated": result["truncated"],
        "analysis_latency_ms": inspection["analysis_latency_ms"],
        "execution_latency_ms": round((time.perf_counter() - started) * 1000, 2),
    }
