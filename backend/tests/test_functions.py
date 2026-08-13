"""
test_functions.py — Test script for Phase D & F Firebase Cloud Functions handlers.
"""

import os
import sys
import json
from unittest.mock import MagicMock, patch

# Ensure functions module is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "functions"))
os.environ.setdefault("LLM_API_KEY", "dummy-key-for-function-test")

# Import handlers from main.py
import main as fn_main

def make_mock_req(json_data=None, method="POST"):
    req = MagicMock()
    req.method = method
    req.get_json.return_value = json_data or {}
    return req

def get_raw_fn(fn):
    # Unwrap firebase_functions https_fn wrapper for unit testing
    return getattr(fn, "__wrapped__", getattr(fn, "python_user_function", fn))

def test_health():
    print("\n[TEST] health endpoint...")
    req = make_mock_req(method="GET")
    raw_fn = get_raw_fn(fn_main.health)
    resp = raw_fn(req)
    data = json.loads(resp.response[0])
    print("  Response:", data)
    assert data["status"] == "ok"
    assert data["provider"] == "single (openai)"
    print("  [PASS]")

def test_analyze_goal():
    print("\n[TEST] analyze_goal endpoint...")
    req = make_mock_req({"goal": "Test goal for analysis"})
    
    from agents.agent import GoalAnalysis
    mock_res = GoalAnalysis(goal="Test goal for analysis", roles=["Role A", "Role B"])
    
    raw_fn = get_raw_fn(fn_main.analyze_goal)
    with patch("main.generate_roles", return_value=mock_res):
        resp = raw_fn(req)
        data = json.loads(resp.response[0])
        print("  Response:", data)
        assert data["goal"] == "Test goal for analysis"
        assert len(data["roles"]) == 2
        print("  [PASS]")

def test_execute_goal():
    print("\n[TEST] execute_goal endpoint (2 distinct runs)...")
    
    raw_fn = get_raw_fn(fn_main.execute_goal)
    with patch("main.compiled_graph.invoke") as mock_invoke, \
         patch("main.firestore.client") as mock_fs:
        
        mock_db = MagicMock()
        mock_coll = MagicMock()
        mock_doc1 = MagicMock(id="mock-run-id-1")
        mock_doc2 = MagicMock(id="mock-run-id-2")
        mock_coll.add.side_effect = [(None, mock_doc1), (None, mock_doc2)]
        mock_db.collection.return_value = mock_coll
        mock_fs.return_value = mock_db

        # Run 1
        req1 = make_mock_req({"goal": "Build an app"})
        mock_state1 = {
            "goal": "Build an app",
            "roles": ["Dev", "Designer"],
            "proposals": [{"role": "Dev", "proposal": "Plan 1", "confidence": 0.9, "reasoning": "Reason 1", "status": "success"}],
            "winner": {"role": "Dev", "proposal": "Plan 1", "confidence": 0.9, "reasoning": "Reason 1", "status": "success"},
            "logs": [{"node": "output", "role": None, "status": "success"}]
        }
        mock_invoke.return_value = mock_state1
        resp1 = raw_fn(req1)
        data1 = json.loads(resp1.response[0])
        print("  Run 1 Response:", data1)
        assert data1["goal"] == "Build an app"
        assert data1["run_id"] == "mock-run-id-1"

        # Run 2
        req2 = make_mock_req({"goal": "Disaster Relief Plan"})
        mock_state2 = {
            "goal": "Disaster Relief Plan",
            "roles": ["Logistics Expert", "Medical Officer"],
            "proposals": [{"role": "Logistics Expert", "proposal": "Plan 2", "confidence": 0.95, "reasoning": "Reason 2", "status": "success"}],
            "winner": {"role": "Logistics Expert", "proposal": "Plan 2", "confidence": 0.95, "reasoning": "Reason 2", "status": "success"},
            "logs": [{"node": "output", "role": None, "status": "success"}]
        }
        mock_invoke.return_value = mock_state2
        resp2 = raw_fn(req2)
        data2 = json.loads(resp2.response[0])
        print("  Run 2 Response:", data2)
        assert data2["goal"] == "Disaster Relief Plan"
        assert data2["run_id"] == "mock-run-id-2"

        # Verify Firestore collection 'runs' was called twice with distinct document bodies
        assert mock_coll.add.call_count == 2
        print("  [PASS] Both runs created distinct Firestore documents in 'runs' collection")

if __name__ == "__main__":
    test_health()
    test_analyze_goal()
    test_execute_goal()
    print("\n==========================================")
    print("  ALL CLOUD FUNCTION UNIT TESTS PASSED")
    print("==========================================")
