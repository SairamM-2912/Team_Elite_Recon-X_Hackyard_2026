"""Authentication & RBAC API Routes for RECON-X."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.core.rbac import PREDEFINED_USERS, ROLE_PERMISSIONS

router = APIRouter(prefix="/api/auth", tags=["Auth & RBAC"])

proxy_instance = None


def get_proxy():
    return proxy_instance


class SwitchUserRequest(BaseModel):
    username: str


@router.get("/me")
def get_current_user(proxy=Depends(get_proxy)):
    user = proxy.current_user
    perms = list(ROLE_PERMISSIONS.get(user["role"], []))
    return {
        "user": user,
        "permissions": perms
    }


@router.post("/switch-role")
def switch_user(payload: SwitchUserRequest, proxy=Depends(get_proxy)):
    user = proxy.switch_user(payload.username)
    perms = list(ROLE_PERMISSIONS.get(user["role"], []))
    return {
        "success": True,
        "user": user,
        "permissions": perms
    }


@router.get("/users")
def list_available_users():
    return {
        "users": PREDEFINED_USERS,
        "role_permissions": {k: list(v) for k, v in ROLE_PERMISSIONS.items()}
    }
