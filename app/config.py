"""Application Configuration and Security Policy Defaults."""
from typing import Dict, Any, List

# Server Configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000

# Color Palette Metadata (Mandatory Light Mode)
PALETTE = {
    "main_bg": "#F8FAFC",
    "sidebar_bg": "#FFFFFF",
    "content_panel": "#FFFFFF",
    "primary_text": "#0F172A",
    "secondary_text": "#64748B",
    "primary_blue": "#2563EB",
    "hover_blue": "#1D4ED8",
    "active_nav_bg": "#EFF6FF",
    "border": "#E2E8F0",
    "input_bg": "#FFFFFF",
    "success": "#15803D",
    "warning": "#B45309",
    "blocked": "#DC2626",
    "restricted": "#C2410C"
}

# Predefined Security Policies
DEFAULT_POLICIES: Dict[str, Dict[str, Any]] = {
    "HIPAA_GDPR_STRICT": {
        "id": "HIPAA_GDPR_STRICT",
        "name": "Strict Privacy (HIPAA / GDPR)",
        "description": "High-enforcement policy. Differential privacy required for aggregates, zero tolerance for small cell sizes (< 5 records), canary trips immediately block IP.",
        "min_cell_size": 5,
        "differencing_threshold": 0.85,
        "progressive_filter_depth": 3,
        "differential_privacy_required": True,
        "epsilon_budget_max": 2.0,
        "default_epsilon": 0.5,
        "block_unauthorized_pii": True,
        "block_canary_touch": True,
        "risk_thresholds": {
            "allow_max": 25,
            "warn_max": 50,
            "restrict_max": 75,
            "block_min": 76
        }
    },
    "BALANCED_PRIVACY": {
        "id": "BALANCED_PRIVACY",
        "name": "Balanced Enterprise Security",
        "description": "Standard production setting. Alerts on low cell counts (< 3 records), restricts suspicious differencing queries, blocks direct canary access.",
        "min_cell_size": 3,
        "differencing_threshold": 0.70,
        "progressive_filter_depth": 3,
        "differential_privacy_required": False,
        "epsilon_budget_max": 5.0,
        "default_epsilon": 1.0,
        "block_unauthorized_pii": False,
        "block_canary_touch": True,
        "risk_thresholds": {
            "allow_max": 30,
            "warn_max": 60,
            "restrict_max": 79,
            "block_min": 80
        }
    },
    "PERMISSIVE_ANALYST": {
        "id": "PERMISSIVE_ANALYST",
        "name": "Permissive Analytics",
        "description": "Relaxed checks for internal data science workflows with warnings and logging rather than automated blocks.",
        "min_cell_size": 1,
        "differencing_threshold": 0.90,
        "progressive_filter_depth": 6,
        "differential_privacy_required": False,
        "epsilon_budget_max": 10.0,
        "default_epsilon": 2.0,
        "block_unauthorized_pii": False,
        "block_canary_touch": True,
        "risk_thresholds": {
            "allow_max": 45,
            "warn_max": 75,
            "restrict_max": 89,
            "block_min": 90
        }
    },
    "ZERO_TRUST": {
        "id": "ZERO_TRUST",
        "name": "Zero-Trust Paranoid Mode",
        "description": "Strict verification on all queries. Any non-aggregated query containing sensitive attributes is blocked. Noise applied to all aggregates.",
        "min_cell_size": 10,
        "differencing_threshold": 0.60,
        "progressive_filter_depth": 2,
        "differential_privacy_required": True,
        "epsilon_budget_max": 1.0,
        "default_epsilon": 0.2,
        "block_unauthorized_pii": True,
        "block_canary_touch": True,
        "risk_thresholds": {
            "allow_max": 15,
            "warn_max": 40,
            "restrict_max": 65,
            "block_min": 66
        }
    }
}

# Sensitive column classification
SENSITIVE_COLUMNS: Dict[str, Dict[str, str]] = {
    # Column keyword -> Sensitivity level & Classification
    "ssn": {"level": "CRITICAL", "type": "PII / Government ID"},
    "social_security": {"level": "CRITICAL", "type": "PII / Government ID"},
    "national_id": {"level": "CRITICAL", "type": "PII / Government ID"},
    "credit_card": {"level": "CRITICAL", "type": "Financial / PCI-DSS"},
    "card_number": {"level": "CRITICAL", "type": "Financial / PCI-DSS"},
    "cvv": {"level": "CRITICAL", "type": "Financial / PCI-DSS"},
    "account_number": {"level": "HIGH", "type": "Financial / Banking"},
    "balance": {"level": "HIGH", "type": "Financial / Banking"},
    "salary": {"level": "HIGH", "type": "Compensation / HR"},
    "bonus": {"level": "HIGH", "type": "Compensation / HR"},
    "diagnosis": {"level": "CRITICAL", "type": "Health / PHI (HIPAA)"},
    "icd_code": {"level": "HIGH", "type": "Health / PHI (HIPAA)"},
    "treatment": {"level": "HIGH", "type": "Health / PHI (HIPAA)"},
    "medication": {"level": "HIGH", "type": "Health / PHI (HIPAA)"},
    "password": {"level": "CRITICAL", "type": "Auth / Credentials"},
    "password_hash": {"level": "CRITICAL", "type": "Auth / Credentials"},
    "biometric_data": {"level": "CRITICAL", "type": "Biometric"},
    "phone": {"level": "MEDIUM", "type": "Contact / PII"},
    "email": {"level": "MEDIUM", "type": "Contact / PII"},
    "address": {"level": "MEDIUM", "type": "Demographic / PII"},
    "performance_rating": {"level": "MEDIUM", "type": "HR Review"}
}

# Canary values that act as honeytokens across sectors
CANARY_IDENTIFIERS = [
    "CANARY-HC-9999",
    "CANARY-BNK-7777",
    "CANARY-EMP-001",
    "CANARY-RET-8888",
    "Jane Doe Canary",
    "John Sterling Canary",
    "Arthur Canary Pendelton",
    "Canary Customer Trap",
    "999-00-0001",
    "canary_token_trap"
]
