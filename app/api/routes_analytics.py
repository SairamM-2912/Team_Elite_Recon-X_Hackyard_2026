"""Analytics and Secondary Investigation API Routes for RECON-X."""
from fastapi import APIRouter, Depends
from typing import Dict, Any, List

router = APIRouter(prefix="/api/analytics", tags=["Investigation & Analytics"])

proxy_instance = None


def get_proxy():
    return proxy_instance


@router.get("/investigation")
def get_investigation_analytics(proxy=Depends(get_proxy)):
    events = proxy.security_events
    audit_logs = proxy.audit_logger.logs

    # Decision counts
    decision_counts = {"ALLOW": 0, "WARN": 0, "RESTRICT": 0, "BLOCK": 0}
    for log in audit_logs:
        dec = log.get("decision", "ALLOW")
        if dec in decision_counts:
            decision_counts[dec] += 1

    # Attack vectors breakdown
    attack_vectors = {
        "Canary Honeypot Trips": sum(1 for e in events if e.get("factors", {}).get("canary_tripwire")),
        "Differencing Attacks": sum(1 for e in events if e.get("factors", {}).get("differencing_attack")),
        "Progressive Filtering": sum(1 for e in events if e.get("factors", {}).get("progressive_filtering")),
        "Population Narrowing": sum(1 for e in events if e.get("factors", {}).get("population_narrowing")),
        "Role Mismatch": sum(1 for e in events if e.get("factors", {}).get("role_privilege_mismatch"))
    }

    # Risk score distribution
    risk_distribution = {
        "Low (0-30)": sum(1 for l in audit_logs if l.get("risk_score", 0) <= 30),
        "Moderate (31-60)": sum(1 for l in audit_logs if 30 < l.get("risk_score", 0) <= 60),
        "High (61-79)": sum(1 for l in audit_logs if 60 < l.get("risk_score", 0) <= 79),
        "Critical (80-100)": sum(1 for l in audit_logs if l.get("risk_score", 0) >= 80)
    }

    # DP Budget stats
    dp_spent = proxy.dp_engine.get_session_budget_spent("default_session")
    max_budget = proxy.dp_engine.max_budget

    return {
        "summary": {
            "total_queries_analyzed": len(audit_logs),
            "total_security_events": len(events),
            "blocked_attacks": decision_counts["BLOCK"],
            "dp_budget_spent": dp_spent,
            "dp_budget_max": max_budget,
            "dp_budget_percent": round((dp_spent / max_budget) * 100, 1) if max_budget > 0 else 0
        },
        "decision_breakdown": decision_counts,
        "attack_vectors": attack_vectors,
        "risk_distribution": risk_distribution
    }
