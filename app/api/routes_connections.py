"""Connection Management API Routes for RECON-X."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/api/connections", tags=["Connections"])

proxy_instance = None


def get_proxy():
    if proxy_instance is None:
        raise HTTPException(status_code=500, detail="Proxy instance not initialized")
    return proxy_instance


class SelectConnectionRequest(BaseModel):
    connection_id: str


class AddConnectionRequest(BaseModel):
    id: str = Field(..., json_schema_extra={"example": "my_postgres_db"})
    name: str = Field(..., json_schema_extra={"example": "External PostgreSQL"})
    engine: str = Field(..., json_schema_extra={"example": "PostgreSQL (Simulation)"})
    sector: str = Field(..., json_schema_extra={"example": "Financial"})
    server_secret: str = Field(..., json_schema_extra={"example": "VaultPassword123!"})
    db_path: Optional[str] = None


@router.get("")
def list_connections(proxy=Depends(get_proxy)):
    return {
        "connections": proxy.db_manager.list_connections_safe(),
        "active_connection_id": proxy.db_manager.active_connection_id
    }


@router.post("/select")
def select_connection(payload: SelectConnectionRequest, proxy=Depends(get_proxy)):
    success = proxy.db_manager.set_active_connection(payload.connection_id)
    if not success:
        raise HTTPException(status_code=404, detail="Connection ID not found")
    active = proxy.db_manager.get_active_connection()
    return {
        "success": True,
        "active_connection": {k: v for k, v in active.items() if k != "server_credentials"}
    }


@router.post("")
def add_connection(payload: AddConnectionRequest, proxy=Depends(get_proxy)):
    if payload.id in proxy.db_manager.connections:
        raise HTTPException(status_code=400, detail="Connection ID already exists")
    created = proxy.db_manager.add_connection(
        conn_id=payload.id,
        name=payload.name,
        engine=payload.engine,
        sector=payload.sector,
        server_secret=payload.server_secret,
        db_path=payload.db_path
    )
    return {"success": True, "connection": created}


@router.post("/{conn_id}/test")
def test_connection(conn_id: str, proxy=Depends(get_proxy)):
    result = proxy.db_manager.test_connection_health(conn_id)
    return result
