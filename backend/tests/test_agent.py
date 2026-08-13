"""
test_agent.py — Phase B standalone test (no Firebase required)

Usage:
    set LLM_API_KEY=sk-...          (Windows)
    python test_agent.py

Tests both generate_roles() and run_agent() with 3 goals from different domains.
"""

import os
import sys

# Try loading python-dotenv if available
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))
except ImportError:
    pass

# Make sure we can import from functions/agents/ regardless of cwd
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "functions"))

from agents.agent import generate_roles, run_agent

GOALS = [
    "Plan a flood disaster relief response for a coastal city of 500,000 people",
    "Design a customer loyalty rewards programme for a mid-sized e-commerce retailer",
    "Develop a competitive market-entry strategy for a B2B SaaS startup targeting HR departments",
]

def separator(label: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print('='*60)

def main() -> None:
    if not os.environ.get("LLM_API_KEY"):
        print("[ERROR] LLM_API_KEY environment variable is not set.")
        print("        Set it before running:  set LLM_API_KEY=sk-...")
        sys.exit(1)

    for i, goal in enumerate(GOALS, 1):
        separator(f"GOAL {i}: {goal[:60]}...")

        # 1. Generate roles
        print("\n[generate_roles]")
        roles = []
        try:
            analysis = generate_roles(goal)
            print(f"  goal  : {analysis.goal[:80]}")
            print(f"  roles : {analysis.roles}")
            roles = analysis.roles
        except Exception as exc:
            print(f"  FAILED (raised as expected on total failure): {exc}")
            roles = ["Lead Strategist", "Operations Specialist"]

        # 2. Run agent for each role
        for role in roles:
            print(f"\n[run_agent] role={role!r}")
            proposal = run_agent(role, goal)
            print(f"  status     : {proposal.status}")
            print(f"  confidence : {proposal.confidence:.2f}")
            print(f"  proposal   : {proposal.proposal[:120]}...")
            print(f"  reasoning  : {proposal.reasoning[:120]}...")

    print("\n[ALL TESTS COMPLETE]")

if __name__ == "__main__":
    main()
