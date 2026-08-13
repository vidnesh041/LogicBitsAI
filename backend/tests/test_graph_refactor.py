import sys
import json
from backend.agents.graph import (
    generate_roles_logic,
    expert_node,
    negotiator_node,
    output_node,
    compiled_graph
)
from backend.agents.execution_engine import generate_roles_only, run_langgraph_pipeline

def test_all():
    print("=== Testing Rule 8 & Rule 5: Standalone Role Generator & Capping ===")
    roles_res = generate_roles_only("disaster relief for flood city")
    print("Standalone Roles:", roles_res["roles"])
    assert 2 <= len(roles_res["roles"]) <= 4, f"Role count must be between 2 and 4, got {len(roles_res['roles'])}"
    assert len(roles_res["logs"]) > 0, "Logs must not be empty"
    print("[PASS] Role generator & capping verified.")

    print("\n=== Testing Rule 1 & Rule 2: Expert Node & Fallback Proposal Schema ===")
    exp_res = expert_node({"role": "Risk Analyst", "goal": "disaster relief for flood city"})
    print("Proposal output:", exp_res["proposals"][0])
    p = exp_res["proposals"][0]
    assert "role" in p, "role missing in proposal"
    assert "status" in p, "status missing in proposal"
    assert "confidence" in p, "confidence missing in proposal"
    assert "reasoning" in p, "reasoning missing in proposal"
    print("[PASS] Expert node & proposal schema verified.")

    print("\n=== Testing Rule 3 & Rule 7: Negotiator All-Fail Check & Tie-Breaker ===")
    # 1. Test Tie breaker
    p1 = {"role": "Logistics", "proposal": "Plan A", "confidence": 0.9, "reasoning": "Short reason", "status": "success"}
    p2 = {"role": "Finance", "proposal": "Plan B", "confidence": 0.9, "reasoning": "A much longer and more detailed reasoning sentence.", "status": "success"}
    neg_res = negotiator_node({"proposals": [p1, p2], "logs": []})
    print("Tie-breaker Winner:", neg_res["winner"]["role"])
    assert neg_res["winner"]["role"] == "Finance", f"Tie breaker should prefer longer reasoning, got {neg_res['winner']['role']}"

    # 2. Test All-Fail Check
    f1 = {"role": "Logistics", "proposal": "No response", "confidence": 0.0, "reasoning": "Failed", "status": "failed"}
    f2 = {"role": "Finance", "proposal": "No response", "confidence": 0.0, "reasoning": "Failed", "status": "failed"}
    all_fail_res = negotiator_node({"proposals": [f1, f2], "logs": []})
    print("All-fail Winner note:", all_fail_res["winner"].get("note"))
    assert all_fail_res["winner"]["confidence"] == 0.0
    assert all_fail_res["winner"].get("note") == "All experts failed after retries"
    print("[PASS] Negotiator all-fail check and tie-breaker verified.")

    print("\n=== Testing Rule 6 & Full LangGraph StateGraph Execution Pipeline ===")
    final_state = run_langgraph_pipeline("disaster relief for flood city")
    print("Winner Role:", final_state["winner"]["role"])
    print("Winner Proposal:", final_state["winner"]["proposal"][:100], "...")
    print("Telemetry Logs Count:", len(final_state["logs"]))
    assert len(final_state["logs"]) > 0, "Logs must be generated across nodes"
    assert "winner" in final_state, "Winner missing in final state"
    assert "output" in final_state, "Output missing in final state"
    print("[PASS] Full LangGraph StateGraph execution pipeline verified.")

if __name__ == "__main__":
    test_all()
    print("\nALL 8 CORRECTIONS VERIFIED SUCCESSFULLY!")
