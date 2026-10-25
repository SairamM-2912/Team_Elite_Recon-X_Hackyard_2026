"""Security Policies API Routes for RECON-X."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/policies", tags=["Policies"])

proxy_instance = None


def get_proxy():
    return proxy_instance


class SelectPolicyRequest(BaseModel):
    policy_id: str


class UpdatePolicyRequest(BaseModel):
    name: Optional[str] = None
    min_cell_size: Optional[int] = None
    differencing_threshold: Optional[float] = None
    progressive_filter_depth: Optional[int] = None
    differential_privacy_required: Optional[bool] = None
    default_epsilon: Optional[float] = None
    block_unauthorized_pii: Optional[bool] = None
    block_canary_touch: Optional[bool] = None


@router.get("")
def list_policies(proxy=Depends(get_proxy)):
    return {
        "active_policy_id": proxy.engine.active_policy_id,
        "policies": list(proxy.engine.policies.values())
    }


@router.post("/select")
def select_policy(payload: SelectPolicyRequest, proxy=Depends(get_proxy)):
    if payload.policy_id not in proxy.engine.policies:
        raise HTTPException(status_code=404, detail="Policy ID not found")
    proxy.engine.set_policy(payload.policy_id)
    return {
        "success": True,
        "active_policy": proxy.engine.current_policy
    }


@router.put("/{policy_id}")
def update_policy(policy_id: str, payload: UpdatePolicyRequest, proxy=Depends(get_proxy)):
    if policy_id not in proxy.engine.policies:
        raise HTTPException(status_code=404, detail="Policy ID not found")
    policy = proxy.engine.policies[policy_id]
    update_data = payload.dict(exclude_unset=True)
    policy.update(update_data)
    return {"success": True, "policy": policy}
