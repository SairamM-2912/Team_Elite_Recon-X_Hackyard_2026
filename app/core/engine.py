"""RECON-X Core Security & Inference Detection Engine.

Detects:
- Differencing reconstruction attacks
- Progressive filtering sequences
- Population narrowing (small cell / k-anonymity violations)
- Cumulative low-and-slow tracking
- Canary honeytoken data traps
- Contextual intent & role-based privilege violations
- Multi-factor risk scoring (0-100) & policy enforcement
"""
import time
from typing import Dict, List, Any, Optional, Set
from app.config import DEFAULT_POLICIES, SENSITIVE_COLUMNS, CANARY_IDENTIFIERS
from app.core.parser import ParsedQuery


class SecurityDecision:
    def __init__(
        self,
        decision: str,  # ALLOW, WARN, RESTRICT, BLOCK
        risk_score: int,  # 0 to 100
        reasons: List[str],
        factors: Dict[str, Any],
        remediation: str,
        differencing_match: Optional[Dict[str, Any]] = None,
        canary_triggered: bool = False,
        requires_diff_privacy: bool = False
    ):
        self.decision = decision
        self.risk_score = risk_score
        self.reasons = reasons
        self.factors = factors
        self.remediation = remediation
        self.differencing_match = differencing_match
        self.canary_triggered = canary_triggered
        self.requires_diff_privacy = requires_diff_privacy

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision,
            "risk_score": self.risk_score,
            "reasons": self.reasons,
            "factors": self.factors,
            "remediation": self.remediation,
            "differencing_match": self.differencing_match,
            "canary_triggered": self.canary_triggered,
            "requires_diff_privacy": self.requires_diff_privacy
        }


class SessionQueryRecord:
    def __init__(self, query: str, parsed: ParsedQuery, timestamp: float, decision: str, estimated_rows: Optional[int] = None):
        self.query = query
        self.parsed = parsed
        self.timestamp = timestamp
        self.decision = decision
        self.estimated_rows = estimated_rows


