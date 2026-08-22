import os
import json
import logging
from typing import Dict, Any
try:
    from ai.model_provider import get_provider
except ImportError:
    from ..ai.model_provider import get_provider
from .models import GoalAnalysis

logger = logging.getLogger(__name__)


def analyze_goal(goal: str) -> GoalAnalysis:
    """Send the user's goal to the LLM and parse the structured JSON response.
    Returns a validated GoalAnalysis Pydantic model.
    """
    logger.info("[GOAL_RECEIVED] goal=%r", goal)

    system_prompt = (
        "You are a goal analysis assistant. Given a user goal, respond with a JSON object that conforms to the following schema:\n"
        "{\n"
        "  \"goal\": string,\n"
        "  \"domain\": string,\n"
        "  \"complexity\": string,  // one of 'low', 'medium', 'high'\n"
        "  \"subtasks\": [string],\n"
        "  \"required_roles\": [string]\n"
        "}\n"
        "Provide concise but complete information. Do not add extra fields or explanatory text."
    )

    provider = get_provider()
    logger.info("[GOAL_ANALYZED] provider=%s", type(provider).__name__)

    raw_output = provider.generate(system_prompt, goal)

    # The provider may return a JSON string or dict.
    if isinstance(raw_output, str):
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            logger.error("[AGENT_FAILED] Failed to parse LLM output as JSON: %s | Output: %s", e, raw_output)
            raise RuntimeError(f"Failed to parse LLM output as JSON: {e}\nOutput: {raw_output}")
    else:
        data = raw_output

    result = GoalAnalysis(**data)
    logger.info("[GOAL_ANALYZED] parsed GoalAnalysis domain=%s complexity=%s", result.domain, result.complexity)
    return result
