"""FastAPI Application Entry Point for RECON-X Security Proxy."""
import os
from dotenv import load_dotenv

# Load .env (if present) before anything else — never overrides real env vars
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

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

# Enable CORS for local client tools
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize backend database seeds
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
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "proxy_running": recon_proxy.is_running,
        "active_database": recon_proxy.db_manager.active_connection_id,
        "active_policy": recon_proxy.engine.active_policy_id
    }


@app.get("/shop")
def serve_shop():
    shop_file = os.path.join(static_dir, "shop.html")
    if os.path.exists(shop_file):
        return FileResponse(shop_file)
    return {"message": "Shop page not found."}


@app.get("/")
def serve_intro():
    intro_file = os.path.join(static_dir, "intro.html")
    if os.path.exists(intro_file):
        return FileResponse(intro_file)
    index_file = os.path.join(static_dir, "index.html")
    return FileResponse(index_file)


@app.get("/dashboard")
def serve_dashboard():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "RECON-X Proxy Dashboard not found."}


@app.get("/intro")
def serve_intro_alias():
    intro_file = os.path.join(static_dir, "intro.html")
    if os.path.exists(intro_file):
        return FileResponse(intro_file)
    return {"message": "RECON-X Intro page not found."}

