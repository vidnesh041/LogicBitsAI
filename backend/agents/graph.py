import os
import json
import logging
import operator
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Dict, Any, List, Optional, Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
try:
    from ai.model_provider import (
        get_provider,
        get_active_provider_info,
        MockProvider,
        GeminiProvider,
        GrokProvider,
    )
except ImportError:
    from ..ai.model_provider import (
        get_provider,
        get_active_provider_info,
        MockProvider,
        GeminiProvider,
        GrokProvider,
    )

logger = logging.getLogger("graph_engine")

# ── State Definition ────────────────────────────────────────────────────────
class GraphState(TypedDict):
    goal: str
    roles: List[str]
    proposals: Annotated[List[Dict[str, Any]], operator.add]
    winner: Optional[Dict[str, Any]]
    deliverable_type: Optional[str]
    final_code: Optional[str]
    final_output: Optional[str]
    user_feedback: Optional[List[str]]
    output: Optional[Dict[str, Any]]
    logs: Annotated[List[Dict[str, Any]], operator.add]


def get_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_log(node: str, role: Optional[str], status: str) -> Dict[str, Any]:
    return {
        "node": node,
        "role": role,
        "status": status,
        "timestamp": get_iso_timestamp()
    }


def call_llm_with_timeout(system_prompt: str, user_prompt: str, timeout_seconds: float = 15.0) -> Dict[str, Any]:
    provider = get_provider()
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(provider.generate, system_prompt, user_prompt)
        return future.result(timeout=timeout_seconds)


