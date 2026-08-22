import json
import logging
from .models import GoalAnalysis, AgentRole, Subtask, OrganizationPlan
from typing import List
try:
    from ai.model_provider import get_provider
except ImportError:
    from ..ai.model_provider import get_provider

logger = logging.getLogger(__name__)

# Role descriptions library — used to auto-generate rich descriptions for any role name.
# The builder tries an exact match first, then a keyword match, then a generic fallback.
_ROLE_DESCRIPTIONS: dict = {
    "Emergency Planner": {
        "description": "Designs and coordinates the overall emergency response strategy.",
        "responsibilities": [
            "Assess the scale and severity of the emergency",
            "Define response priorities and operational phases",
            "Coordinate all departments and stakeholders",
            "Ensure compliance with emergency protocols",
        ],
    },
    "Logistics Expert": {
        "description": "Manages the supply chain, equipment, and resource distribution.",
        "responsibilities": [
            "Procure and allocate critical resources",
            "Coordinate transportation and distribution networks",
            "Maintain inventory and track resource utilization",
            "Optimize supply chain under constraints",
        ],
    },
    "Medical Response Coordinator": {
        "description": "Coordinates all medical personnel and healthcare resources.",
        "responsibilities": [
            "Set up triage centers and field hospitals",
            "Coordinate with hospitals and paramedic teams",
            "Manage medical supplies and pharmaceuticals",
            "Track casualties and patient outcomes",
        ],
    },
    "Risk Analyst": {
        "description": "Identifies, quantifies, and mitigates risks throughout the project.",
        "responsibilities": [
            "Conduct risk identification and probability assessment",
            "Build risk matrices and mitigation plans",
            "Monitor risk indicators during execution",
            "Report risk status to stakeholders",
        ],
    },
    "Finance Manager": {
        "description": "Oversees budget planning, allocation, and financial reporting.",
        "responsibilities": [
            "Develop and manage the project budget",
            "Track expenditures against allocations",
            "Identify funding sources and manage grants",
            "Prepare financial reports and audits",
        ],
    },
    "Communications Officer": {
        "description": "Handles all internal and public-facing communications.",
        "responsibilities": [
            "Draft and distribute public alerts and updates",
            "Manage media relations and press briefings",
            "Maintain internal communication channels",
            "Coordinate messaging across all teams",
        ],
    },
    "Project Manager": {
        "description": "Leads the project from initiation to delivery.",
        "responsibilities": [
            "Define project scope, timeline, and milestones",
            "Coordinate cross-functional teams",
            "Manage risks, issues, and changes",
            "Deliver status reports to stakeholders",
        ],
    },
    "Software Engineer": {
        "description": "Designs, codes, tests, and maintains software systems.",
        "responsibilities": [
            "Implement core application features",
            "Write clean, maintainable, and tested code",
            "Participate in code reviews",
            "Integrate with third-party APIs and services",
        ],
    },
    "Frontend Developer": {
        "description": "Builds responsive, accessible user interfaces.",
        "responsibilities": [
            "Implement UI components per design specifications",
            "Ensure cross-browser and mobile compatibility",
            "Optimize page performance and load times",
            "Integrate with backend APIs",
        ],
    },
    "Backend Developer": {
        "description": "Develops server-side logic, databases, and APIs.",
        "responsibilities": [
            "Design and implement RESTful APIs",
            "Manage database schemas and migrations",
            "Implement authentication and authorization",
            "Ensure system scalability and reliability",
        ],
    },
    "UX/UI Designer": {
        "description": "Creates intuitive, beautiful user experiences and interfaces.",
        "responsibilities": [
            "Conduct user research and usability testing",
            "Produce wireframes, mockups, and prototypes",
            "Define visual design language and style guide",
            "Collaborate with developers on implementation",
        ],
    },
    "QA Engineer": {
        "description": "Ensures product quality through rigorous testing strategies.",
        "responsibilities": [
            "Design and execute test plans and test cases",
            "Perform functional, regression, and performance testing",
            "Report, track, and verify bug fixes",
            "Automate repetitive testing workflows",
        ],
    },
    "DevOps Engineer": {
        "description": "Manages infrastructure, CI/CD pipelines, and deployments.",
        "responsibilities": [
            "Set up and maintain CI/CD pipelines",
            "Manage cloud infrastructure and containerization",
            "Monitor system health and respond to incidents",
            "Automate infrastructure provisioning",
        ],
    },
    "Data Scientist": {
        "description": "Extracts insights from data using statistical and ML methods.",
        "responsibilities": [
            "Collect, clean, and preprocess datasets",
            "Build and validate predictive models",
            "Visualize findings for stakeholders",
            "Deploy models to production environments",
        ],
    },
    "Marketing Specialist": {
        "description": "Drives user acquisition, brand awareness, and engagement.",
        "responsibilities": [
            "Develop and execute marketing campaigns",
            "Manage social media and content strategy",
            "Analyze campaign performance and ROI",
            "Coordinate with design for creative assets",
        ],
    },
    "Event Coordinator": {
        "description": "Plans and oversees all aspects of event execution.",
        "responsibilities": [
            "Define event objectives, timeline, and budget",
            "Coordinate vendors, venues, and suppliers",
            "Manage attendee registration and experience",
            "Oversee day-of logistics and troubleshooting",
        ],
    },
    "Security Specialist": {
        "description": "Protects systems, data, and users from security threats.",
        "responsibilities": [
            "Conduct threat modeling and vulnerability assessments",
            "Implement encryption, authentication, and access controls",
            "Monitor systems for security incidents",
            "Develop and enforce security policies",
        ],
    },
    "Compliance Officer": {
        "description": "Ensures adherence to legal, regulatory, and policy requirements.",
        "responsibilities": [
            "Identify applicable regulations and standards",
            "Develop compliance frameworks and checklists",
            "Conduct internal audits and risk assessments",
            "Train teams on compliance requirements",
        ],
    },
}

