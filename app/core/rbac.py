"""Role-Based Access Control (RBAC) Engine for RECON-X Proxy."""
from typing import Dict, List, Set, Optional


class UserSession:
    def __init__(self, username: str, role: str, department: str = "Security Operations"):
        self.username = username
        self.role = role
        self.department = department

    def to_dict(self) -> Dict[str, str]:
        return {
            "username": self.username,
            "role": self.role,
            "department": self.department
        }


ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "admin": {
        "proxy:toggle",
        "proxy:inspect",
        "proxy:execute",
        "connections:manage",
        "policies:manage",
        "audit:view",
        "audit:export",
        "events:view",
        "lab:view"
    },
    "security_analyst": {
        "proxy:toggle",
        "proxy:inspect",
        "proxy:execute",
        "connections:view",
        "policies:view",
        "audit:view",
        "events:view",
        "lab:view"
    },
    "data_scientist": {
        "proxy:inspect",
        "proxy:execute",
        "policies:view",
        "lab:view"
    },
    "compliance_auditor": {
        "audit:view",
        "audit:export",
        "events:view",
        "policies:view"
    },
    "readonly_operator": {
        "proxy:view_status",
        "events:view"
    }
}

PREDEFINED_USERS: List[Dict[str, str]] = [
    {"username": "sec_admin", "role": "admin", "department": "Security Architecture"},
    {"username": "analyst_clara", "role": "security_analyst", "department": "SOC Tier 2"},
    {"username": "ds_marcus", "role": "data_scientist", "department": "Advanced Analytics"},
    {"username": "auditor_elena", "role": "compliance_auditor", "department": "GRC & Compliance"},
    {"username": "ops_readonly", "role": "readonly_operator", "department": "Infrastructure Ops"}
]


def check_permission(role: str, permission: str) -> bool:
    """Return True if role possesses requested permission."""
    perms = ROLE_PERMISSIONS.get(role, set())
    return permission in perms
