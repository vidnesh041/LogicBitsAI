import logging
import os

# Load .env file early so all os.getenv() calls below see the values
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed; rely on shell environment

# Configure logging so all [STAGE] markers appear in the terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from .agents.goal_analyzer import analyze_goal
from .agents.organization_builder import build_organization
from .agents.execution_engine import execute_organization_plan, generate_roles_only, run_langgraph_pipeline

from .agents.analytics import generate_project_analytics
from .agents.models import GoalAnalysis, OrganizationPlan, ExecutionReport, MasterProjectPlan
from .ai.model_provider import set_active_provider, get_active_provider_info

import base64
import json

app = FastAPI(title="LogicBitsAI Standalone Backend")

# Initialize Firestore via base64 encoded service account key if provided
db_client = None

def init_firestore():
    global db_client
    sa_base64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if sa_base64.strip():
        try:
            try:
                decoded = base64.b64decode(sa_base64).decode("utf-8")
                sa_info = json.loads(decoded)
            except Exception:
                sa_info = json.loads(sa_base64)

            import firebase_admin
            from firebase_admin import credentials, firestore

            cred = credentials.Certificate(sa_info)
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            db_client = firestore.client()
            logger.info("Firestore admin client initialized successfully via service account key.")
        except Exception as e:
            logger.warning("Firestore service account initialization warning: %s", e)

init_firestore()

# Configurable CORS Middleware (accepts ALLOWED_ORIGIN from Vercel deployment)
allowed_origin = os.getenv("ALLOWED_ORIGIN", "*")
origins = [allowed_origin] if allowed_origin != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log config on startup
info = get_active_provider_info()

grok_raw = os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY") or ""
grok_masked = f"{grok_raw[:6]}****{grok_raw[-4:]}" if len(grok_raw) > 10 else ("SET" if grok_raw else "NOT SET (empty)")

logger.info("=== LogicBitsAI Backend Starting ===")
logger.info("MOCK_MODE      = %s", info["mock_mode"])
logger.info("AI_PROVIDER    = %s", info["active_provider"])
logger.info("GEMINI_API_KEY = %s", "SET" if info["gemini_key_set"] else "NOT SET (empty)")
logger.info("GROK_API_KEY   = %s", grok_masked)
logger.info("ALLOWED_ORIGIN = %s", allowed_origin)
logger.info("FIRESTORE_INIT = %s", "CONNECTED" if db_client is not None else "NOT CONFIGURED")
logger.info("=====================================")


# ── Request / Response models ─────────────────────────────────────────────────

class GoalRequest(BaseModel):
    """Legacy Stage 1 request model (kept for backward compatibility)."""
    goal: str


class AnalyzeGoalRequest(BaseModel):
    """Stage 3 request model."""
    project_id: str
    goal: str


class ExecuteGoalRequest(BaseModel):
    """Stage 4 request model."""
    project_id: str
    goal: Optional[str] = None
    organization: Optional[OrganizationPlan] = None


class SynthesizeGoalRequest(BaseModel):
    """Stage 5 request model."""
    project_id: str
    analysis: GoalAnalysis
    organization: OrganizationPlan
    execution_report: ExecutionReport


class AnalyticsGoalRequest(BaseModel):
    """Stage 6 request model."""
    project_id: str
    analysis: Optional[GoalAnalysis] = None
    organization: Optional[OrganizationPlan] = None
    execution_report: Optional[ExecutionReport] = None
    master_plan: Optional[MasterProjectPlan] = None


class ProviderSettingsRequest(BaseModel):
    """Stage 7 AI Provider settings request model."""
    provider: str   # mock | gemini | openai | groq | grok