_GENERIC_ROLE_TEMPLATE = {
    "description": "Specialized expert contributing core domain knowledge and execution.",
    "responsibilities": [
        "Define objectives and success criteria for the assigned area",
        "Execute deliverables according to the project plan",
        "Coordinate with other team members",
        "Report progress and escalate blockers",
    ],
}


def _get_role_description(role_name: str) -> dict:
    """Return description and responsibilities for a role, with keyword fallback."""
    # Exact match
    if role_name in _ROLE_DESCRIPTIONS:
        return _ROLE_DESCRIPTIONS[role_name]
    # Keyword match
    lower = role_name.lower()
    for key, val in _ROLE_DESCRIPTIONS.items():
        if key.lower() in lower or lower in key.lower():
            return val
        # Check individual keywords
        for word in key.lower().split():
            if len(word) > 4 and word in lower:
                return val
    return _GENERIC_ROLE_TEMPLATE


def _assign_role_to_subtask(subtask_title: str, roles: List[str]) -> str:
    """Assign the most relevant role to a subtask based on keyword proximity."""
    lowered = subtask_title.lower()
    # Simple heuristic: find the role whose name shares the most words with the subtask
    best_role = roles[0] if roles else "Project Manager"
    best_score = 0
    for role in roles:
        score = sum(1 for word in role.lower().split() if len(word) > 3 and word in lowered)
        if score > best_score:
            best_score = score
            best_role = role
    return best_role


def build_organization(analysis: GoalAnalysis) -> OrganizationPlan:
    """Given a validated GoalAnalysis, dynamically build a rich OrganizationPlan using the LLM.
    Generates tailored role descriptions, responsibility lists, and subtask details.
    """
    logger.info("[ORGANIZATION_CREATED] Dynamically building organization for goal=%r domain=%s", analysis.goal, analysis.domain)

    provider = get_provider()
    
    system_prompt = (
        "You are an AI Organization Design Expert. Given a goal, domain, subtasks, and required roles, "
        "generate a JSON object containing detailed, goal-specific role descriptions, responsibility lists, "
        "and subtask descriptions. Output schema:\n"
        "{\n"
        "  \"roles\": [\n"
        "     {\n"
        "       \"name\": string,\n"
        "       \"description\": string,\n"
        "       \"responsibilities\": [string]\n"
        "     }\n"
        "  ],\n"
        "  \"subtasks\": [\n"
        "     {\n"
        "       \"title\": string,\n"
        "       \"description\": string,\n"
        "       \"assigned_role\": string\n"
        "     }\n"
        "  ]\n"
        "}\n"
        "Rules:\n"
        "1. Create one role entry for each role in required_roles.\n"
        "2. Create one subtask entry for each subtask in subtasks, assigning the best role from required_roles.\n"
        "3. Provide rich, highly specific descriptions grounded in the user's actual goal."
    )
    user_prompt = (
        f"Goal: {analysis.goal}\n"
        f"Domain: {analysis.domain}\n"
        f"Required Roles: {json.dumps(analysis.required_roles)}\n"
        f"Subtasks: {json.dumps(analysis.subtasks)}"
    )

    try:
        raw_data = provider.generate(system_prompt, user_prompt)
        if isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        
        agent_roles = [
            AgentRole(
                name=r.get("name", "Expert"),
                description=r.get("description", f"Specialized expert for {r.get('name')}"),
                responsibilities=r.get("responsibilities", ["Execute assigned subtasks", "Formulate domain strategy"])
            )
            for r in raw_data.get("roles", [])
        ]
        
        subtasks = [
            Subtask(
                title=s.get("title", "Subtask"),
                description=s.get("description", f"Detailed operational execution of {s.get('title')}"),
                assigned_role=s.get("assigned_role", analysis.required_roles[0] if analysis.required_roles else "Expert")
            )
            for s in raw_data.get("subtasks", [])
        ]

        if not agent_roles:
            raise ValueError("No roles returned from LLM")
            
    except Exception as exc:
        logger.warning("[ORG_BUILDER_FALLBACK] LLM organization generation failed (%s); building dynamic fallback.", exc)
        agent_roles = [
            AgentRole(
                name=role_name,
                description=f"Specialized AI agent leading {role_name} strategy for '{analysis.goal[:50]}'.",
                responsibilities=[
                    f"Define operational protocols for {role_name}",
                    f"Execute deliverables addressing {analysis.domain}",
                    "Coordinate risk mitigation and quality assurance"
                ]
            )
            for role_name in analysis.required_roles
        ]
        subtasks = [
            Subtask(
                title=subtask_title,
                description=f"Operational execution plan for {subtask_title.lower()} tailored to '{analysis.goal[:50]}'.",
                assigned_role=_assign_role_to_subtask(subtask_title, analysis.required_roles)
            )
            for subtask_title in analysis.subtasks
        ]

    plan = OrganizationPlan(
        roles=agent_roles,
        subtasks=subtasks,
        team_size=len(agent_roles),
    )
    logger.info("[ORGANIZATION_CREATED] team_size=%d subtasks=%d", plan.team_size, len(plan.subtasks))
    return plan
