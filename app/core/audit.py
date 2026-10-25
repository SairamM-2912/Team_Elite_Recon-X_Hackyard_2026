"""Cryptographically Chained Audit Logging for RECON-X.

Provides an append-only, tamper-evident audit log where each record includes
a SHA-256 hash incorporating the previous entry's hash, timestamp, user, query,
and security decision.
"""
import hashlib
import json
import time
from typing import List, Dict, Any, Optional


class AuditLogger:
    def __init__(self):
        self.logs: List[Dict[str, Any]] = []
        self._genesis_hash = "0000000000000000000000000000000000000000000000000000000000000000"

    def log_event(
        self,
        event_type: str,
        user: str,
        role: str,
        query: str,
        decision: str,
        risk_score: int,
        details: Dict[str, Any],
        executed: bool = False,
        execution_latency_ms: float = 0.0
    ) -> Dict[str, Any]:
        prev_hash = self.logs[-1]["record_hash"] if self.logs else self._genesis_hash
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
        iso_time = time.time()

        payload = {
            "id": len(self.logs) + 1,
            "timestamp": timestamp,
            "timestamp_epoch": iso_time,
            "event_type": event_type,
            "user": user,
            "role": role,
            "query": query,
            "decision": decision,
            "risk_score": risk_score,
            "details": details,
            "executed": executed,
            "latency_ms": round(execution_latency_ms, 2),
            "prev_hash": prev_hash
        }

        # Compute tamper-evident SHA-256
        serialized = json.dumps(
            {k: v for k, v in payload.items() if k != "record_hash"},
            sort_keys=True
        )
        record_hash = hashlib.sha256((prev_hash + serialized).encode("utf-8")).hexdigest()
        payload["record_hash"] = record_hash

        self.logs.append(payload)
        return payload

    def verify_integrity(self) -> Dict[str, Any]:
        """Verify the cryptographic hash chain across all stored log entries."""
        if not self.logs:
            return {"valid": True, "count": 0, "message": "Log is empty, chain intact."}

        prev = self._genesis_hash
        for idx, entry in enumerate(self.logs):
            stored_hash = entry.get("record_hash")
            stored_prev = entry.get("prev_hash")
            if stored_prev != prev:
                return {
                    "valid": False,
                    "corrupted_at_index": idx,
                    "message": f"Broken chain link at index {idx}: expected prev_hash {prev}, found {stored_prev}"
                }
            serialized = json.dumps(
                {k: v for k, v in entry.items() if k != "record_hash"},
                sort_keys=True
            )
            expected_hash = hashlib.sha256((stored_prev + serialized).encode("utf-8")).hexdigest()
            if stored_hash != expected_hash:
                return {
                    "valid": False,
                    "corrupted_at_index": idx,
                    "message": f"Tampered record at index {idx}: hash mismatch"
                }
            prev = stored_hash

        return {
            "valid": True,
            "count": len(self.logs),
            "head_hash": self.logs[-1]["record_hash"] if self.logs else self._genesis_hash,
            "message": f"Cryptographic integrity verified across all {len(self.logs)} log records."
        }

    def get_logs(self, limit: int = 100, filter_decision: Optional[str] = None) -> List[Dict[str, Any]]:
        entries = self.logs
        if filter_decision:
            entries = [e for e in entries if e.get("decision") == filter_decision.upper()]
        return list(reversed(entries[-limit:]))
