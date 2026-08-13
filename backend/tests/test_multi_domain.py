"""
test_multi_domain.py — Phase G: Multi-Domain Validation Test

Runs 3 distinct goals across different domains through the LangGraph pipeline:
1. Disaster Relief
2. Software Architecture / IT Decision
3. Business / Market Strategy
"""

import os
import sys
import json
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "functions"))
os.environ.setdefault("LLM_API_KEY", os.environ.get("OPENAI_API_KEY", "dummy-key-for-validation"))

from agents.agent import GoalAnalysis, Proposal
from agents.graph import compiled_graph, GraphState

DOMAINS = [
    {
        "name": "Disaster Relief Response",
        "goal": "Plan a flood disaster relief response for a coastal city of 500,000 people",
        "roles": ["Emergency Response Director", "Logistics & Supply Coordinator", "Public Safety & Comms Lead"],
        "proposals": [
            Proposal(
                role="Emergency Response Director",
                proposal="Establish high-ground triage centers and deploy emergency watercraft fleets.",
                confidence=0.91,
                reasoning="Immediate life preservation by establishing emergency shelters above flood lines.",
                status="success"
            ),
            Proposal(
                role="Logistics & Supply Coordinator",
                proposal="Stage 50,000 rations and clean water purification units at regional distribution hubs.",
                confidence=0.88,
                reasoning="Ensures 72-hour supply chain continuity for stranded residents.",
                status="success"
            ),
            Proposal(
                role="Public Safety & Comms Lead",
                proposal="Deploy emergency SMS mesh broadcast and FM radio alerts.",
                confidence=0.84,
                reasoning="Keeps public informed even when cellular towers experience power outages.",
                status="success"
            ),
        ]
    },
    {
        "name": "Software Architecture / Cloud Migration",
        "goal": "Design a cloud-native microservices migration plan for a legacy monolithic payment system",
        "roles": ["Cloud Solutions Architect", "Security & Compliance Officer", "DevOps & SRE Lead"],
        "proposals": [
            Proposal(
                role="Cloud Solutions Architect",
                proposal="Implement Strangler Fig pattern to decouple payment gateway API endpoints iteratively.",
                confidence=0.94,
                reasoning="Minimizes downtime and regression risks by incrementally migrating low-risk services first.",
                status="success"
            ),
            Proposal(
                role="Security & Compliance Officer",
                proposal="Enforce PCI-DSS Level 1 tokenization and isolated HSM key vaults across all microservices.",
                confidence=0.90,
                reasoning="Guarantees zero plain-text cardholder data handling across service boundaries.",
                status="success"
            ),
            Proposal(
                role="DevOps & SRE Lead",
                proposal="Set up blue/green deployment pipelines with automated canary rollback capabilities.",
                confidence=0.87,
                reasoning="Reduces blast radius of deployment failures to under 1% of live transaction traffic.",
                status="success"
            ),
        ]
    },
    {
        "name": "Business & Market Strategy",
        "goal": "Develop a market-entry strategy for a B2B SaaS startup targeting enterprise HR teams",
        "roles": ["Chief Revenue Officer", "Product Strategy VP", "Enterprise Account Lead"],
        "proposals": [
            Proposal(
                role="Chief Revenue Officer",
                proposal="Adopt land-and-expand product-led growth model targeting department heads before enterprise procurement.",
                confidence=0.89,
                reasoning="Shortens sales cycles from 9 months to 6 weeks by proving bottom-up ROI.",
                status="success"
            ),
            Proposal(
                role="Product Strategy VP",
                proposal="Build native integrations with Workday, BambooHR, and SAP SuccessFactors out of the box.",
                confidence=0.93,
                reasoning="Integrations remove the #1 enterprise objection regarding data silos and manual sync.",
                status="success"
            ),
            Proposal(
                role="Enterprise Account Lead",
                proposal="Offer SOC2 Type II compliance guarantees and dedicated customer success managers.",
                confidence=0.86,
                reasoning="Satisfies IT security and vendor risk assessment requirements during pilot onboarding.",
                status="success"
            ),
        ]
    }
]

def run_domain_validation():
    print("============================================================")
    print("       PHASE G: MULTI-DOMAIN VALIDATION TEST SUITE")
    print("============================================================\n")

    for i, test in enumerate(DOMAINS, 1):
        print(f"--- TEST {i}: {test['name']} ---")
        print(f"Goal: {test['goal']}")

        mock_analysis = GoalAnalysis(goal=test['goal'], roles=test['roles'])
        mock_props = test['proposals']

        with patch("agents.graph.generate_roles", return_value=mock_analysis), \
             patch("agents.graph.run_agent", side_effect=mock_props):

            initial_state: GraphState = {
                "goal": test['goal'],
                "roles": [],
                "proposals": [],
                "winner": None,
                "logs": [],
            }

            final_state = compiled_graph.invoke(initial_state)

        print(f"  Roles           : {final_state['roles']}")
        print(f"  Total Proposals : {len(final_state['proposals'])}")
        winner = final_state['winner']
        print(f"  Winning Role    : {winner['role']} (Confidence: {winner['confidence']:.2f})")
        print(f"  Winning Plan    : {winner['proposal']}")
        print(f"  Reasoning       : {winner['reasoning']}\n")

        assert len(final_state['roles']) == 3
        assert winner['role'] is not None
        assert winner['confidence'] > 0.0

    print("============================================================")
    print("  ALL 3 MULTI-DOMAIN VALIDATION TESTS PASSED SUCCESSFULLY")
    print("============================================================")

if __name__ == "__main__":
    run_domain_validation()
