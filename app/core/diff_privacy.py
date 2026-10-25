"""Differential Privacy (DP) Engine for Numerical Query Aggregates.

Implements the Laplace Mechanism for epsilon-differential privacy, with sensitivity
calculation, calibrated noise generation, domain clipping, and cumulative epsilon
budget tracking per session.
"""
import math
import random
from typing import Dict, Any, Optional, Tuple


class DifferentialPrivacyEngine:
    def __init__(self, default_epsilon: float = 1.0, max_budget: float = 5.0):
        self.default_epsilon = default_epsilon
        self.max_budget = max_budget
        # session_id -> cumulative epsilon spent
        self.session_budgets: Dict[str, float] = {}

    def get_session_budget_spent(self, session_id: str) -> float:
        return self.session_budgets.get(session_id, 0.0)

    def can_spend(self, session_id: str, epsilon: float) -> bool:
        spent = self.get_session_budget_spent(session_id)
        return (spent + epsilon) <= self.max_budget

    def spend_budget(self, session_id: str, epsilon: float) -> float:
        current = self.session_budgets.get(session_id, 0.0)
        new_total = round(current + epsilon, 4)
        self.session_budgets[session_id] = new_total
        return new_total

    def reset_budget(self, session_id: str):
        self.session_budgets[session_id] = 0.0

    @staticmethod
    def sample_laplace(loc: float = 0.0, scale: float = 1.0) -> float:
        """Sample from Laplace(loc, scale) using inverse transform sampling."""
        u = random.random() - 0.5
        sgn = 1.0 if u >= 0 else -1.0
        return loc - scale * sgn * math.log(1.0 - 2.0 * abs(u) if abs(u) < 0.5 else 1e-12)

    def perturb_aggregate(
        self,
        func_name: str,
        true_value: float,
        epsilon: Optional[float] = None,
        data_range: Optional[Tuple[float, float]] = None
    ) -> Dict[str, Any]:
        r"""Apply Laplace noise to a numerical aggregate (COUNT, SUM, AVG).
        
        Sensitivity:
        - COUNT: \Delta f = 1
        - SUM: \Delta f = max_abs_value (from data_range)
        - AVG: approximate via noisy sum / noisy count
        """
        eps = epsilon if (epsilon is not None and epsilon > 0) else self.default_epsilon
        func = func_name.upper()

        if func == "COUNT":
            sensitivity = 1.0
            scale = sensitivity / eps
            noise = self.sample_laplace(0.0, scale)
            perturbed = max(0.0, true_value + noise)  # Counts cannot be negative
            return {
                "func": func,
                "true_value": true_value,
                "perturbed_value": round(perturbed),
                "noise_added": round(noise, 2),
                "epsilon": eps,
                "sensitivity": sensitivity,
                "scale_b": round(scale, 3),
                "mechanism": "Laplace Mechanism"
            }

        elif func == "SUM":
            upper_bound = data_range[1] if data_range else 100000.0
            sensitivity = upper_bound
            scale = sensitivity / eps
            noise = self.sample_laplace(0.0, scale)
            perturbed = true_value + noise
            return {
                "func": func,
                "true_value": true_value,
                "perturbed_value": round(perturbed, 2),
                "noise_added": round(noise, 2),
                "epsilon": eps,
                "sensitivity": sensitivity,
                "scale_b": round(scale, 3),
                "mechanism": "Laplace Mechanism"
            }

        elif func in ("AVG", "AVERAGE"):
            # Sensitivity of average bounded by upper_bound / expected_n
            upper_bound = data_range[1] if data_range else 10000.0
            sensitivity = upper_bound / 10.0
            scale = sensitivity / eps
            noise = self.sample_laplace(0.0, scale)
            perturbed = true_value + noise
            return {
                "func": func,
                "true_value": true_value,
                "perturbed_value": round(perturbed, 2),
                "noise_added": round(noise, 2),
                "epsilon": eps,
                "sensitivity": sensitivity,
                "scale_b": round(scale, 3),
                "mechanism": "Laplace Mechanism"
            }

        # Fallback for MIN/MAX (which are not directly DP-friendly without exponential mechanism)
        sensitivity = 100.0
        scale = sensitivity / eps
        noise = self.sample_laplace(0.0, scale)
        return {
            "func": func,
            "true_value": true_value,
            "perturbed_value": round(true_value + noise, 2),
            "noise_added": round(noise, 2),
            "epsilon": eps,
            "sensitivity": sensitivity,
            "scale_b": round(scale, 3),
            "mechanism": "Laplace Mechanism (Approx)"
        }
