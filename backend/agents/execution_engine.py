import logging
from typing import List, Dict, Any, Tuple
try:
    from agents.graph import compiled_graph, generate_roles_logic, GraphState
except ImportError:
    from .graph import compiled_graph, generate_roles_logic, GraphState

logger = logging.getLogger("execution_engine")


def generate_roles_only(goal: str) -> Dict[str, Any]:
    """Rule 8: Standalone role generator call without invoking the compiled StateGraph."""
    logger.info("[ANALYZE_ENDPOINT] Executing standalone role_generator logic for goal=%r", goal)
    return generate_roles_logic(goal)


def execute_organization_plan(project_id: str, plan: Any) -> Tuple[Any, List[Dict[str, Any]]]:
    """Compatibility alias delegating to run_langgraph_pipeline."""
    logger.info("[LEGACY_EXECUTE] Redirecting execute_organization_plan to run_langgraph_pipeline for project_id=%s", project_id)
    goal = f"Project {project_id}"
    final_state = run_langgraph_pipeline(goal)
    return final_state.get("output", {}), final_state.get("logs", [])


def run_langgraph_pipeline(goal: str) -> Dict[str, Any]:
    """Rule 8: Reserve full compiled StateGraph invocation for the execute flow."""
    logger.info("[EXECUTE_ENDPOINT] Running full LangGraph StateGraph pipeline for goal=%r", goal)
    initial_state: GraphState = {
        "goal": goal,
        "roles": [],
        "proposals": [],
        "winner": None,
        "output": None,
        "logs": []
    }
    
    final_state = compiled_graph.invoke(initial_state)
    logger.info(
        "[LANGGRAPH_COMPLETE] goal=%r roles=%d proposals=%d winner=%s",
        goal,
        len(final_state.get("roles", [])),
        len(final_state.get("proposals", [])),
        final_state.get("winner", {}).get("role")
    )
    return final_state