class ResynthesizeRequest(BaseModel):
    """Mid-process feedback re-synthesis request model."""
    project_id: str
    goal: str
    user_feedback: str
    graph_state: Optional[Dict[str, Any]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    info = get_active_provider_info()
    firestore_connected = False
    if db_client is not None:
        try:
            firestore_connected = True
        except Exception:
            firestore_connected = False

    return {
        "status": "ok",
        "mock_mode": info["mock_mode"],
        "ai_provider": info["active_provider"],
        "gemini_key_set": info["gemini_key_set"],
        "openai_key_set": info["openai_key_set"],
        "groq_key_set": info.get("groq_key_set", False),
        "grok_key_set": info.get("grok_key_set", False),
        "firestore_connected": firestore_connected,
    }


@app.post("/api/settings/provider")
def update_provider_settings(request: ProviderSettingsRequest):
    """Stage 7 endpoint — Switch AI provider mode at runtime."""
    prov = request.provider.lower().strip()
    valid_providers = ["mock", "gemini", "openai", "groq", "grok"]
    if prov not in valid_providers:
        raise HTTPException(status_code=422, detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}.")

    set_active_provider(prov)
    updated_info = get_active_provider_info()
    logger.info("[PROVIDER_CHANGED] AI Provider changed to %s", prov)
    return {
        "status": "success",
        "provider_info": updated_info,
        "message": f"Active AI Provider updated to '{prov}'.",
    }


@app.post("/api/goals")
def create_goal(request: GoalRequest):
    """Legacy endpoint — kept for Stage 1/2 backward compatibility."""
    logger.info("[GOAL_RECEIVED] goal=%r (legacy endpoint)", request.goal)

    try:
        analysis = analyze_goal(request.goal)
        logger.info("[GOAL_ANALYZED] domain=%s complexity=%s", analysis.domain, analysis.complexity)

        org_plan = build_organization(analysis)
        logger.info("[ORGANIZATION_CREATED] team_size=%d", org_plan.team_size)

        info = get_active_provider_info()
        result = {
            "status": "success",
            "original_goal": request.goal,
            "analysis": analysis.dict(),
            "organization": org_plan.dict(),
            "required_roles": [r.name for r in org_plan.roles],
            "message": f"Goal analyzed successfully ({info['active_provider']} mode)",
        }
        logger.info("[FINAL_RESULT] status=success")
        return result

    except Exception as e:
        logger.error("[AI_ERROR] exception=%s", e, exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "message": "Failed to analyze goal.",
        }


@app.post("/api/goals/analyze")
def analyze_goal_endpoint(request: AnalyzeGoalRequest):
    """Stage 3 endpoint — Role Generator (Rule 8: standalone call without invoking compiled StateGraph)."""
    if not request.goal or not request.goal.strip():
        raise HTTPException(status_code=422, detail="Goal cannot be empty.")

    logger.info("[GOAL_RECEIVED] project_id=%s goal=%r", request.project_id, request.goal)

    events = [{"type": "GOAL_RECEIVED", "data": {"goal": request.goal}}]

    try:
        roles_result = generate_roles_only(request.goal)
        logger.info("[GOAL_ANALYZED] project_id=%s roles=%s", request.project_id, roles_result["roles"])
        
        events.append({
            "type": "GOAL_ANALYZED",
            "data": {
                "domain": roles_result.get("domain", "General"),
                "complexity": roles_result.get("complexity", "medium"),
                "roles": roles_result["roles"],
                "role_count": len(roles_result["roles"]),
            },
        })

        info = get_active_provider_info()

        # Build analysis and organization objects for frontend compatibility
        analysis_obj = analyze_goal(request.goal)
        org_plan = build_organization(analysis_obj)

        return {
            "status": "success",
            "project_id": request.project_id,
            "goal": request.goal,
            "roles": roles_result["roles"],
            "domain": roles_result.get("domain"),
            "complexity": roles_result.get("complexity"),
            "events": events,
            "logs": roles_result.get("logs", []),
            "message": f"Roles generated successfully ({info['active_provider']} mode)",
            # Full structured objects for synthesis/execution downstream
            "analysis": analysis_obj.dict(),
            "organization": org_plan.dict(),
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error("[AI_ERROR] project_id=%s exception=%s", request.project_id, e, exc_info=True)
        events.append({"type": "AI_ERROR", "data": {"error": str(e)}})
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "project_id": request.project_id,
                "error": str(e),
                "events": events,
                "message": "Failed to generate roles. Please try again.",
            },
        )


