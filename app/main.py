"""FastAPI Application Entry Point for RECON-X Security Proxy."""
import base64
import hmac
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env (if present) before anything else — never overrides real env vars
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from app.config import (
    AUTH_ENABLED,
    AUTH_PASSWORD,
    AUTH_USERNAME,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL,
    get_cors_origins,
)

from app.core.proxy import ReconXProxy
from app.db.seed_data import init_all_databases
from app.db.pg_service import PgService
from app.api import (
    routes_proxy,
    routes_connections,
    routes_events,
    routes_history,
    routes_policies,
    routes_audit,
    routes_auth,
    routes_datasets,
    routes_analytics,
    routes_pg,
)

# Initialize application
app = FastAPI(
    title="RECON-X Database Security Proxy",
    description="Lightweight Database Security Proxy for Inference Detection and Policy Enforcement",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
)

# Create missing SQLite tables without replacing existing data.
init_all_databases()

# Create single orchestrator instance
recon_proxy = ReconXProxy()

# Wire proxy instance into route modules
routes_proxy.proxy_instance = recon_proxy
routes_connections.proxy_instance = recon_proxy
routes_events.proxy_instance = recon_proxy
routes_history.proxy_instance = recon_proxy
routes_policies.proxy_instance = recon_proxy
routes_audit.proxy_instance = recon_proxy
routes_auth.proxy_instance = recon_proxy
routes_datasets.proxy_instance = recon_proxy
routes_analytics.proxy_instance = recon_proxy

# PostgreSQL integration service
pg_svc = PgService()
routes_pg.pg_service = pg_svc
routes_pg.proxy_instance = recon_proxy

# Register Routers
app.include_router(routes_proxy.router)
app.include_router(routes_connections.router)
app.include_router(routes_events.router)
app.include_router(routes_history.router)
app.include_router(routes_policies.router)
app.include_router(routes_audit.router)
app.include_router(routes_auth.router)
app.include_router(routes_datasets.router)
app.include_router(routes_analytics.router)
app.include_router(routes_pg.router)

# Mount Static directory
static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.middleware("http")
async def require_production_auth(request, call_next):
    if (
        not AUTH_ENABLED
        or request.url.path == "/health"
        or request.method == "OPTIONS"
    ):
        return await call_next(request)

    scheme, separator, encoded_credentials = request.headers.get(
        "authorization", ""
    ).partition(" ")
    authenticated = False
    if separator and scheme.lower() == "basic" and len(encoded_credentials) <= 4096:
        try:
            decoded = base64.b64decode(encoded_credentials, validate=True).decode(
                "utf-8"
            )
            username, separator, password = decoded.partition(":")
            authenticated = (
                bool(separator)
                and hmac.compare_digest(username.encode(), AUTH_USERNAME.encode())
                and hmac.compare_digest(password.encode(), AUTH_PASSWORD.encode())
            )
        except (ValueError, UnicodeDecodeError):
            authenticated = False

    if not authenticated:
        return Response(
            status_code=401,
            headers={
                "WWW-Authenticate": 'Basic realm="RECON-X"',
                "Cache-Control": "no-store",
            },
        )
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "proxy_running": recon_proxy.is_running,
        "active_database": recon_proxy.db_manager.active_connection_id,
        "active_policy": recon_proxy.engine.active_policy_id
    }


@app.get("/api/public-config.js")
def public_frontend_config():
    """Expose only Supabase's browser-safe project URL and publishable key."""
    config = {
        "url": SUPABASE_URL,
        "publishableKey": SUPABASE_PUBLISHABLE_KEY,
    }
    return Response(
        content=f"window.SUPABASE_CONFIG = {json.dumps(config)};",
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/shop")
def serve_shop():
    shop_file = static_dir / "shop.html"
    if os.path.exists(shop_file):
        return FileResponse(shop_file)
    return {"message": "Shop page not found."}


@app.get("/")
def serve_dashboard():
    return FileResponse(static_dir / "index.html")


@app.get("/dashboard")
def serve_dashboard_alias():
    return FileResponse(static_dir / "index.html")


@app.get("/intro")
def serve_intro_alias():
    return FileResponse(static_dir / "intro.html")