def _clean_json_str(text: str) -> str:
    if not text:
        return "{}"
    cleaned = text.strip()
    if "```" in cleaned:
        lines = [line for line in cleaned.splitlines() if not line.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    start_brace = cleaned.find("{")
    start_bracket = cleaned.find("[")
    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        end_idx = cleaned.rfind("}")
        if end_idx > start_brace:
            return cleaned[start_brace : end_idx + 1]
    elif start_bracket != -1:
        end_idx = cleaned.rfind("]")
        if end_idx > start_bracket:
            return cleaned[start_bracket : end_idx + 1]
    return cleaned


# ─────────────────────────────────────────────────────────────────────────────
# 1. Role Generator Node
# ─────────────────────────────────────────────────────────────────────────────
def generate_roles_logic(goal: str) -> Dict[str, Any]:
    system_prompt = (
        "You are an AI Organization Builder. Analyze the goal and return a JSON object with: "
        "'roles' (a list of 2 to 4 distinct expert role names, e.g. ['Logistics Expert', 'Finance Expert', 'Risk Analyst']), "
        "'domain' (string), and 'complexity' ('low'|'medium'|'high'). "
        "Strict rule: You MUST output between 2 and 4 roles."
    )
    user_prompt = f"Goal: {goal}"

    logs = []
    try:
        data = call_llm_with_timeout(system_prompt, user_prompt, timeout_seconds=15.0)
        roles = data.get("roles", [])
        if not isinstance(roles, list):
            roles = []
        roles = [str(r).strip() for r in roles if str(r).strip()]
        if len(roles) < 2:
            defaults = ["Lead Strategist", "Operations Specialist", "Risk Analyst", "Finance Coordinator"]
            for d in defaults:
                if d not in roles and len(roles) < 2:
                    roles.append(d)
        elif len(roles) > 4:
            roles = roles[:4]
            
        logs.append(make_log("role_generator", None, "success"))
        return {
            "roles": roles,
            "domain": data.get("domain", "General Problem Solving"),
            "complexity": data.get("complexity", "medium"),
            "logs": logs
        }
    except Exception as e:
        logger.warning("[ROLE_GEN_FALLBACK] LLM call failed or timed out: %s", e)
        fallback_roles = ["Project Manager", "Systems Architect", "Software Engineer"]
        logs.append(make_log("role_generator", None, "failed"))
        return {
            "roles": fallback_roles,
            "domain": "General Engineering",
            "complexity": "medium",
            "logs": logs
        }


def role_generator_node(state: GraphState) -> Dict[str, Any]:
    res = generate_roles_logic(state["goal"])
    return {
        "roles": res["roles"],
        "logs": res["logs"]
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Fan-Out Edge Logic (2N parallel calls: Gemini + Grok per role)
# ─────────────────────────────────────────────────────────────────────────────
def fan_out_roles(state: GraphState) -> List[Send]:
    roles = state.get("roles", [])
    goal = state.get("goal", "")
    sends = []
    for idx, r in enumerate(roles):
        sends.append(Send("expert_node", {"role": r, "goal": goal, "provider": "gemini", "index": idx}))
        sends.append(Send("expert_node", {"role": r, "goal": goal, "provider": "grok", "index": idx}))
    return sends


# ─────────────────────────────────────────────────────────────────────────────
# 3. Expert Node with Model Dispatch
# ─────────────────────────────────────────────────────────────────────────────
def expert_node(state: Dict[str, Any]) -> Dict[str, Any]:
    role = state["role"]
    goal = state["goal"]
    provider_name = state.get("provider", "grok")
    logs = []
    
    system_prompt = (
        f"You are acting as the specialized '{role}'. Develop a concrete, highly specific, goal-grounded proposal tailored ONLY to the user's explicit goal.\n"
        "STRICT REQUIREMENTS:\n"
        "1. DO NOT output generic corporate jargon or abstract phases like 'requirements gathering', 'system integration', or 'priority allocation'.\n"
        "2. Provide explicit technical specifications, component layouts, architectural choices, or actionable deliverables matching your exact role.\n"
        "   - Project Manager: Define specific feature breakdown, user flow, component priorities, and acceptance criteria for THIS goal.\n"
        "   - Systems Architect: Define exact tech stack, file structure, DOM layout architecture, state management, and performance constraints.\n"
        "   - Software Engineer: Define explicit UI components, HTML structure, CSS styling strategy, JS state handlers, and code execution steps.\n"
        "   - Other Roles: Define domain-specific strategies, channels, metrics, and concrete artifacts tailored to THIS goal.\n"
        "3. Output MUST be a valid JSON object with schema:\n"
        "{\n"
        "  \"proposal\": \"Detailed, goal-grounded, multi-paragraph technical action plan with specific component and implementation details\",\n"
        "  \"confidence\": 0.95,\n"
        "  \"reasoning\": \"Concrete technical justification explaining why this specific approach optimizes execution for this goal\"\n"
        "}"
    )
    user_prompt = f"Target Goal: {goal}\nAssigned Role: {role}"

    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            info = get_active_provider_info()
            if info["mock_mode"] or info["active_provider"] == "mock":
                prov = MockProvider()
            elif provider_name == "gemini":
                try:
                    prov = GeminiProvider()
                except Exception:
                    prov = MockProvider()
            else:
                try:
                    prov = GrokProvider()
                except Exception:
                    prov = MockProvider()

            res = prov.generate(system_prompt, user_prompt)
            if isinstance(res, str):
                res = json.loads(res)

            proposal_text = str(res.get("proposal", "")).strip()
            confidence = float(res.get("confidence", 0.88))
            reasoning_text = str(res.get("reasoning", "")).strip()
            
            if not proposal_text:
                raise ValueError("Empty proposal returned from LLM")
                
            confidence = max(0.1, min(1.0, confidence))
            logs.append(make_log("expert_node", role, f"success ({provider_name})"))
            
            return {
                "proposals": [{
                    "role": role,
                    "provider": provider_name,
                    "model_used": provider_name,
                    "proposal": proposal_text,
                    "confidence": confidence,
                    "reasoning": reasoning_text,
                    "status": "success"
                }],
                "logs": logs
            }
        except Exception as e:
            logger.warning("[EXPERT_NODE_RETRY] Role %r (%s) attempt %d failed: %s", role, provider_name, attempt + 1, e)
            if attempt < max_attempts - 1:
                logs.append(make_log("expert_node", role, f"retry ({provider_name})"))
            else:
                logs.append(make_log("expert_node", role, f"failed ({provider_name})"))

    fallback_proposal = {
        "role": role,
        "provider": provider_name,
        "model_used": provider_name,
        "proposal": f"Proposal generation failed for {role} using {provider_name}",
        "confidence": 0.0,
        "reasoning": f"Agent failed after {max_attempts} retries",
        "status": "failed"
    }
    return {
        "proposals": [fallback_proposal],
        "logs": logs
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3.5 Reconciliation Gather & Fan-Out Logic (True Parallel Reconciliation)
# ─────────────────────────────────────────────────────────────────────────────
def prepare_reconcile_node(state: GraphState) -> Dict[str, Any]:
    """Intermediate gather node before parallel per-role reconciliation."""
    return {}


def fan_out_reconcile(state: GraphState) -> List[Send]:
    raw_proposals = state.get("proposals", [])
    goal = state.get("goal", "")

    grouped: Dict[str, Dict[str, Any]] = {}
    for p in raw_proposals:
        r = p.get("role")
        if not r:
            continue
        if r not in grouped:
            grouped[r] = {}
        prov = p.get("provider") or p.get("model_used") or "gemini"
        grouped[r][prov] = p

    sends = []
    for r, prov_map in grouped.items():
        gemini_prop = prov_map.get("gemini")
        grok_prop = prov_map.get("grok")
        sends.append(
            Send(
                "reconcile_role_node",
                {
                    "role": r,
                    "goal": goal,
                    "gemini_prop": gemini_prop,
                    "grok_prop": grok_prop,
                },
            )
        )
    return sends


def reconcile_role_node(state: Dict[str, Any]) -> Dict[str, Any]:
    role = state["role"]
    goal = state["goal"]
    gemini_prop = state.get("gemini_prop")
    grok_prop = state.get("grok_prop")
    logs = []

    raw_proposals = []
    if gemini_prop:
        raw_proposals.append(gemini_prop)
    if grok_prop:
        raw_proposals.append(grok_prop)

    g_ok = gemini_prop and gemini_prop.get("status") == "success" and gemini_prop.get("confidence", 0) > 0
    r_ok = grok_prop and grok_prop.get("status") == "success" and grok_prop.get("confidence", 0) > 0

    # Outcome 1: Both models failed
    if not g_ok and not r_ok:
        logs.append(make_log("reconcile_role_node", role, "both_failed"))
        return {
            "proposals": [{
                "role": role,
                "provider": "reconciled",
                "model_used": "none",
                "proposal": f"Both models (Gemini & Grok) failed for role '{role}'",
                "confidence": 0.0,
                "reasoning": "Both AI models failed after retries",
                "status": "failed",
                "cross_model_agreement": False,
                "raw_proposals": raw_proposals
            }],
            "logs": logs
        }

    # Outcome 2: Single model succeeded
    if g_ok and not r_ok:
        logs.append(make_log("reconcile_role_node", role, "single_model_fallback (gemini)"))
        return {
            "proposals": [{
                "role": role,
                "provider": "reconciled",
                "model_used": "gemini",
                "proposal": gemini_prop["proposal"],
                "confidence": gemini_prop["confidence"],
                "reasoning": gemini_prop.get("reasoning", "") + "\n[Note: Single-model result — Grok unavailable]",
                "status": "success",
                "cross_model_agreement": True,
                "raw_proposals": raw_proposals
            }],
            "logs": logs
        }

    if r_ok and not g_ok:
        logs.append(make_log("reconcile_role_node", role, "single_model_fallback (grok)"))
        return {
            "proposals": [{
                "role": role,
                "provider": "reconciled",
                "model_used": "grok",
                "proposal": grok_prop["proposal"],
                "confidence": grok_prop["confidence"],
                "reasoning": grok_prop.get("reasoning", "") + "\n[Note: Single-model result — Gemini unavailable]",
                "status": "success",
                "cross_model_agreement": True,
                "raw_proposals": raw_proposals
            }],
            "logs": logs
        }

    # Outcome 3: Both succeeded -> Check Fast-Path Skip (Enhancement 4)
    conf_diff = abs(gemini_prop["confidence"] - grok_prop["confidence"])
    w1 = set(gemini_prop["proposal"].lower().split())
    w2 = set(grok_prop["proposal"].lower().split())
    jaccard = len(w1 & w2) / max(1, len(w1 | w2))

    if conf_diff <= 0.05 and jaccard > 0.65:
        higher_prop = gemini_prop if gemini_prop["confidence"] >= grok_prop["confidence"] else grok_prop
        logs.append(make_log("reconcile_role_node", role, "fast_path_skipped"))
        return {
            "proposals": [{
                "role": role,
                "provider": "reconciled",
                "model_used": "fast_path",
                "proposal": higher_prop["proposal"],
                "confidence": higher_prop["confidence"],
                "reasoning": higher_prop.get("reasoning", "") + "\n[Note: High similarity — reconciliation call skipped]",
                "status": "success",
                "cross_model_agreement": True,
                "raw_proposals": raw_proposals
            }],
            "logs": logs
        }

    # Outcome 4: Both succeeded -> Call Reconciliation LLM (GeminiProvider, Enhancement 2 & 3)
    system_prompt = (
        f"You are an AI Strategy Evaluator and Chief Reconciler.\n"
        f"You are comparing two independent expert proposals for the specialized role '{role}' on the goal '{goal}'.\n"
        "One proposal is from GEMINI and the other is from GROK.\n"
        "STRICT GROUNDING CONSTRAINT:\n"
        "Only synthesize and combine claims that are present in EITHER of the two input proposals. Do not introduce new facts, numbers, or claims that are not grounded in at least one of the two original proposals. If you are unsure whether something is supported, omit it rather than guess.\n\n"
        "INSTRUCTIONS:\n"
        "1. Where the two models agree on architecture, tools, steps, or strategy: synthesize a unified proposal incorporating both strengths and set 'cross_model_agreement': true.\n"
        "2. Where they meaningfully disagree or conflict: highlight the conflict explicitly in the 'reasoning' field, make a sound technical choice for the synthesized proposal, adjust confidence score, and set 'cross_model_agreement': false.\n\n"
        "Output MUST be a valid JSON object with schema:\n"
        "{\n"
        "  \"proposal\": \"Synthesized unified technical proposal incorporating agreement and resolved choices\",\n"
        "  \"confidence\": 0.94,\n"
        "  \"reasoning\": \"Synthesis reasoning noting alignment and any model disagreement points\",\n"
        "  \"cross_model_agreement\": true\n"
        "}"
    )
    user_prompt = (
        f"GEMINI PROPOSAL (Confidence: {gemini_prop['confidence']}):\n{gemini_prop['proposal']}\nReasoning: {gemini_prop.get('reasoning')}\n\n"
        f"GROK PROPOSAL (Confidence: {grok_prop['confidence']}):\n{grok_prop['proposal']}\nReasoning: {grok_prop.get('reasoning')}"
    )

    try:
        res = call_llm_with_timeout(system_prompt, user_prompt, timeout_seconds=15.0)
        if isinstance(res, str):
            res = json.loads(_clean_json_str(res))

        rec_proposal = str(res.get("proposal", "")).strip()
        rec_confidence = float(res.get("confidence", max(gemini_prop["confidence"], grok_prop["confidence"])))
        rec_reasoning = str(res.get("reasoning", "")).strip()
        cross_agree = bool(res.get("cross_model_agreement", True))

        if not rec_proposal:
            raise ValueError("Empty reconciled proposal returned")

        logs.append(make_log("reconcile_role_node", role, "merged"))
        return {
            "proposals": [{
                "role": role,
                "provider": "reconciled",
                "model_used": "gemini_reconciler",
                "proposal": rec_proposal,
                "confidence": max(0.1, min(1.0, rec_confidence)),
                "reasoning": rec_reasoning,
                "status": "success",
                "cross_model_agreement": cross_agree,
                "raw_proposals": raw_proposals
            }],
            "logs": logs
        }
    except Exception as exc:
        logger.warning("[RECONCILE_FALLBACK] Role %r reconciliation call failed (%s); using higher-confidence proposal.", role, exc)
        higher_prop = gemini_prop if gemini_prop["confidence"] >= grok_prop["confidence"] else grok_prop
        logs.append(make_log("reconcile_role_node", role, "reconcile_call_failed_fallback"))
        return {
            "proposals": [{
                "role": role,
                "provider": "reconciled",
                "model_used": "higher_confidence_fallback",
                "proposal": higher_prop["proposal"],
                "confidence": higher_prop["confidence"],
                "reasoning": higher_prop.get("reasoning", "") + "\n[Note: Reconciliation call failed — used higher-confidence individual proposal]",
                "status": "success",
                "cross_model_agreement": None,
                "raw_proposals": raw_proposals
            }],
            "logs": logs
        }


def get_reconciled_proposals(proposals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filters state['proposals'] to return only the reconciled proposal per role."""
    rec = [p for p in proposals if isinstance(p, dict) and (p.get("provider") == "reconciled" or "raw_proposals" in p)]
    if rec:
        seen = {}
        for p in rec:
            r = p.get("role")
            if r:
                seen[r] = p
        return list(seen.values())
    return proposals


# ─────────────────────────────────────────────────────────────────────────────
# 4. Cross-Model Self-Critique Node (Gemini <-> Grok)
# ─────────────────────────────────────────────────────────────────────────────
def critique_node(state: GraphState) -> Dict[str, Any]:
    proposals = get_reconciled_proposals(state.get("proposals", []))
    goal = state.get("goal", "")
    logs = []
    updated_proposals = []

    for p in proposals:
        if p.get("status") == "failed" or p.get("confidence", 0.0) == 0.0:
            p["critique_provider"] = "none"
            p["critique_notes"] = "Proposal failed execution; critique skipped."
            p["flaws_found"] = ["Execution failure"]
            p["critique_penalty"] = 0.5
            p["adjusted_confidence"] = 0.0
            updated_proposals.append(p)
            continue

        gen_provider = p.get("provider", "grok")
        opp_provider = "grok" if gen_provider == "gemini" else "gemini"

        system_prompt = (
            f"You are an adversarial AI reviewer using {opp_provider.upper()}. "
            f"Review the proposal submitted by {p.get('role')} for the goal: '{goal}'. "
            "Identify unsupported claims, logical gaps, overconfidence, or security/operational risks. "
            "Return a JSON object containing: "
            "'flaws_found' (list of specific flaw/gap strings, e.g. ['Lacks threat monitoring details']), "
            "'critique_notes' (summary analysis string), and "
            "'risk_rating' ('low'|'medium'|'high'). "
            "Do NOT regenerate the proposal, ONLY critique it."
        )
        user_prompt = (
            f"EXPERT ROLE: {p.get('role')}\n"
            f"PROPOSAL: {p.get('proposal')}\n"
            f"REASONING: {p.get('reasoning')}\n\n"
            "Critique this proposal for architectural, security, or implementation risks now."
        )
        try:
            info = get_active_provider_info()
            if info["mock_mode"] or info["active_provider"] == "mock":
                c_prov = MockProvider()
            else:
                try:
                    c_prov = GrokProvider() if opp_provider == "grok" else GeminiProvider()
                except Exception:
                    c_prov = MockProvider()

            try:
                c_res = c_prov.generate(system_prompt, user_prompt)
            except Exception as e_gen:
                logger.warning("[CRITIQUE_RETRY] %s critique failed (%s); retrying with MockProvider", opp_provider, e_gen)
                c_prov = MockProvider()
                c_res = c_prov.generate(system_prompt, user_prompt)

            if isinstance(c_res, str):
                c_res = json.loads(c_res)

            flaws = c_res.get("flaws_found", [])
            if not isinstance(flaws, list):
                flaws = [str(flaws)] if flaws else []

            notes = str(c_res.get("critique_notes", "Cross-model critique executed successfully.")).strip()
            
            penalty = round(min(0.30, len(flaws) * 0.05), 2)
            adjusted_conf = round(max(0.1, p.get("confidence", 0.85) - penalty), 2)

            p["critique_provider"] = opp_provider
            p["critique_notes"] = notes
            p["flaws_found"] = flaws
            p["critique_penalty"] = penalty
            p["adjusted_confidence"] = adjusted_conf
            logs.append(make_log("critique_node", p.get("role"), f"critiqued_by_{opp_provider}"))

        except Exception as exc:
            logger.warning("[CRITIQUE_FALLBACK] Critique by %s failed (%s); retaining base confidence.", opp_provider, exc)
            p["critique_provider"] = opp_provider
            p["critique_notes"] = f"Critique pass by {opp_provider} encountered network exception: {exc}"
            p["flaws_found"] = ["Critique timeout"]
            p["critique_penalty"] = 0.0
            p["adjusted_confidence"] = p.get("confidence", 0.85)
            logs.append(make_log("critique_node", p.get("role"), "critique_failed"))

        updated_proposals.append(p)

    return {
        "proposals": updated_proposals,
        "logs": logs
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Negotiator Node (Rule-Based Selection via Adjusted Confidence)
# ─────────────────────────────────────────────────────────────────────────────
def negotiator_node(state: GraphState) -> Dict[str, Any]:
    proposals = get_reconciled_proposals(state.get("proposals", []))
    logs = []
    
    if not proposals:
        winner = {
            "role": "System",
            "proposal": "No proposals were submitted",
            "confidence": 0.0,
            "adjusted_confidence": 0.0,
            "reasoning": "No expert agents executed",
            "status": "failed"
        }
        logs.append(make_log("negotiator", None, "failed"))
        return {"winner": winner, "logs": logs}

    sorted_proposals = sorted(
        proposals,
        key=lambda p: (p.get("adjusted_confidence", p.get("confidence", 0.0)), len(str(p.get("reasoning", "")))),
        reverse=True
    )
    winner = sorted_proposals[0]
    logs.append(make_log("negotiator", winner.get("role"), "success"))

    return {
        "winner": winner,
        "logs": logs
    }


def extract_pure_html(raw_input: Any, fallback_title: str = "Web Deliverable") -> str:
    if not raw_input:
        return ""
    
    text = ""
    if isinstance(raw_input, dict):
        for k in ["code", "html", "final_code", "output", "proposal", "content"]:
            val = raw_input.get(k)
            if isinstance(val, str) and ("<html" in val.lower() or "<!doctype" in val.lower()):
                text = val
                break
        if not text:
            for val in raw_input.values():
                if isinstance(val, str) and ("<html" in val.lower() or "<!doctype" in val.lower()):
                    text = val
                    break
        if not text:
            text = str(raw_input)
    else:
        text = str(raw_input)

    text_str = text.strip()
    
    # 1. Clean markdown wrappers if present
    if "```html" in text_str:
        parts = text_str.split("```html")
        if len(parts) > 1:
            text_str = parts[1].split("```")[0].strip()
    elif "```" in text_str:
        parts = text_str.split("```")
        if len(parts) > 1:
            text_str = parts[1].split("```")[0].strip()

    # 2. Extract bounds between <!DOCTYPE html> or <html and </html>
    lower = text_str.lower()
    doc_idx = lower.find("<!doctype html")
    if doc_idx != -1:
        end_idx = lower.rfind("</html>")
        if end_idx != -1:
            return text_str[doc_idx : end_idx + 7]
        return text_str[doc_idx:]

    html_idx = lower.find("<html")
    if html_idx != -1:
        end_idx = lower.rfind("</html>")
        if end_idx != -1:
            return text_str[html_idx : end_idx + 7]
        return text_str[html_idx:]

    # 3. Fallback wrapper if no HTML tags exist
    return (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n"
        f"<title>{fallback_title}</title>\n<style>\n"
        "body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }\n"
        ".card { background: #1e293b; padding: 2rem; border-radius: 12px; max-width: 650px; margin: 0 auto; border: 1px solid #334155; }\n"
        "button { background: #38bdf8; color: #0f172a; border: none; padding: 0.75rem 1.5rem; border-radius: 9999px; font-weight: bold; cursor: pointer; }\n"
        "</style>\n</head>\n<body>\n"
        f"<div class=\"card\"><h1>{fallback_title}</h1><p>{text_str}</p><button onclick=\"alert('Action triggered!')\">Explore Solution</button></div>\n"
        "</body>\n</html>"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. Synthesis / Build Node (Generates Finished Code or Document Deliverable)
# ─────────────────────────────────────────────────────────────────────────────
def synthesis_node(state: GraphState) -> Dict[str, Any]:
    goal = state.get("goal", "")
    domain = state.get("domain") or "General Software Engineering"
    proposals = get_reconciled_proposals(state.get("proposals", []))
    winner = state.get("winner", {})
    user_feedback = state.get("user_feedback", [])
    logs = []

    goal_lower = goal.lower()
    code_keywords = ["website", "landing page", "app", "application", "code", "html", "script", "frontend", "dashboard", "ui", "component", "web page", "trading", "store"]
    is_code = any(kw in goal_lower for kw in code_keywords)
    deliverable_type = "code" if is_code else "document"

    proposal_summary = "\n\n".join([
        f"--- Agent Role: {p.get('role')} (Model: {p.get('model_used', p.get('provider'))}) ---\n"
        f"Proposal: {p.get('proposal')}\n"
        f"Reasoning: {p.get('reasoning')}\n"
        f"Critique Notes: {p.get('critique_notes', 'None')}"
        for p in proposals
    ])

    feedback_text = ""
    if user_feedback:
        feedback_text = "\n\nUSER REVISION GUIDANCE:\n" + "\n".join([f"- {fb}" for fb in user_feedback])

    provider = get_provider()

    if deliverable_type == "code":
        system_prompt = (
            "You are a Lead Senior Full-Stack Engineer and UI/UX Designer. Your job is to generate COMPLETE, WORKING, PRODUCTION-READY single-file HTML code tailored SPECIFICALLY to the user's explicit goal and domain.\n\n"
            "STRICT GENERATION CONSTRAINTS:\n"
            "1. Output MUST be ONLY valid single-file HTML containing embedded <style>...</style> and embedded <script>...</script> tags.\n"
            "2. DO NOT include markdown commentary, intro text, or explanations outside the HTML code.\n"
            "3. Ground the UI/UX components STRICTLY in the specified domain and winning proposal specification. DO NOT use generic e-commerce templates (no product catalog grids, shopping carts, or 'add to cart' buttons) UNLESS the goal is explicitly an e-commerce website.\n"
            "4. For Trading/Finance goals: build a dark-themed live trading dashboard featuring a simulated candlestick/price chart canvas, live order book, trade execution form (buy/sell limits), asset pair selector (e.g. BTC/USD, ETH/USD), balance widgets, and transaction history.\n"
            "5. For E-Commerce goals: build a high-conversion storefront with product catalog grid, hero banner, cart drawer toggle, and product modal.\n"
            "6. For Other goals: build domain-tailored interactive dashboards, administrative tools, or portals matching the winning proposal specifications.\n"
            "7. Include rich interactive JavaScript event handlers (e.g. tab switches, order execution alerts, dark/light theme toggles, modal popups) and modern CSS styling."
        )
        
        user_prompt = (
            f"TARGET GOAL: {goal}\n"
            f"DOMAIN: {domain}\n\n"
            f"WINNING AGENT PROPOSAL ({winner.get('role', 'Lead Agent')}):\n"
            f"Proposal: {winner.get('proposal')}\n"
            f"Reasoning: {winner.get('reasoning')}\n\n"
            f"ALL RECONCILED EXPERT PROPOSALS:\n{proposal_summary}{feedback_text}\n\n"
            "Generate complete single-file HTML/CSS/JS code specifically matching THIS goal and domain now."
        )

        prompt_preview = user_prompt[:200].replace('\n', ' ')
        logs.append(make_log("synthesis_node", "Synthesis Engineer", f"prompt_constructed: {prompt_preview}..."))

        max_synthesis_attempts = 2
        for attempt in range(max_synthesis_attempts):
            try:
                raw_code_res = provider.generate(system_prompt, user_prompt)
                cleaned_code = extract_pure_html(raw_code_res, fallback_title=goal)
                
                if not cleaned_code or len(cleaned_code) < 50:
                    raise ValueError("Synthesis model returned unparseable or empty code payload")

                logs.append(make_log("synthesis_node", "Synthesis Engineer", "success (code)"))
                return {
                    "deliverable_type": "code",
                    "final_code": cleaned_code,
                    "final_output": None,
                    "logs": logs
                }
            except Exception as exc:
                logger.warning("[SYNTHESIS_RETRY] Code synthesis attempt %d failed (%s)", attempt + 1, exc)
                if attempt < max_synthesis_attempts - 1:
                    import time
                    time.sleep(3.0)
                    continue

        logs.append(make_log("synthesis_node", "Synthesis Engineer", "failed (API_RATE_LIMIT)"))
        return {
            "deliverable_type": "error",
            "final_code": None,
            "final_output": f"⚠️ Synthesis Failed: LLM API Rate Limit (429) or Quota Exhausted. Please retry in 15 seconds.",
            "logs": logs
        }
    else:
        system_prompt = (
            "You are a Chief Strategy Officer and Lead Technical Writer. Synthesize a comprehensive, executive-ready, highly detailed final solution document addressing the user's goal.\n"
            "CRITICAL DOCUMENT GENERATION RULES:\n"
            "1. Produce a genuine, fully structured final deliverable — NOT a summary of subtasks or agent meta-commentary.\n"
            "2. Include Executive Summary, Strategic Architecture, Implementation Roadmap, Risk Mitigation, and Actionable Recommendations.\n"
            "3. Format cleanly using Markdown with headings, bullet points, and code/data blocks as appropriate."
        )
        user_prompt = f"Goal: {goal}\n\nEXPERT PROPOSALS & CRITIQUE CONTEXT:\n{proposal_summary}{feedback_text}\n\nSynthesize final complete document solution now."

        try:
            doc_res = provider.generate(system_prompt, user_prompt)
            if isinstance(doc_res, dict):
                doc_text = doc_res.get("output") or doc_res.get("proposal") or doc_res.get("reasoning") or json.dumps(doc_res, indent=2)
            else:
                doc_text = str(doc_res)

            logs.append(make_log("synthesis_node", "Chief Synthesizer", "success (document)"))
            return {
                "deliverable_type": "document",
                "final_code": None,
                "final_output": doc_text,
                "logs": logs
            }
        except Exception as exc:
            logger.warning("[SYNTHESIS_FALLBACK] Document synthesis failed (%s)", exc)
            fallback_doc = f"# Final Solution: {goal}\n\n## Executive Strategy\nThis comprehensive solution synthesizes expert recommendations from all multi-agent disciplines."
            logs.append(make_log("synthesis_node", "Chief Synthesizer", "fallback (document)"))
            return {
                "deliverable_type": "document",
                "final_code": None,
                "final_output": fallback_doc,
                "logs": logs
            }


# ─────────────────────────────────────────────────────────────────────────────
# 7. Output Node
# ─────────────────────────────────────────────────────────────────────────────
def output_node(state: GraphState) -> Dict[str, Any]:
    winner = state.get("winner", {})
    proposals = get_reconciled_proposals(state.get("proposals", []))
    roles = state.get("roles", [])
    
    output = {
        "status": "completed" if winner.get("status") != "failed" else "partial_failure",
        "goal": state.get("goal"),
        "deliverable_type": state.get("deliverable_type", "document"),
        "final_code": state.get("final_code"),
        "final_output": state.get("final_output"),
        "user_feedback": state.get("user_feedback", []),
        "total_roles": len(roles),
        "total_proposals": len(proposals),
        "winning_role": winner.get("role"),
        "winning_proposal": winner.get("proposal"),
        "initial_confidence": winner.get("confidence"),
        "adjusted_confidence": winner.get("adjusted_confidence", winner.get("confidence")),
        "critique_summary": winner.get("critique_notes"),
        "reasoning": winner.get("reasoning"),
        "execution_summary": f"Selected {winner.get('role')} ({winner.get('provider')}) with synthesized final deliverable."
    }
    
    return {
        "output": output,
        "logs": [make_log("output", None, "success")]
    }


# ─────────────────────────────────────────────────────────────────────────────
# Compile LangGraph StateGraph
# ─────────────────────────────────────────────────────────────────────────────
builder = StateGraph(GraphState)

builder.add_node("role_generator", role_generator_node)
builder.add_node("expert_node", expert_node)
builder.add_node("prepare_reconcile_node", prepare_reconcile_node)
builder.add_node("reconcile_role_node", reconcile_role_node)
builder.add_node("critique_node", critique_node)
builder.add_node("negotiator", negotiator_node)
builder.add_node("synthesis_node", synthesis_node)
builder.add_node("output", output_node)

builder.add_edge(START, "role_generator")
builder.add_conditional_edges("role_generator", fan_out_roles, ["expert_node"])
builder.add_edge("expert_node", "prepare_reconcile_node")
builder.add_conditional_edges("prepare_reconcile_node", fan_out_reconcile, ["reconcile_role_node"])
builder.add_edge("reconcile_role_node", "critique_node")
builder.add_edge("critique_node", "negotiator")
builder.add_edge("negotiator", "synthesis_node")
builder.add_edge("synthesis_node", "output")
builder.add_edge("output", END)

compiled_graph = builder.compile()
