"""
test_graph.py — Phase C standalone test (no Firebase, no LLM required)

Tests the graph wiring and negotiator logic with mock proposals:
  Case 1: Normal winner selection (highest confidence wins)
  Case 2: Tie-break by reasoning length (same confidence, longer reasoning wins)
  Case 3: All-fail (all proposals confidence == 0.0 → system failure object)

Usage:
    python test_graph.py
"""

import os
import sys

# Make sure we can import from functions/agents/ regardless of cwd
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "functions"))

# Set a dummy key so the agent module loads without error
# (No real LLM calls are made in these tests)
os.environ.setdefault("LLM_API_KEY", "dummy-for-graph-tests")

from unittest.mock import patch
from agents.graph import compiled_graph, negotiator_node, GraphState


def separator(label: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print("=" * 60)


# ── Helpers to build mock proposals ──────────────────────────────────────────

def mock_proposal(role: str, confidence: float, reasoning: str, status: str = "success") -> dict:
    return {
        "role": role,
        "proposal": f"Mock proposal from {role}",
        "confidence": confidence,
        "reasoning": reasoning,
        "status": status,
    }


# ── Case 1: Normal winner selection ─────────────────────────────────────────

def test_case_1_normal_winner() -> None:
    separator("Case 1: Normal winner — highest confidence wins")

    proposals = [
        mock_proposal("Emergency Planner",    confidence=0.60, reasoning="Short reasoning"),
        mock_proposal("Logistics Expert",     confidence=0.92, reasoning="Step-by-step logistics plan"),
        mock_proposal("Medical Coordinator",  confidence=0.75, reasoning="Medical triage protocol"),
    ]

    state: GraphState = {
        "goal":      "Flood disaster relief",
        "roles":     ["Emergency Planner", "Logistics Expert", "Medical Coordinator"],
        "proposals": proposals,
        "winner":    None,
        "logs":      [],
    }

    result = negotiator_node(state)
    winner = result["winner"]

    print(f"  Winner role      : {winner['role']}")
    print(f"  Winner confidence: {winner['confidence']:.2f}")
    print(f"  Winner status    : {winner['status']}")

    assert winner["role"] == "Logistics Expert", f"Expected 'Logistics Expert', got {winner['role']!r}"
    assert winner["confidence"] == 0.92
    assert winner["status"] == "success"
    print("  [PASS]")


# ── Case 2: Tie-break by reasoning length ────────────────────────────────────

def test_case_2_tie_break_reasoning_length() -> None:
    separator("Case 2: Tie-break — same confidence, longer reasoning wins")

    short_reasoning = "Brief summary."
    long_reasoning  = "A comprehensive multi-step analysis covering resource allocation, risk mitigation, phased execution, stakeholder communication, and contingency planning for each stage of the project."

    proposals = [
        mock_proposal("Strategy Lead",   confidence=0.85, reasoning=short_reasoning),
        mock_proposal("Operations Head", confidence=0.85, reasoning=long_reasoning),
    ]

    state: GraphState = {
        "goal":      "Business strategy",
        "roles":     ["Strategy Lead", "Operations Head"],
        "proposals": proposals,
        "winner":    None,
        "logs":      [],
    }

    result = negotiator_node(state)
    winner = result["winner"]

    print(f"  Winner role          : {winner['role']}")
    print(f"  Winner confidence    : {winner['confidence']:.2f}")
    print(f"  Winner reasoning len : {len(winner['reasoning'])} chars")

    assert winner["role"] == "Operations Head", f"Expected 'Operations Head', got {winner['role']!r}"
    assert winner["confidence"] == 0.85
    print("  [PASS]")


# ── Case 3: All-fail ─────────────────────────────────────────────────────────

def test_case_3_all_fail() -> None:
    separator("Case 3: All-fail — all proposals have confidence 0.0")

    proposals = [
        mock_proposal("Role A", confidence=0.0, reasoning="", status="failed"),
        mock_proposal("Role B", confidence=0.0, reasoning="", status="failed"),
    ]

    state: GraphState = {
        "goal":      "Impossible task",
        "roles":     ["Role A", "Role B"],
        "proposals": proposals,
        "winner":    None,
        "logs":      [],
    }

    result = negotiator_node(state)
    winner = result["winner"]

    print(f"  Winner role      : {winner['role']}")
    print(f"  Winner proposal  : {winner['proposal']}")
    print(f"  Winner confidence: {winner['confidence']:.2f}")

    assert winner["confidence"] == 0.0
    assert winner["status"] == "failed"
    assert "no reliable proposal" in winner["proposal"].lower(), \
        f"Expected all-fail message, got: {winner['proposal']!r}"
    print("  [PASS]")


# ── Full graph smoke-test with mocked LLM ────────────────────────────────────

def test_case_full_graph_mocked() -> None:
    separator("Case 4: Full graph invocation with mocked LLM calls")

    from agents.agent import GoalAnalysis, Proposal

    mock_analysis = GoalAnalysis(goal="Build a SaaS product", roles=["CTO", "Product Manager"])
    mock_cto      = Proposal(role="CTO",             proposal="Build microservices backend.", confidence=0.88, reasoning="Scalable architecture reasoning.", status="success")
    mock_pm       = Proposal(role="Product Manager",  proposal="Define MVP feature set.",      confidence=0.79, reasoning="User research reasoning.",         status="success")

    with (
        patch("agents.graph.generate_roles", return_value=mock_analysis),
        patch("agents.graph.run_agent",      side_effect=[mock_cto, mock_pm]),
    ):
        initial_state: GraphState = {
            "goal":      "Build a SaaS product",
            "roles":     [],
            "proposals": [],
            "winner":    None,
            "logs":      [],
        }
        final_state = compiled_graph.invoke(initial_state)

    print(f"  Final roles     : {final_state['roles']}")
    print(f"  Proposals count : {len(final_state['proposals'])}")
    print(f"  Winner role     : {final_state['winner']['role']}")
    print(f"  Winner conf.    : {final_state['winner']['confidence']:.2f}")
    print(f"  Log entries     : {len(final_state['logs'])}")

    assert final_state["winner"]["role"] == "CTO"
    assert final_state["winner"]["confidence"] == 0.88
    assert len(final_state["proposals"]) == 2
    print("  [PASS]")


def main() -> None:
    test_case_1_normal_winner()
    test_case_2_tie_break_reasoning_length()
    test_case_3_all_fail()
    test_case_full_graph_mocked()
    print(f"\n{'='*60}")
    print("  ALL GRAPH TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
