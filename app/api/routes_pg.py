"""
app/api/routes_pg.py
====================
PostgreSQL integration routes for RECON-X.

All endpoints enforce security rules BEFORE touching the database:
- BLOCK decisions from the RECON-X engine prevent any database execution.
- Only SELECT statements reach psycopg.
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
        "error": result["error"],
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
    except PgServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/query")
def pg_query(req: PgQueryRequest):
    """
    Run a SELECT query against the PostgreSQL database.

    Security gate (enforced in this order)
    ----------------------------------------
    1. SQL safety validation (SELECT only, no multiple statements).
    2. RECON-X inference-detection engine analysis.
    3. If decision == BLOCK → execution is PREVENTED. No DB call is made.
    4. If decision == ALLOW / WARN / RESTRICT → execute with row-cap and
       statement-timeout enforced by pg_service.execute_safe_query().

    The password is never logged or returned.
    """
    from app.db.pg_service import PgServiceError, validate_sql

    svc = _get_pg()
    proxy = _get_proxy()

    sql = req.sql.strip()
    session_id = req.session_id or "pg_default"

    # ---- Step 1: SQL format validation (fast, no DB call) ------------------
    try:
        validate_sql(sql)
    except PgServiceError as exc:
        return {
            "success": False,
            "executed": False,
            "decision": "BLOCK",
            "risk_score": 100,
            "reasons": [str(exc)],
            "remediation": "Use a single SELECT statement only.",
            "columns": [],
            "rows": [],
            "row_count": 0,
            "blocked": True,
            "message": f"Query rejected before analysis: {exc}",
        }

    # ---- Step 2: RECON-X security engine analysis --------------------------
    start = time.perf_counter()
    try:
        inspection = proxy.inspect_query(sql, session_id=session_id)
    except Exception as exc:
        logger.error("Security engine error during PG query analysis: %s", exc)
        raise HTTPException(status_code=500, detail="Security analysis failed.")

    decision_meta = inspection["decision"]
    decision = decision_meta["decision"]
    risk_score = decision_meta["risk_score"]
    reasons = decision_meta["reasons"]
    remediation = decision_meta.get("remediation", [])
    factors = decision_meta.get("factors", {})
    analysis_ms = round((time.perf_counter() - start) * 1000, 2)

    # Record in session history for cumulative tracking
    from app.core.parser import ParsedQuery
    parsed = ParsedQuery(sql)
    proxy.engine.record_session_query(
        session_id=session_id,
        query=sql,
        parsed=parsed,
        decision=decision,
        estimated_rows=factors.get("estimated_population_size"),
    )

    # ---- Step 3: BLOCK gate — no DB execution whatsoever -------------------
    if decision == "BLOCK":
        # Log to proxy security events
        proxy._record_security_event(
            event_type="PG_BLOCKED_QUERY_ATTEMPT",
            severity="CRITICAL" if decision_meta.get("canary_triggered") else "HIGH",
            decision="BLOCK",
            risk_score=risk_score,
            query=sql,
            reasons=reasons,
            factors=factors,
        )
        proxy.audit_logger.log_event(
            event_type="PG_QUERY_BLOCKED",
            user=proxy.current_user["username"],
            role=proxy.current_user["role"],
            query=sql,
            decision="BLOCK",
            risk_score=risk_score,
            details={"reasons": reasons, "source": "postgresql"},
            executed=False,
        )
        return {
            "success": False,
            "executed": False,
            "blocked": True,
            "decision": "BLOCK",
            "risk_score": risk_score,
            "reasons": reasons,
            "remediation": remediation,
            "factors": factors,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "analysis_latency_ms": analysis_ms,
            "message": (
                "Execution prohibited: query violated RECON-X security policy. "
                "The PostgreSQL database was NOT accessed."
            ),
        }

    # ---- Step 4: Execute (ALLOW / WARN / RESTRICT) -------------------------
    try:
        result = svc.execute_safe_query(sql)
    except PgServiceError as exc:
        return {
            "success": False,
            "executed": False,
            "decision": decision,
            "risk_score": risk_score,
            "reasons": reasons,
            "remediation": remediation,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "error": str(exc),
            "analysis_latency_ms": analysis_ms,
        }

    # Record warn/restrict events
    if decision in ("WARN", "RESTRICT"):
        proxy._record_security_event(
            event_type="PG_SUSPICIOUS_QUERY" if decision == "WARN" else "PG_RESTRICTED_QUERY",
            severity="MEDIUM" if decision == "WARN" else "HIGH",
            decision=decision,
            risk_score=risk_score,
            query=sql,
            reasons=reasons,
            factors=factors,
        )

    proxy.audit_logger.log_event(
        event_type="PG_QUERY_EXECUTED",
        user=proxy.current_user["username"],
        role=proxy.current_user["role"],
        query=sql,
        decision=decision,
        risk_score=risk_score,
        details={
            "row_count": result["row_count"],
            "truncated": result["truncated"],
            "source": "postgresql",
        },
        executed=True,
    )

    return {
        "success": True,
        "executed": True,
        "blocked": False,
        "decision": decision,
        "risk_score": risk_score,
        "reasons": reasons,
        "remediation": remediation,
        "factors": factors,
        "columns": result["columns"],
        "rows": result["rows"],
        "row_count": result["row_count"],
        "truncated": result["truncated"],
        "analysis_latency_ms": analysis_ms,
    }