class SecurityEngine:
    def __init__(self, active_policy_id: str = "BALANCED_PRIVACY"):
        self.policies = dict(DEFAULT_POLICIES)
        self.active_policy_id = active_policy_id
        # session_id -> list of SessionQueryRecord
        self.session_histories: Dict[str, List[SessionQueryRecord]] = {}

    @property
    def current_policy(self) -> Dict[str, Any]:
        return self.policies.get(self.active_policy_id, self.policies["BALANCED_PRIVACY"])

    def set_policy(self, policy_id: str):
        if policy_id in self.policies:
            self.active_policy_id = policy_id

    def get_session_history(self, session_id: str) -> List[Dict[str, Any]]:
        records = self.session_histories.get(session_id, [])
        return [
            {
                "query": r.query,
                "timestamp": r.timestamp,
                "decision": r.decision,
                "tables": r.parsed.tables,
                "columns": r.parsed.columns,
                "predicates": [p.get("raw", "") for p in r.parsed.predicates],
                "aggregates": r.parsed.aggregates,
                "estimated_rows": r.estimated_rows
            }
            for r in records
        ]

    def record_session_query(self, session_id: str, query: str, parsed: ParsedQuery, decision: str, estimated_rows: Optional[int] = None):
        if session_id not in self.session_histories:
            self.session_histories[session_id] = []
        self.session_histories[session_id].append(
            SessionQueryRecord(query, parsed, time.time(), decision, estimated_rows)
        )
        # Cap session history at 50 queries to prevent unbounded memory growth
        if len(self.session_histories[session_id]) > 50:
            self.session_histories[session_id] = self.session_histories[session_id][-50:]

    def analyze_query(
        self,
        query: str,
        user_role: str = "data_scientist",
        session_id: str = "default_session",
        db_row_estimator: Optional[Any] = None
    ) -> SecurityDecision:
        parsed = ParsedQuery(query)
        policy = self.current_policy
        reasons: List[str] = []
        factors: Dict[str, Any] = {
            "canary_tripwire": False,
            "differencing_attack": False,
            "progressive_filtering": False,
            "population_narrowing": False,
            "sensitive_columns_accessed": [],
            "low_and_slow_exposure": False,
            "non_select_modification": False,
            "role_privilege_mismatch": False
        }
        score = 0
        differencing_match_info = None
        canary_triggered = False

        # 1. Non-SELECT check
        if parsed.statement_type not in ("SELECT", "WITH", "EMPTY"):
            factors["non_select_modification"] = True
            if user_role not in ("admin", "security_analyst"):
                reasons.append(f"Modification query ({parsed.statement_type}) unauthorized for role '{user_role}'.")
                score += 85
            else:
                reasons.append(f"Administrative modification query ({parsed.statement_type}) detected.")
                score += 40

        # 2. Canary Data Trap Inspection
        if parsed.canary_hits:
            canary_triggered = True
            factors["canary_tripwire"] = True
            matched = ", ".join(parsed.canary_hits)
            reasons.append(f"CRITICAL: Canary honeytoken detected in query predicates: [{matched}]. Immediate tripwire triggered.")
            score += 90

        # 3. Sensitive Column Access
        if parsed.sensitive_columns:
            col_names = [f"{c['column']} ({c['level']})" for c in parsed.sensitive_columns]
            factors["sensitive_columns_accessed"] = col_names
            critical_count = sum(1 for c in parsed.sensitive_columns if c["level"] == "CRITICAL")
            high_count = sum(1 for c in parsed.sensitive_columns if c["level"] == "HIGH")

            if critical_count > 0:
                reasons.append(f"Direct access to {critical_count} CRITICAL sensitive column(s): {', '.join(col_names[:3])}.")
                score += (30 + (critical_count * 10))
            elif high_count > 0:
                reasons.append(f"Access to {high_count} HIGH sensitivity column(s): {', '.join(col_names[:3])}.")
                score += (20 + (high_count * 5))
            else:
                score += 15

            # Role restriction on PII/raw data
            if user_role in ("data_scientist", "readonly_operator") and not parsed.is_pure_aggregate:
                factors["role_privilege_mismatch"] = True
                reasons.append(f"Role '{user_role}' attempting raw microdata extraction on sensitive fields without aggregation.")
                score += 25

        # 4. Differencing Attack Detection
        # Compare current query against session history for identical tables & aggregates with single-predicate variance
        history = self.session_histories.get(session_id, [])
        if parsed.aggregates and history:
            diff_hit = self._detect_differencing(parsed, history)
            if diff_hit:
                factors["differencing_attack"] = True
                differencing_match_info = diff_hit
                reasons.append(
                    f"POTENTIAL RECONSTRUCTION ATTACK: Differencing query pattern detected against prior query #{diff_hit['historical_index']}. "
                    f"Variance: {diff_hit['predicate_diff']}. Could isolate individual record values."
                )
                score += 65

        # 5. Progressive Filtering Detection
        if len(parsed.predicates) >= 2 and history:
            prog_hit = self._detect_progressive_filtering(parsed, history)
            if prog_hit:
                factors["progressive_filtering"] = True
                reasons.append(
                    f"Progressive filtering sequence detected across {prog_hit['chain_length']} consecutive queries. "
                    f"Predicates continually added to narrow population cohort."
                )
                score += 30

        # 6. Population Narrowing Estimation (Cell size / k-anonymity)
        estimated_rows = None
        if db_row_estimator and parsed.statement_type == "SELECT":
            try:
                estimated_rows = db_row_estimator(parsed.normalized_query)
                factors["estimated_population_size"] = estimated_rows
                min_cell = policy.get("min_cell_size", 3)
                if estimated_rows is not None:
                    if estimated_rows == 0:
                        reasons.append("Query matches 0 records in protected dataset.")
                    elif estimated_rows == 1:
                        factors["population_narrowing"] = True
                        reasons.append("CRITICAL: Query isolates exactly 1 individual entity (Singling-out / k=1).")
                        score += 45
                    elif estimated_rows < min_cell:
                        factors["population_narrowing"] = True
                        reasons.append(f"Small cell count violation: result set matches {estimated_rows} records (policy requires >= {min_cell}).")
                        score += 35
            except Exception:
                pass

        # 7. Cumulative Low-and-Slow Exposure
        if history:
            recent_queries = [h for h in history if (time.time() - h.timestamp) < 3600]
            if len(recent_queries) >= 10:
                unique_tables = set(t for h in recent_queries for t in h.parsed.tables)
                if len(unique_tables) >= 3:
                    factors["low_and_slow_exposure"] = True
                    reasons.append(f"High cumulative query volume ({len(recent_queries)} queries across {len(unique_tables)} tables in active session).")
                    score += 20

        # Bound score between 0 and 100
        risk_score = max(0, min(100, score))

        # Enforce Policy Thresholds
        thresholds = policy.get("risk_thresholds", {"allow_max": 30, "warn_max": 60, "restrict_max": 79, "block_min": 80})
        
        # Override: Canary touch is always BLOCKED if policy configured
        if canary_triggered and policy.get("block_canary_touch", True):
            decision = "BLOCK"
            risk_score = max(risk_score, 95)
        elif risk_score >= thresholds.get("block_min", 80):
            decision = "BLOCK"
        elif risk_score > thresholds.get("warn_max", 60):
            decision = "RESTRICT"
        elif risk_score > thresholds.get("allow_max", 30):
            decision = "WARN"
        else:
            decision = "ALLOW"

        # Determine differential privacy requirement
        requires_diff_privacy = (
            decision == "RESTRICT" or 
            (policy.get("differential_privacy_required", False) and len(parsed.aggregates) > 0)
        )

        # Generate actionable remediation guidance
        remediation = self._generate_remediation(decision, factors, parsed)

        return SecurityDecision(
            decision=decision,
            risk_score=risk_score,
            reasons=reasons if reasons else ["Query conforms to security policy. No inference patterns detected."],
            factors=factors,
            remediation=remediation,
            differencing_match=differencing_match_info,
            canary_triggered=canary_triggered,
            requires_diff_privacy=requires_diff_privacy
        )

    def _detect_differencing(self, current: ParsedQuery, history: List[SessionQueryRecord]) -> Optional[Dict[str, Any]]:
        current_tbls = set(current.tables)
        current_aggs = set(a["func"] for a in current.aggregates)
        current_pred_raws = set(p.get("raw", "").strip().lower() for p in current.predicates)

        for idx, past in enumerate(reversed(history[-10:])):
            past_parsed = past.parsed
            if not past_parsed.aggregates:
                continue
            past_tbls = set(past_parsed.tables)
            past_aggs = set(a["func"] for a in past_parsed.aggregates)
            past_pred_raws = set(p.get("raw", "").strip().lower() for p in past_parsed.predicates)

            # Same table and at least one overlapping aggregate function
            if current_tbls and past_tbls and current_tbls == past_tbls and (current_aggs & past_aggs):
                # Calculate symmetric difference of predicates
                sym_diff = current_pred_raws.symmetric_difference(past_pred_raws)
                # Differencing attack: exactly 1 predicate differing (e.g. "id != 'EMP-104'")
                if 1 <= len(sym_diff) <= 2:
                    return {
                        "historical_index": len(history) - idx,
                        "historical_query": past.query,
                        "predicate_diff": list(sym_diff),
                        "shared_aggregates": list(current_aggs & past_aggs),
                        "table": list(current_tbls)[0] if current_tbls else ""
                    }
        return None

    def _detect_progressive_filtering(self, current: ParsedQuery, history: List[SessionQueryRecord]) -> Optional[Dict[str, Any]]:
        curr_preds = set(p.get("raw", "").strip().lower() for p in current.predicates)
        curr_tbls = set(current.tables)
        chain_len = 1

        for past in reversed(history[-5:]):
            past_preds = set(p.get("raw", "").strip().lower() for p in past.parsed.predicates)
            past_tbls = set(past.parsed.tables)
            # If same tables and past predicates are a strict subset of current
            if curr_tbls == past_tbls and past_preds.issubset(curr_preds) and len(curr_preds) > len(past_preds):
                chain_len += 1
                curr_preds = past_preds
            else:
                break

        if chain_len >= self.current_policy.get("progressive_filter_depth", 3):
            return {"chain_length": chain_len}
        return None

    def _generate_remediation(self, decision: str, factors: Dict[str, Any], parsed: ParsedQuery) -> str:
        if decision == "ALLOW":
            return "Query passed all baseline safety checks and conforms to the active security policy."
        if factors.get("canary_tripwire"):
            return "SECURITY WARNING: Query touches a registered honeypot canary record. Request has been blocked and logged to SOC."
        if factors.get("differencing_attack"):
            return "Differencing detected: To compute cohort statistics safely, remove individual exclusion filters or request differential privacy perturbed aggregates."
        if factors.get("population_narrowing"):
            return "Small population size: Broaden the query filter criteria so that at least the minimum policy threshold of records is matched, or use coarse aggregation."
        if factors.get("role_privilege_mismatch"):
            return "Role restriction: Data science roles must query statistical aggregates (COUNT, AVG, SUM) rather than extracting individual rows with sensitive columns."
        if decision == "RESTRICT":
            return "Differential Privacy applied: Aggregates will be perturbed with calibrated Laplace noise before return to prevent reconstruction."
        if decision == "BLOCK":
            return "Query execution strictly prevented. Please adjust query criteria to comply with tenant privacy bounds."
        return "Exercise caution: Query contains moderate risk indicators."
