"""Proxy API Routes for Inspection, Execution, State, and Attack Scenarios."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/api/proxy", tags=["Security Proxy"])

# Global proxy instance reference set by main.py
proxy_instance = None


def get_proxy():
    if proxy_instance is None:
        raise HTTPException(status_code=500, detail="Proxy instance not initialized")
    return proxy_instance


class ToggleProxyRequest(BaseModel):
    running: bool


class QueryRequest(BaseModel):
    query: str = Field(..., json_schema_extra={"example": "SELECT * FROM patients WHERE ssn = '345-21-9876'"})
    session_id: Optional[str] = "default_session"
    max_rows: Optional[int] = 50


# Pre-configured demonstration scenarios
DEMO_SCENARIOS = [
    {
        "id": "scenario_normal",
        "title": "Baseline Compliant Query (ALLOW)",
        "sector": "healthcare",
        "category": "Compliant",
        "expected_decision": "ALLOW",
        "query": "SELECT gender, city FROM patients WHERE city = 'San Francisco';",
        "description": "Standard demographic query without individual singling-out or critical PII exposure."
    },
    {
        "id": "scenario_canary",
        "title": "Canary Honeypot Trigger (BLOCK)",
        "sector": "healthcare",
        "category": "Canary Data Trap",
        "expected_decision": "BLOCK",
        "query": "SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';",
        "description": "Touches synthetic decoy record 'Jane Doe Canary'. Triggers immediate critical SOC alert and blocks execution."
    },
    {
        "id": "scenario_differencing_1",
        "title": "Differencing Attack - Step 1 (ALLOW)",
        "sector": "corporate_hr",
        "category": "Differencing Reconstruction",
        "expected_decision": "ALLOW",
        "query": "SELECT SUM(salary) FROM employees WHERE department = 'Engineering';",
        "description": "Step 1: Compute total salary for entire Engineering cohort (10 employees)."
    },
    {
        "id": "scenario_differencing_2",
        "title": "Differencing Attack - Step 2 (BLOCK / RESTRICT)",
        "sector": "corporate_hr",
        "category": "Differencing Reconstruction",
        "expected_decision": "BLOCK",
        "query": "SELECT SUM(salary) FROM employees WHERE department = 'Engineering' AND emp_id != 'EMP-104';",
        "description": "Step 2: Same aggregate excluding single individual (EMP-104). Subtracting Step 2 from Step 1 reveals exact salary. Proxy flags Differencing Attack."
    },
    {
        "id": "scenario_narrowing",
        "title": "Population Narrowing k=1 Singling-Out (BLOCK)",
        "sector": "banking",
        "category": "Singling-Out Attack",
        "expected_decision": "BLOCK",
        "query": "SELECT customer_name, balance FROM accounts WHERE branch = 'Downtown SF' AND credit_score > 820;",
        "description": "Applies high-selectivity predicates that isolate exactly 1 individual in the banking dataset."
    },
    {
        "id": "scenario_dp_restrict",
        "title": "Aggregate with Differential Privacy (RESTRICT)",
        "sector": "corporate_hr",
        "category": "Differential Privacy",
        "expected_decision": "RESTRICT",
        "query": "SELECT AVG(salary) FROM employees WHERE department = 'Engineering';",
        "description": "Computes statistical average. Under strict/balanced privacy, Laplace noise is added to protect individual values."
    }
]


@router.get("/status")
def get_status(proxy=Depends(get_proxy)):
    return proxy.get_proxy_status()


@router.post("/toggle")
def toggle_proxy(payload: ToggleProxyRequest, proxy=Depends(get_proxy)):
    proxy.set_running(payload.running)
    return {"proxy_running": proxy.is_running}


@router.post("/inspect")
def inspect_query(payload: QueryRequest, proxy=Depends(get_proxy)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return proxy.inspect_query(payload.query, session_id=payload.session_id)


@router.post("/execute")
def execute_query(payload: QueryRequest, proxy=Depends(get_proxy)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return proxy.execute_query(payload.query, session_id=payload.session_id, max_rows=payload.max_rows)


@router.get("/scenarios")
def get_scenarios():
    return DEMO_SCENARIOS
