"""Security Events API Routes for RECON-X."""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/api/events", tags=["Security Events"])

proxy_instance = None


def get_proxy():
    return proxy_instance


@router.get("")
def list_events(
    decision: Optional[str] = Query(None, description="Filter by decision: BLOCK, WARN, RESTRICT, ALLOW"),
    severity: Optional[str] = Query(None, description="Filter by severity: CRITICAL, HIGH, MEDIUM, LOW"),
    limit: int = Query(50, ge=1, le=200),
    proxy=Depends(get_proxy)
):
    events = proxy.security_events
    if decision:
        events = [e for e in events if e.get("decision") == decision.upper()]
    if severity:
        events = [e for e in events if e.get("severity") == severity.upper()]
    return {
        "total_count": len(events),
        "events": events[:limit]
    }


@router.delete("/clear")
def clear_events(proxy=Depends(get_proxy)):
    proxy.security_events.clear()
    return {"success": True, "message": "Security events cleared."}
