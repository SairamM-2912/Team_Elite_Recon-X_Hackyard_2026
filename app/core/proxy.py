"""RECON-X Core Security Proxy Engine.

Sits between database clients and protected databases.
Inspects queries, evaluates risk against policies, and gates execution.
Guarantees that blocked queries never touch the protected database.
"""
import time
from typing import Dict, List, Any, Optional
from app.core.parser import ParsedQuery
from app.core.engine import SecurityEngine, SecurityDecision
from app.core.diff_privacy import DifferentialPrivacyEngine
from app.core.audit import AuditLogger
from app.core.rbac import check_permission, PREDEFINED_USERS
from app.db.connection import DatabaseConnectionManager


class ReconXProxy:
    def __init__(self):
        self.is_running: bool = True
        self.engine = SecurityEngine(active_policy_id="BALANCED_PRIVACY")
        self.dp_engine = DifferentialPrivacyEngine(default_epsilon=1.0, max_budget=5.0)
        self.audit_logger = AuditLogger()
        self.db_manager = DatabaseConnectionManager()
        
        # Security Events buffer (most recent 200 events)
        self.security_events: List[Dict[str, Any]] = []

        # Current logged in mock session (can be switched via RBAC switcher)
        self.current_user = dict(PREDEFINED_USERS[0])  # admin default

        # Prepopulate with a startup log
        self.audit_logger.log_event(
            event_type="PROXY_STARTUP",
            user=self.current_user["username"],
            role=self.current_user["role"],
            query="SYSTEM_INIT",
            decision="ALLOW",
            risk_score=0,
            details={"status": "INITIALIZED", "active_connection": "healthcare", "policy": "BALANCED_PRIVACY"}
        )

    def set_running(self, running: bool):
        self.is_running = running
        self.audit_logger.log_event(
            event_type="PROXY_STATE_CHANGE",
            user=self.current_user["username"],
            role=self.current_user["role"],
            query="N/A",
            decision="ALLOW",
            risk_score=10 if not running else 0,
            details={"new_state": "RUNNING" if running else "STOPPED"}
        )

    def switch_user(self, username: str) -> Dict[str, Any]:
        for u in PREDEFINED_USERS:
            if u["username"] == username:
                self.current_user = dict(u)
                return self.current_user
        # Fallback to custom
        self.current_user = {"username": username, "role": "data_scientist", "department": "General Analytics"}
        return self.current_user

    def get_proxy_status(self) -> Dict[str, Any]:
        active_conn = self.db_manager.get_active_connection()
        policy = self.engine.current_policy
        return {
            "proxy_running": self.is_running,
            "active_connection": {
                "id": active_conn["id"],
                "name": active_conn["name"],
                "engine": active_conn["engine"],
                "sector": active_conn["sector"],
                "status": active_conn["status"],
                "tls_enabled": active_conn["tls_enabled"],
                "latency_ms": active_conn["latency_ms"],
                "is_simulation": active_conn.get("is_simulation", False),
                "simulation_label": active_conn.get("simulation_label")
            },
            "active_policy": {
                "id": policy["id"],
                "name": policy["name"],
                "min_cell_size": policy["min_cell_size"],
                "epsilon_budget_max": policy["epsilon_budget_max"]
            },
            "authenticated_user": self.current_user,
            "events_count": len(self.security_events),
            "blocked_count": sum(1 for e in self.security_events if e.get("decision") == "BLOCK"),
            "audit_logs_count": len(self.audit_logger.logs)
        }

    def inspect_query(self, query: str, session_id: str = "default_session") -> Dict[str, Any]:
        """Deep analysis of query without database execution."""
        start = time.perf_counter()
        parsed = ParsedQuery(query)
        
        # Bind row estimator to active DB
        row_estimator = self.db_manager.estimate_row_count
        
        decision = self.engine.analyze_query(
            query=query,
            user_role=self.current_user["role"],
            session_id=session_id,
            db_row_estimator=row_estimator
        )
        latency_ms = round((time.perf_counter() - start) * 1000, 2)

        return {
            "query": query,
            "parsed": parsed.to_dict(),
            "decision": decision.to_dict(),
            "analysis_latency_ms": latency_ms,
            "user": self.current_user["username"],
            "role": self.current_user["role"],
            "policy_id": self.engine.active_policy_id
        }

    def execute_query(self, query: str, session_id: str = "default_session", max_rows: int = 50) -> Dict[str, Any]:
        """Inspect and enforce policy before executing query against protected database."""
        if not self.is_running:
            return {
                "success": False,
                "error": "RECON-X Security Proxy is currently STOPPED. Resume proxy to process queries.",
                "status_code": 503,
                "decision": "BLOCK"
            }

        # RBAC Check
        if not check_permission(self.current_user["role"], "proxy:execute"):
            return {
                "success": False,
                "error": f"Role '{self.current_user['role']}' does not have 'proxy:execute' permission.",
                "status_code": 403,
                "decision": "BLOCK"
            }

        # Step 1: Deep Security Inspection
        inspection = self.inspect_query(query, session_id=session_id)
        decision_meta = inspection["decision"]
        decision = decision_meta["decision"]
        risk_score = decision_meta["risk_score"]
        parsed = ParsedQuery(query)

        # Record in session history
        self.engine.record_session_query(
            session_id=session_id,
            query=query,
            parsed=parsed,
            decision=decision,
            estimated_rows=decision_meta.get("factors", {}).get("estimated_population_size")
        )

        # Step 2: Enforcement Gate
        if decision == "BLOCK":
            # STRICT REQUIREMENT: BLOCKED queries MUST NEVER touch the protected database!
            event = self._record_security_event(
                event_type="BLOCKED_QUERY_ATTEMPT",
                severity="CRITICAL" if decision_meta.get("canary_triggered") else "HIGH",
                decision=decision,
                risk_score=risk_score,
                query=query,
                reasons=decision_meta["reasons"],
                factors=decision_meta["factors"]
            )
            self.audit_logger.log_event(
                event_type="QUERY_BLOCKED",
                user=self.current_user["username"],
                role=self.current_user["role"],
                query=query,
                decision="BLOCK",
                risk_score=risk_score,
                details={"reasons": decision_meta["reasons"], "event_id": event["id"]},
                executed=False
            )
            return {
                "success": False,
                "blocked": True,
                "decision": "BLOCK",
                "risk_score": risk_score,
                "reasons": decision_meta["reasons"],
                "remediation": decision_meta["remediation"],
                "factors": decision_meta["factors"],
                "columns": [],
                "rows": [],
                "row_count": 0,
                "executed": False,
                "message": "Execution Prohibited: Query violated security policy. Upstream database access was strictly prevented."
            }

        # Step 3: Allowed / Warned / Restricted Execution
        columns, raw_rows, exec_latency = self.db_manager.execute_query_safely(query, max_rows=max_rows)
        if columns == ["error"]:
            err_msg = raw_rows[0].get("error", "Database execution error")
            return {
                "success": False,
                "error": err_msg,
                "decision": decision,
                "risk_score": risk_score,
                "reasons": decision_meta["reasons"],
                "remediation": decision_meta["remediation"],
                "columns": [],
                "rows": [],
                "row_count": 0,
                "executed": False,
                "execution_latency_ms": exec_latency
            }
        final_rows = raw_rows
        dp_applied = None

        # Apply Differential Privacy if RESTRICT or policy requires
        if decision == "RESTRICT" or decision_meta.get("requires_diff_privacy"):
            # Check if query produced aggregate numbers that we can perturb
            if parsed.aggregates and final_rows and len(final_rows) == 1:
                perturbed_row = {}
                row_data = final_rows[0]
                for col_name, val in row_data.items():
                    if isinstance(val, (int, float)):
                        # Match function name
                        func = "COUNT"
                        for agg in parsed.aggregates:
                            if agg["func"] in ("SUM", "AVG", "COUNT"):
                                func = agg["func"]
                                break
                        dp_result = self.dp_engine.perturb_aggregate(
                            func_name=func,
                            true_value=float(val),
                            epsilon=self.engine.current_policy.get("default_epsilon", 0.5)
                        )
                        perturbed_row[col_name] = dp_result["perturbed_value"]
                        dp_applied = dp_result
                        self.dp_engine.spend_budget(session_id, dp_result["epsilon"])
                    else:
                        perturbed_row[col_name] = val
                final_rows = [perturbed_row]
            else:
                # Column Masking for raw data under RESTRICT
                masked_rows = []
                for r in final_rows:
                    m_row = dict(r)
                    for k in m_row:
                        k_lower = k.lower()
                        if any(s in k_lower for s in ("ssn", "card", "password", "balance", "salary")):
                            val_str = str(m_row[k])
                            m_row[k] = val_str[:2] + "****" + val_str[-2:] if len(val_str) > 4 else "****"
                    masked_rows.append(m_row)
                final_rows = masked_rows

        # Record Security Event if WARN or RESTRICT
        if decision in ("WARN", "RESTRICT"):
            event = self._record_security_event(
                event_type="SUSPICIOUS_QUERY_PERMITTED" if decision == "WARN" else "RESTRICTED_QUERY_EXECUTED",
                severity="MEDIUM" if decision == "WARN" else "HIGH",
                decision=decision,
                risk_score=risk_score,
                query=query,
                reasons=decision_meta["reasons"],
                factors=decision_meta["factors"]
            )

        # Log into Audit Logger
        self.audit_logger.log_event(
            event_type="QUERY_EXECUTION",
            user=self.current_user["username"],
            role=self.current_user["role"],
            query=query,
            decision=decision,
            risk_score=risk_score,
            details={
                "row_count": len(final_rows),
                "dp_applied": dp_applied,
                "reasons": decision_meta["reasons"]
            },
            executed=True,
            execution_latency_ms=exec_latency
        )

        return {
            "success": True,
            "blocked": False,
            "decision": decision,
            "risk_score": risk_score,
            "reasons": decision_meta["reasons"],
            "remediation": decision_meta["remediation"],
            "factors": decision_meta["factors"],
            "columns": columns,
            "rows": final_rows,
            "row_count": len(final_rows),
            "executed": True,
            "execution_latency_ms": exec_latency,
            "differential_privacy": dp_applied
        }

    def _record_security_event(
        self,
        event_type: str,
        severity: str,
        decision: str,
        risk_score: int,
        query: str,
        reasons: List[str],
        factors: Dict[str, Any]
    ) -> Dict[str, Any]:
        event = {
            "id": f"EVT-{len(self.security_events) + 1001}",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
            "event_type": event_type,
            "severity": severity,
            "decision": decision,
            "risk_score": risk_score,
            "user": self.current_user["username"],
            "role": self.current_user["role"],
            "database": self.db_manager.active_connection_id,
            "query": query,
            "reasons": reasons,
            "factors": factors
        }
        self.security_events.insert(0, event)
        if len(self.security_events) > 200:
            self.security_events.pop()
        return event
