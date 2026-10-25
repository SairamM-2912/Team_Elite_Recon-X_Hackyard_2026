"""Query History API Routes for RECON-X."""
from fastapi import APIRouter, Depends, Query
from typing import Optional

router = APIRouter(prefix="/api/history", tags=["Query History"])

proxy_instance = None


def get_proxy():
    return proxy_instance


@router.get("")
def get_query_history(
    session_id: str = Query("default_session"),
    proxy=Depends(get_proxy)
):
    history = proxy.engine.get_session_history(session_id)
    return {
        "session_id": session_id,
        "query_count": len(history),
        "history": list(reversed(history))
    }


@router.delete("/clear")
def clear_history(
    session_id: str = Query("default_session"),
    proxy=Depends(get_proxy)
):
    if session_id in proxy.engine.session_histories:
        proxy.engine.session_histories[session_id].clear()
    return {"success": True, "message": f"Query history for session '{session_id}' cleared."}
