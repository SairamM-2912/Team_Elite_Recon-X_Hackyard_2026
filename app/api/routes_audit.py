"""Audit Logs API Routes for RECON-X."""
import csv
import io
import json
from fastapi import APIRouter, Depends, Query, Response
from typing import Optional

router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])

proxy_instance = None


def get_proxy():
    return proxy_instance


@router.get("")
def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    decision: Optional[str] = Query(None),
    proxy=Depends(get_proxy)
):
    logs = proxy.audit_logger.get_logs(limit=limit, filter_decision=decision)
    return {
        "total_records": len(proxy.audit_logger.logs),
        "returned_records": len(logs),
        "logs": logs
    }


@router.get("/verify")
def verify_audit_integrity(proxy=Depends(get_proxy)):
    result = proxy.audit_logger.verify_integrity()
    return result


@router.get("/export")
def export_audit_logs(
    format: str = Query("json", pattern="^(json|csv)$"),
    proxy=Depends(get_proxy)
):
    logs = proxy.audit_logger.logs
    if format == "json":
        content = json.dumps(logs, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=recon_x_audit_logs.json"}
        )
    else:
        output = io.StringIO()
        fieldnames = ["id", "timestamp", "user", "role", "event_type", "decision", "risk_score", "executed", "latency_ms", "query", "record_hash"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for log in logs:
            writer.writerow(log)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=recon_x_audit_logs.csv"}
        )