@app.post("/api/goals/execute")
def execute_goal_endpoint(request: ExecuteGoalRequest):
    """Stage 4 endpoint — LangGraph StateGraph Execution Pipeline."""
    goal = request.goal
    if not goal and request.organization:
        goal = f"Execute project for roles: {[r.name for r in request.organization.roles]}"
    if not goal or not goal.strip():
        raise HTTPException(status_code=422, detail="Goal cannot be empty for execution.")

    logger.info("[EXECUTION_REQUESTED] project_id=%s goal=%r", request.project_id, goal)

    try:
        final_state = run_langgraph_pipeline(goal)
        return {
            "status": "success",
            "project_id": request.project_id,
            "graph_state": final_state,
            "winner": final_state.get("winner"),
            "proposals": final_state.get("proposals"),
            "roles": final_state.get("roles"),
            "logs": final_state.get("logs"),
            "output": final_state.get("output"),
            "message": f"LangGraph workflow executed successfully across {len(final_state.get('roles', []))} parallel expert nodes.",
        }
    except Exception as e:
        logger.error("[EXECUTION_FAILED] project_id=%s exception=%s", request.project_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "project_id": request.project_id,
                "error": str(e),
                "message": "Failed to execute LangGraph workflow.",
            },
        )





@app.post("/api/goals/analytics")
def analytics_goal_endpoint(request: AnalyticsGoalRequest):
    """Stage 6 endpoint — System Health, Readiness Score & Agent Performance Analytics."""
    if not request.project_id:
        raise HTTPException(status_code=422, detail="Project ID is required.")

    logger.info("[ANALYTICS_REQUESTED] project_id=%s", request.project_id)

    try:
        analytics_report, events = generate_project_analytics(
            request.project_id,
            request.analysis,
            request.organization,
            request.execution_report,
            request.master_plan
        )
        return {
            "status": "success",
            "project_id": request.project_id,
            "analytics_report": analytics_report.dict(),
            "events": events,
            "message": "Project telemetry and agent metrics computed successfully.",
        }
    except Exception as e:
        logger.error("[ANALYTICS_FAILED] project_id=%s exception=%s", request.project_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "project_id": request.project_id,
                "error": str(e),
                "message": "Failed to compute project analytics.",
            },
        )


@app.post("/api/goals/resynthesize")
def resynthesize_endpoint(request: ResynthesizeRequest):
    """Re-runs synthesis_node only with accumulated user feedback."""
    if not request.goal:
        raise HTTPException(status_code=422, detail="Goal required")
    
    current_feedback = []
    base_state = dict(request.graph_state or {})
    if "user_feedback" in base_state and isinstance(base_state["user_feedback"], list):
        current_feedback = list(base_state["user_feedback"])
    if request.user_feedback and request.user_feedback.strip():
        current_feedback.append(request.user_feedback.strip())

    base_state["goal"] = request.goal
    base_state["user_feedback"] = current_feedback

    try:
        from .agents.graph import synthesis_node
        synthesis_result = synthesis_node(base_state)
        
        base_state["deliverable_type"] = synthesis_result.get("deliverable_type")
        base_state["final_code"] = synthesis_result.get("final_code")
        base_state["final_output"] = synthesis_result.get("final_output")
        base_state["user_feedback"] = current_feedback

        return {
            "status": "success",
            "project_id": request.project_id,
            "deliverable_type": synthesis_result.get("deliverable_type"),
            "final_code": synthesis_result.get("final_code"),
            "final_output": synthesis_result.get("final_output"),
            "user_feedback": current_feedback,
            "graph_state": base_state,
        }
    except Exception as e:
        logger.error("[RESYNTHESIZE_ERROR] %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
