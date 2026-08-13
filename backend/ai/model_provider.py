import os
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Global runtime provider override
_ACTIVE_PROVIDER_OVERRIDE: str = None


class BaseAIProvider(ABC):
    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Return a dictionary parsed from the LLM's structured output."""
        pass


class MockProvider(BaseAIProvider):

    _TEMPLATES = [
        {
            "keywords": ["flood", "disaster", "emergency", "crisis", "storm", "earthquake",
                         "wildfire", "hurricane", "rescue"],
            "domain": "Disaster Management",
            "complexity": "high",
            "subtasks": [
                "Emergency situation assessment and risk mapping",
                "Resource and logistics planning",
                "Medical response and triage coordination",
                "Evacuation route planning",
                "Budget and funding allocation",
                "Communication and public alert system",
                "Post-disaster recovery planning",
            ],
            "required_roles": [
                "Emergency Planner",
                "Logistics Expert",
                "Medical Response Coordinator",
                "Risk Analyst",
                "Finance Manager",
                "Communications Officer",
            ],
        },
        {
            "keywords": ["e-commerce", "ecommerce", "online store", "shop", "marketplace",
                         "product", "cart", "checkout", "payment"],
            "domain": "E-Commerce",
            "complexity": "medium",
            "subtasks": [
                "Product catalog design and management",
                "Payment gateway integration",
                "User authentication and profile management",
                "Shopping cart and checkout flow",
                "Inventory and order management",
                "SEO and marketing strategy",
                "Customer support system",
            ],
            "required_roles": [
                "Frontend Developer",
                "Backend Developer",
                "UX/UI Designer",
                "Payment Systems Specialist",
                "SEO Strategist",
                "Customer Experience Manager",
            ],
        },
        {
            "keywords": ["college", "university", "event", "festival", "conference",
                         "seminar", "students", "campus", "hackathon"],
            "domain": "Event Management",
            "complexity": "medium",
            "subtasks": [
                "Event concept and theme planning",
                "Venue selection and booking",
                "Budget planning and sponsorship",
                "Volunteer and staff coordination",
                "Marketing and promotion",
                "Logistics and catering",
                "Technical setup and AV management",
                "Post-event feedback and reporting",
            ],
            "required_roles": [
                "Event Coordinator",
                "Marketing Specialist",
                "Finance Officer",
                "Logistics Manager",
                "Volunteer Coordinator",
                "Technical Support Lead",
            ],
        },
        {
            "keywords": ["mobile app", "ios", "android", "flutter", "react native",
                         "smartphone", "app store"],
            "domain": "Mobile Application Development",
            "complexity": "high",
            "subtasks": [
                "Requirements gathering and feature scoping",
                "UI/UX wireframing and prototyping",
                "Core feature development",
                "API and backend integration",
                "Quality assurance and testing",
                "App store submission and compliance",
                "Post-launch monitoring and updates",
            ],
            "required_roles": [
                "Product Manager",
                "Mobile Developer",
                "UX/UI Designer",
                "Backend Engineer",
                "QA Engineer",
                "DevOps Engineer",
            ],
        },
        {
            "keywords": ["healthcare", "hospital", "patient", "medical", "clinic",
                         "doctor", "health", "telemedicine"],
            "domain": "Healthcare",
            "complexity": "high",
            "subtasks": [
                "Patient needs assessment and data gathering",
                "Regulatory compliance review (HIPAA/local)",
                "Medical workflow design",
                "Electronic health record (EHR) integration",
                "Privacy and security implementation",
                "Staff training and onboarding",
                "Quality assurance and audit",
            ],
            "required_roles": [
                "Healthcare Project Manager",
                "Medical Domain Expert",
                "Software Engineer",
                "Compliance Officer",
                "Data Privacy Specialist",
                "UX Designer",
            ],
        },
        {
            "keywords": ["education", "learning", "school", "course", "curriculum",
                         "lms", "training", "tutorial", "edtech"],
            "domain": "Education Technology",
            "complexity": "medium",
            "subtasks": [
                "Learning objectives and curriculum design",
                "Content creation and multimedia production",
                "Platform/LMS development",
                "Assessment and quiz module",
                "Student progress tracking",
                "Instructor management system",
                "Marketing and student enrollment",
            ],
            "required_roles": [
                "Instructional Designer",
                "Content Creator",
                "Full-Stack Developer",
                "Data Analyst",
                "Marketing Specialist",
                "Student Success Manager",
            ],
        },
        {
            "keywords": ["finance", "fintech", "banking", "investment", "trading",
                         "budget", "accounting", "tax"],
            "domain": "Finance & FinTech",
            "complexity": "high",
            "subtasks": [
                "Financial requirements and regulatory analysis",
                "Risk assessment and compliance review",
                "Core financial logic development",
                "Security and fraud detection",
                "Reporting and analytics dashboard",
                "User onboarding and KYC flow",
                "Audit and testing",
            ],
            "required_roles": [
                "Financial Analyst",
                "Compliance Officer",
                "Backend Engineer",
                "Security Specialist",
                "Data Scientist",
                "UX Designer",
            ],
        },
    ]

    def _match_template(self, user_prompt: str) -> dict:
        lowered = user_prompt.lower()
        for tpl in self._TEMPLATES:
            if any(kw in lowered for kw in tpl["keywords"]):
                return tpl
        return {
            "domain": "General Engineering",
            "complexity": "medium",
            "subtasks": [
                "Requirements gathering and analysis",
                "System design and architecture",
                "Implementation and development",
                "Testing and quality assurance",
                "Deployment and monitoring",
            ],
            "required_roles": [
                "Project Manager",
                "Systems Architect",
                "Software Engineer",
                "QA Specialist",
                "DevOps Engineer",
            ],
        }

    def generate(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        logger.error("🚨 [MOCK_PROVIDER_ALERT] MockProvider invoked! sys_prompt=%r user_prompt=%r", system_prompt[:100], user_prompt[:100])
        tpl = self._match_template(user_prompt)
        sys_lower = system_prompt.lower()

        # Check if caller expects code or HTML synthesis
        if "code" in sys_lower or "html" in sys_lower or "synthesis" in sys_lower:
            return {
                "code": (
                    "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n"
                    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
                    "<title>NextGen E-Commerce Experience</title>\n"
                    "<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap\" rel=\"stylesheet\">\n"
                    "<style>\n"
                    ":root { --bg: #0f172a; --card: #1e293b; --accent: #38bdf8; --text: #f8fafc; }\n"
                    "body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; }\n"
                    ".header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; background: #020617; border-b: 1px solid #1e293b; }\n"
                    ".logo { font-size: 1.5rem; font-weight: 800; color: var(--accent); }\n"
                    ".nav { display: flex; gap: 1.5rem; list-style: none; font-size: 0.9rem; font-weight: 600; color: #94a3b8; }\n"
                    ".hero { text-align: center; padding: 5rem 2rem; background: radial-gradient(circle at top, #1e293b 0%, #0f172a 100%); border-b: 1px solid #1e293b; }\n"
                    ".hero h1 { font-size: 3rem; font-weight: 800; color: var(--text); margin-bottom: 1rem; }\n"
                    ".hero p { font-size: 1.15rem; color: #94a3b8; max-width: 650px; margin: 0 auto 2.5rem; }\n"
                    ".btn { background: var(--accent); color: #0f172a; font-weight: 800; padding: 0.85rem 2rem; border-radius: 9999px; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(56,189,248,0.4); }\n"
                    ".btn:hover { background: #7dd3fc; transform: translateY(-2px); }\n"
                    ".grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; padding: 4rem 2rem; max-width: 1200px; margin: 0 auto; }\n"
                    ".card { background: var(--card); border: 1px solid #334155; border-radius: 1.25rem; padding: 1.75rem; text-align: center; transition: all 0.3s; }\n"
                    ".card:hover { border-color: var(--accent); transform: translateY(-4px); }\n"
                    ".card h3 { color: #f1f5f9; margin-top: 0.5rem; font-size: 1.2rem; }\n"
                    ".price { color: var(--accent); font-weight: 800; font-size: 1.4rem; margin: 0.75rem 0 1.25rem; }\n"
                    "</style>\n</head>\n<body>\n"
                    "<header class=\"header\"><div class=\"logo\">Lumina Tech</div><ul class=\"nav\"><li>Products</li><li>Features</li><li>Support</li></ul><button class=\"btn\" onclick=\"alert('Cart Drawer Opened!')\">Cart (0)</button></header>\n"
                    "<div class=\"hero\">\n"
                    "  <h1>Next-Generation E-Commerce Store</h1>\n"
                    "  <p>Experience ultra-responsive shopping with AI-curated hardware and instant checkout.</p>\n"
                    "  <button class=\"btn\" onclick=\"alert('Exploring Store Collection!')\">Explore Catalog</button>\n"
                    "</div>\n"
                    "<div class=\"grid\">\n"
                    "  <div class=\"card\"><h3>Wireless Active Noise Headphones</h3><div class=\"price\">$299.99</div><button class=\"btn\" onclick=\"alert('Headphones added to cart!')\">Add to Cart</button></div>\n"
                    "  <div class=\"card\"><h3>Custom Mechanical Keyboard</h3><div class=\"price\">$189.99</div><button class=\"btn\" onclick=\"alert('Keyboard added to cart!')\">Add to Cart</button></div>\n"
                    "  <div class=\"card\"><h3>Ergonomic Precision Wireless Mouse</h3><div class=\"price\">$89.99</div><button class=\"btn\" onclick=\"alert('Mouse added to cart!')\">Add to Cart</button></div>\n"
                    "</div>\n"
                    "</body>\n</html>"
                ),
                "output": f"# Executive Solution Strategy: {user_prompt}\n\n## Implementation Plan\nComprehensive strategy synthesized for {user_prompt}."
            }

        # Check if caller expects an expert proposal
        if "proposal" in sys_lower or "confidence" in sys_lower or "reasoning" in sys_lower:
            return {
                "proposal": f"Detailed operational plan addressing '{user_prompt}' with priority allocation, contingency workflows, and resource mobilization.",
                "confidence": 0.92,
                "reasoning": f"This plan leverages domain-specific best practices for {tpl['domain']} to minimize operational risk and optimize execution efficiency."
            }
            
        # Default role generator response
        return {
            "goal": user_prompt,
            "domain": tpl["domain"],
            "complexity": tpl["complexity"],
            "subtasks": tpl["subtasks"],
            "roles": tpl["required_roles"][:3],
            "required_roles": tpl["required_roles"][:3],
        }


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


class GeminiProvider(BaseAIProvider):
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY not set in environment")
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            self.use_client = True
        except Exception as e:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-3.1-flash-lite")
                self.use_client = False
            except Exception as ex:
                raise RuntimeError(f"Failed to initialize Gemini SDK: {e} | {ex}")

    def generate(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        import json
        models_to_try = [os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"), "gemini-3.5-flash", "gemini-3.6-flash"]
        last_error = None

        for m_name in models_to_try:
            try:
                if getattr(self, "use_client", True):
                    response = self.client.models.generate_content(
                        model=m_name,
                        contents=f"{system_prompt}\n\n{user_prompt}",
                        config={"response_mime_type": "application/json"},
                    )
                    text = _clean_json_str(response.text)
                    return json.loads(text)
                else:
                    response = self.model.generate_content(
                        [system_prompt, user_prompt],
                        generation_config={"response_mime_type": "application/json"},
                    )
                    text = _clean_json_str(response.text)
                    return json.loads(text)
            except Exception as exc:
                last_error = exc
                logger.warning("[AI_PROVIDER_RETRY] Gemini model %s failed (%s); trying next fallback model.", m_name, exc)
                import time
                time.sleep(2.0)
                continue

        logger.error("[AI_PROVIDER_ERROR] All Gemini models failed (%s). Raising exception.", last_error)
        raise RuntimeError(f"All Gemini LLM models failed after retries: {last_error}")




class GroqProvider(BaseAIProvider):
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY") or os.getenv("LLM_API_KEY")
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY not set in environment")
        try:
            import openai
            if hasattr(openai, "OpenAI"):
                self.client = openai.OpenAI(api_key=self.api_key, base_url="https://api.groq.com/openai/v1")
                self.is_v1 = True
            else:
                openai.api_key = self.api_key
                openai.api_base = "https://api.groq.com/openai/v1"
                self.client = openai
                self.is_v1 = False
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Groq SDK: {e}")

    def generate(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        import json
        model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        if getattr(self, "is_v1", True):
            response = self.client.chat.completions.create(
                model=model_name,
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
        else:
            response = self.client.ChatCompletion.create(
                model=model_name,
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
        return json.loads(content)


class GrokProvider(BaseAIProvider):
    def __init__(self):
        self.api_key = os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("GROK_API_KEY not set in environment")
        try:
            import openai
            if hasattr(openai, "OpenAI"):
                self.client = openai.OpenAI(api_key=self.api_key, base_url="https://api.x.ai/v1")
                self.is_v1 = True
            else:
                openai.api_key = self.api_key
                openai.api_base = "https://api.x.ai/v1"
                self.client = openai
                self.is_v1 = False
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Grok SDK: {e}")

    def generate(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        import json
        model_name = os.getenv("GROK_MODEL", "grok-3")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        try:
            if getattr(self, "is_v1", True):
                response = self.client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
            else:
                response = self.client.ChatCompletion.create(
                    model=model_name,
                    messages=messages,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content
            return json.loads(content)
        except Exception as exc:
            logger.error("[AI_PROVIDER_ERROR] Grok API call failed (%s). Raising exception.", exc)
            raise RuntimeError(f"Grok API call failed: {exc}")



def set_active_provider(mode: str):
    """Set active AI provider mode dynamically ('mock', 'gemini', 'openai', 'groq', 'grok')."""
    global _ACTIVE_PROVIDER_OVERRIDE
    _ACTIVE_PROVIDER_OVERRIDE = mode.lower().strip()
    logger.info("[AI_PROVIDER_SWITCH] Active provider set to %s", _ACTIVE_PROVIDER_OVERRIDE)


def get_active_provider_info() -> Dict[str, Any]:
    """Get active provider name, mock status, and key availability."""
    global _ACTIVE_PROVIDER_OVERRIDE
    provider = _ACTIVE_PROVIDER_OVERRIDE or os.getenv("AI_PROVIDER", "mock").lower()
    mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true" if not _ACTIVE_PROVIDER_OVERRIDE else (_ACTIVE_PROVIDER_OVERRIDE == "mock")
    
    gemini_key = bool(os.getenv("GEMINI_API_KEY", "").strip())
    openai_key = bool(os.getenv("OPENAI_API_KEY", "").strip())
    groq_key = bool((os.getenv("GROQ_API_KEY", "") or os.getenv("LLM_API_KEY", "")).strip())
    grok_key = bool((os.getenv("GROK_API_KEY", "") or os.getenv("XAI_API_KEY", "")).strip())

    return {
        "active_provider": provider,
        "mock_mode": mock_mode,
        "gemini_key_set": gemini_key,
        "openai_key_set": openai_key,
        "groq_key_set": groq_key,
        "grok_key_set": grok_key,
    }


def get_provider() -> BaseAIProvider:
    info = get_active_provider_info()
    provider_name = info["active_provider"]

    if info["mock_mode"] or provider_name == "mock":
        return MockProvider()

    if provider_name == "gemini":
        try:
            return GeminiProvider()
        except Exception as e:
            logger.warning("[AI_PROVIDER_FALLBACK] Gemini initialization failed (%s); falling back to MockProvider.", e)
            return MockProvider()



    if provider_name == "groq":
        try:
            return GroqProvider()
        except Exception as e:
            logger.warning("[AI_PROVIDER_FALLBACK] Groq initialization failed (%s); falling back to MockProvider.", e)
            return MockProvider()

    if provider_name == "grok":
        try:
            return GrokProvider()
        except Exception as e:
            logger.warning("[AI_PROVIDER_FALLBACK] Grok initialization failed (%s); falling back to MockProvider.", e)
            return MockProvider()

    return MockProvider()

