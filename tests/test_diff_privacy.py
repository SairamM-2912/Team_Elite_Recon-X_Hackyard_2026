"""Unit Tests for Differential Privacy Laplace Engine."""
import pytest
from app.core.diff_privacy import DifferentialPrivacyEngine


def test_laplace_count_perturbation():
    dp = DifferentialPrivacyEngine(default_epsilon=1.0)
    true_count = 100
    res = dp.perturb_aggregate(func_name="COUNT", true_value=true_count, epsilon=0.5)

    assert "perturbed_value" in res
    assert res["sensitivity"] == 1.0
    assert res["scale_b"] == 2.0  # 1.0 / 0.5
    # Value should not be negative
    assert res["perturbed_value"] >= 0


def test_epsilon_budget_tracking():
    dp = DifferentialPrivacyEngine(default_epsilon=1.0, max_budget=3.0)
    session = "user_dp_session"

    assert dp.can_spend(session, 1.0) is True
    dp.spend_budget(session, 1.0)
    assert dp.get_session_budget_spent(session) == 1.0

    dp.spend_budget(session, 1.5)
    assert dp.get_session_budget_spent(session) == 2.5
    assert dp.can_spend(session, 1.0) is False  # 2.5 + 1.0 > 3.0
