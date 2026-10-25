"""Database Connection Manager and Safe Execution Engine for RECON-X.

Provides pooled access to active SQLite databases and server-side credential vault.
Never exposes credentials in logs or serialized JSON responses.
"""
import sqlite3
import time
import os
from typing import Dict, List, Any, Optional, Tuple
from app.db.seed_data import DB_PATHS, init_all_databases


class DatabaseConnectionManager:
    def __init__(self):
        # Initialize databases if not present
        if not os.path.exists(DB_PATHS["healthcare"]):
            init_all_databases()

        # Connection registry
        self.connections: Dict[str, Dict[str, Any]] = {
            "healthcare": {
                "id": "healthcare",
                "name": "Production Healthcare EHR (Protected)",
                "engine": "SQLite",
                "sector": "Healthcare",
                "db_path": DB_PATHS["healthcare"],
                "status": "ONLINE",
                "is_simulation": False,
                "tls_enabled": True,
                "latency_ms": 1.2,
                "active_pool_size": 5,
                "server_credentials": {"auth_token": "hc_vault_token_9918"}  # Stored server-side only
            },
            "banking": {
                "id": "banking",
                "name": "Core Banking & Transactions DB",
                "engine": "SQLite",
                "sector": "Banking",
                "db_path": DB_PATHS["banking"],
                "status": "ONLINE",
                "is_simulation": False,
                "tls_enabled": True,
                "latency_ms": 1.8,
                "active_pool_size": 8,
                "server_credentials": {"auth_token": "bnk_vault_token_4412"}
            },
            "corporate_hr": {
                "id": "corporate_hr",
                "name": "Global Corporate HR & Payroll",
                "engine": "SQLite",
                "sector": "Corporate HR",
                "db_path": DB_PATHS["corporate_hr"],
                "status": "ONLINE",
                "is_simulation": False,
                "tls_enabled": True,
                "latency_ms": 0.9,
                "active_pool_size": 4,
                "server_credentials": {"auth_token": "hr_vault_token_3182"}
            },
            "retail": {
                "id": "retail",
                "name": "E-Commerce Customer & Orders",
                "engine": "SQLite",
                "sector": "Business",
                "db_path": DB_PATHS["retail"],
                "status": "ONLINE",
                "is_simulation": False,
                "tls_enabled": True,
                "latency_ms": 1.4,
                "active_pool_size": 6,
                "server_credentials": {"auth_token": "ret_vault_token_7761"}
            },
            "upstream_pg_demo": {
                "id": "upstream_pg_demo",
                "name": "Upstream PostgreSQL 16 (Demo Connector)",
                "engine": "PostgreSQL (Simulation)",
                "sector": "Enterprise Upstream",
                "db_path": None,
                "status": "STANDBY",
                "is_simulation": True,
                "simulation_label": "Demo Simulated Connector",
                "tls_enabled": True,
                "latency_ms": 14.5,
                "active_pool_size": 0,
                "server_credentials": {"user": "recon_proxy", "secret_pass": "SuperSecretDbPassword123!"}
            }
        }
        self.active_connection_id = "healthcare"

    def get_active_connection(self) -> Dict[str, Any]:
        return self.connections.get(self.active_connection_id, self.connections["healthcare"])

    def set_active_connection(self, conn_id: str) -> bool:
        if conn_id in self.connections:
            self.active_connection_id = conn_id
            return True
        return False

    def list_connections_safe(self) -> List[Dict[str, Any]]:
        """Return connection metadata without exposing server credentials."""
        safe_list = []
        for c in self.connections.values():
            safe_c = {k: v for k, v in c.items() if k != "server_credentials"}
            safe_c["is_active"] = (c["id"] == self.active_connection_id)
            safe_c["credentials_configured"] = bool(c.get("server_credentials"))
            safe_list.append(safe_c)
        return safe_list

    def add_connection(
        self,
        conn_id: str,
        name: str,
        engine: str,
        sector: str,
        server_secret: str,
        db_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Safely register a new connection with server-side credential vaulting."""
        new_conn = {
            "id": conn_id,
            "name": name,
            "engine": engine,
            "sector": sector,
            "db_path": db_path,
            "status": "ONLINE" if (db_path and os.path.exists(db_path)) else "STANDBY",
            "is_simulation": "simulation" in engine.lower() or not db_path,
            "tls_enabled": True,
            "latency_ms": 2.5,
            "active_pool_size": 2,
            "server_credentials": {"secret": server_secret}
        }
        self.connections[conn_id] = new_conn
        return {k: v for k, v in new_conn.items() if k != "server_credentials"}

    def test_connection_health(self, conn_id: str) -> Dict[str, Any]:
        """Probe connection health and measure latency."""
        conn = self.connections.get(conn_id)
        if not conn:
            return {"healthy": False, "error": "Connection profile not found"}

        start = time.perf_counter()
        if not conn.get("is_simulation") and conn.get("db_path"):
            try:
                db_path = conn["db_path"]
                c = sqlite3.connect(db_path, timeout=2.0)
                cur = c.cursor()
                cur.execute("SELECT 1")
                cur.fetchone()
                c.close()
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                conn["latency_ms"] = elapsed_ms
                conn["status"] = "ONLINE"
                return {
                    "healthy": True,
                    "latency_ms": elapsed_ms,
                    "status": "ONLINE",
                    "engine": conn["engine"],
                    "tls_enabled": conn["tls_enabled"],
                    "is_simulation": False
                }
            except Exception as e:
                conn["status"] = "ERROR"
                return {"healthy": False, "error": str(e), "status": "ERROR"}
        else:
            # Simulated probe for external upstream
            elapsed_ms = round((time.perf_counter() - start) * 1000 + 12.4, 2)
            conn["latency_ms"] = elapsed_ms
            return {
                "healthy": True,
                "latency_ms": elapsed_ms,
                "status": "ONLINE (STANDBY)",
                "engine": conn["engine"],
                "tls_enabled": conn["tls_enabled"],
                "is_simulation": True,
                "simulation_label": "Demo Simulated Connector"
            }

    def estimate_row_count(self, query: str) -> Optional[int]:
        """Estimate the population size of the query using a temporary COUNT wrapper."""
        conn_meta = self.get_active_connection()
        if conn_meta.get("is_simulation") or not conn_meta.get("db_path"):
            # Fallback estimation for simulation
            return 12

        db_path = conn_meta["db_path"]
        try:
            c = sqlite3.connect(db_path, timeout=2.0)
            cur = c.cursor()
            # Clean query and strip semicolon
            clean = query.strip().rstrip(";")
            count_sql = f"SELECT COUNT(*) FROM ({clean}) AS sub_est"
            cur.execute(count_sql)
            row = cur.fetchone()
            c.close()
            return row[0] if row else None
        except Exception:
            return None

    def execute_query_safely(
        self,
        query: str,
        max_rows: int = 100
    ) -> Tuple[List[str], List[Dict[str, Any]], float]:
        """Execute query strictly against active database and return columns, rows, latency."""
        conn_meta = self.get_active_connection()
        if conn_meta.get("is_simulation") or not conn_meta.get("db_path"):
            # Return demo simulated results
            return (
                ["status", "message"],
                [{"status": "SIMULATED", "message": "Demo upstream simulation executed successfully."}],
                14.2
            )

        db_path = conn_meta["db_path"]
        start = time.perf_counter()
        c = sqlite3.connect(db_path, timeout=5.0)
        c.row_factory = sqlite3.Row
        cur = c.cursor()

        try:
            cur.execute(query)
            if cur.description:
                columns = [col[0] for col in cur.description]
                rows = [dict(row) for row in cur.fetchmany(max_rows)]
            else:
                columns = ["affected_rows"]
                rows = [{"affected_rows": cur.rowcount}]
            c.commit()
        except sqlite3.Error as e:
            columns = ["error"]
            rows = [{"error": f"Database Execution Error: {str(e)}"}]
        finally:
            c.close()

        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return columns, rows, latency_ms
