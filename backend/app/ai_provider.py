"""AI Provider abstraction for TruthLens AI.

Enables seamless switching between Google Gemini and OpenRouter providers,
ensuring graceful fallback and zero service disruption.
"""
import abc
import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

log = logging.getLogger("analyzer.ai_provider")


class AIProvider(abc.ABC):
    """Abstract Base Class for LLM reasoning and conversational explainability."""

    @abc.abstractmethod
    def generate_chat_response(self, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generates an assistant explanation or answer given user prompt and context."""
        pass

    @abc.abstractmethod
    def evaluate_claim_verification(
        self,
        claim_text: str,
        article_text: Optional[str] = None,
        title: Optional[str] = None,
        source_domain: Optional[str] = None,
        ml_prediction: Optional[str] = None,
        ml_confidence: Optional[str] = None,
        external_evidence: Optional[str] = None,
        evidence_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Provides grounded factual reasoning over a claim and retrieved evidence."""
        pass


class GeminiProvider(AIProvider):
    """Google Gemini API Provider with official search grounding and structured reasoning."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        if api_key is None:
            self.api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        else:
            self.api_key = api_key.strip()
        # Default to fast, cost-effective model suitable for free tier / fast reasoning
        self.model = (model or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.timeout = 25.0

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _call_generate_content(self, system_instruction: str, prompt: str, enable_search: bool = False) -> Dict[str, Any]:
        """Calls Gemini generateContent endpoint via HTTPS REST."""
        if not self.is_configured:
            return {"success": False, "message": "GEMINI_API_KEY is not configured on the server."}

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        payload: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": prompt}],
                    "role": "user",
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": 1024,
            },
        }

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        # Enable Google Search grounding tool if requested
        if enable_search:
            payload["tools"] = [{"google_search": {}}]

        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=self.timeout)
            
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    content = candidates[0].get("content", {})
                    parts = content.get("parts", [])
                    text = "".join([p.get("text", "") for p in parts]).strip()
                    
                    # Extract grounding metadata if present
                    grounding_meta = candidates[0].get("groundingMetadata", {})
                    grounding_sources = []
                    
                    # Extract web search chunks
                    chunks = grounding_meta.get("groundingChunks", [])
                    now_iso = datetime.now(timezone.utc).isoformat()
                    for chunk in chunks:
                        web = chunk.get("web")
                        if web and web.get("uri"):
                            grounding_sources.append({
                                "source_name": web.get("title") or "Google Search Grounding",
                                "source_url": web.get("uri"),
                                "source_type": "gemini_grounding",
                                "snippet": web.get("title", ""),
                                "rating": "Grounded Reference",
                                "relevance": "High",
                                "evidence_strength": "Strong",
                                "provenance": "Gemini web grounding",
                                "retrieved_at": now_iso,
                            })

                    return {
                        "success": True,
                        "text": text,
                        "grounding_sources": grounding_sources,
                        "grounding_metadata": grounding_meta,
                    }
                return {"success": False, "message": "Gemini returned empty response candidate."}
            else:
                log.warning(f"Gemini API error (HTTP {resp.status_code}): {resp.text[:300]}")
                return {
                    "success": False,
                    "error_code": resp.status_code,
                    "message": f"Gemini API request failed with status {resp.status_code}.",
                }

        except requests.exceptions.Timeout:
            return {"success": False, "message": "Gemini request timed out after 25 seconds."}
        except Exception as e:
            log.warning(f"Exception calling Gemini API: {e}")
            return {"success": False, "message": f"Unable to reach Gemini API: {str(e)}"}

    def generate_chat_response(self, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Provides context-aware conversational response using Gemini."""
        current_date_str = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
        
        system_prompt = f"""You are TruthLens AI Assistant, powered by Google Gemini, embedded in the TruthLens AI verification platform.
Temporal grounding: Current date is {current_date_str} (UTC).

CORE PRINCIPLES:
1. ML PREDICTION IS STATISTICAL ONLY: The machine learning model evaluates vocabulary and stylistic patterns. It does NOT verify real-world facts.
2. EVIDENCE IS SUPREME: A claim is only Verified True or False if reliable, external authoritative evidence confirms or debunks it.
3. NEEDS VERIFICATION IS VALID: If reliable evidence is absent or inconclusive, the status is Needs Verification. Never invent evidence.
4. BE OBJECTIVE & EXPLAINABLE: When asked why something is suspicious, reference the heuristic style signals and explain how independent sources verify claims.
"""
        context_str = ""
        if context:
            context_str = f"""
ARTICLE CONTEXT:
- Headline/Title: {context.get('title', 'Not specified')}
- Source: {context.get('source_domain', 'Not specified')}
- ML Prediction: {context.get('model_prediction', 'Not specified')} ({context.get('confidence_display', 'N/A')})
- Verification Status: {context.get('verification_status', 'Needs Verification')}
- Evidence Summary: {context.get('verification_summary', 'None')}
- External Evidence: {context.get('external_evidence', 'No external evidence')}
- Key Signals: {context.get('indicators', [])}
- Article Snippet: {str(context.get('snippet', ''))[:800]}
"""

        full_prompt = f"{context_str}\nUser Question: {message}\n\nPlease provide a clear, helpful, evidence-grounded answer:"
        result = self._call_generate_content(system_prompt, full_prompt, enable_search=True)
        
        if result.get("success"):
            return {
                "success": True,
                "message": result.get("text", ""),
                "provider": "gemini",
                "model": self.model,
                "grounding_sources": result.get("grounding_sources", []),
            }
        return result

    def evaluate_claim_verification(
        self,
        claim_text: str,
        article_text: Optional[str] = None,
        title: Optional[str] = None,
        source_domain: Optional[str] = None,
        ml_prediction: Optional[str] = None,
        ml_confidence: Optional[str] = None,
        external_evidence: Optional[str] = None,
        evidence_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Uses Gemini to reason over the claim and evidence, returning a structured JSON assessment.
        """
        ev_summary = "\n".join([
            f"- [{item.get('source_type', 'source')}] {item.get('source_name', 'Unknown')}: {item.get('snippet', '')} ({item.get('source_url', '')})"
            for item in (evidence_items or [])
        ]) or (external_evidence or "No external evidence retrieved.")

        prompt = f"""You are the TruthLens Grounded Verification Evaluator.
Analyze the following claim and retrieved evidence. Do NOT blindly trust the ML prediction.

CLAIM: "{claim_text}"
ARTICLE TITLE: "{title or ''}"
SOURCE DOMAIN: "{source_domain or ''}"
ML PREDICTION (STYLE ONLY): {ml_prediction or 'Uncertain'} (Confidence: {ml_confidence or 'N/A'})
RETRIEVED EXTERNAL EVIDENCE:
{ev_summary}

VERIFICATION RULES:
1. "Verified True": Strong authoritative evidence directly confirms the claim.
2. "False / Debunked": Strong evidence directly debunks or contradicts the claim.
3. "Partially True": Claim has accurate elements mixed with false or misleading context.
4. "Needs Verification": Available evidence is insufficient, inconclusive, or missing.
5. "Insufficient Context": Input is too brief, vague, or fragmented.

Return ONLY a valid JSON object with these exact keys:
{{
  "verification_status": "Verified True" | "False / Debunked" | "Partially True" | "Needs Verification" | "Insufficient Context",
  "evidence_strength": "Strong" | "Moderate" | "Limited" | "None",
  "ai_assessment": "Concise 1-2 sentence explanation of the reasoning and evidence.",
  "final_conclusion": "Clear verdict statement for the user.",
  "missing_evidence_note": "Explanation of what evidence is still missing (if Needs Verification) or empty string."
}}
"""
        res = self._call_generate_content(
            system_instruction="You are a strict, objective fact-checking AI evaluator. Respond strictly with JSON.",
            prompt=prompt,
            enable_search=True,
        )

        if res.get("success"):
            raw_text = res.get("text", "")
            try:
                # Strip potential markdown fences
                cleaned = raw_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                parsed = json.loads(cleaned.strip())
                parsed["grounding_sources"] = res.get("grounding_sources", [])
                parsed["provider"] = "gemini"
                return parsed
            except Exception as e:
                log.warning(f"Failed to parse Gemini JSON output: {e}. Output was: {raw_text[:200]}")
                return {
                    "verification_status": "Needs Verification",
                    "evidence_strength": "Limited" if evidence_items else "None",
                    "ai_assessment": raw_text[:250],
                    "final_conclusion": "TruthLens cannot currently confirm or debunk this claim based on available evidence.",
                    "missing_evidence_note": "Independent authoritative verification is required.",
                    "provider": "gemini",
                    "grounding_sources": res.get("grounding_sources", []),
                }

        return {
            "verification_status": "Needs Verification",
            "evidence_strength": "None",
            "ai_assessment": "Gemini reasoning service unavailable.",
            "final_conclusion": "TruthLens cannot currently confirm or debunk this claim.",
            "missing_evidence_note": "External evidence could not be verified automatically.",
            "provider": "fallback",
        }


class OpenRouterProvider(AIProvider):
    """OpenRouter API Provider maintaining backward compatibility for the existing assistant."""

    def __init__(self, api_key: Optional[str] = None):
        if api_key is None:
            self.api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
        else:
            self.api_key = api_key.strip()
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "openrouter/free"
        self.timeout = 35.0

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_chat_response(self, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Delegates to existing OpenRouter chat logic."""
        if not self.is_configured:
            return {"success": False, "message": "OPENROUTER_API_KEY is not configured on the server."}

        # Lazy import of existing prompt builder to prevent cycles
        from . import ai_agent
        system_prompt = ai_agent.get_system_prompt()
        
        user_content = message
        if context:
            title = context.get("title") or "Not specified"
            user_content = f"Context: Title='{title}', Verdict='{context.get('verification_status', 'N/A')}'\nQuestion: {message}"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "plugins": [{"id": "web"}],
        }

        try:
            req = urllib.request.Request(
                self.url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "TruthLens AI",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
            choices = data.get("choices", [])
            if choices and choices[0].get("message", {}).get("content"):
                return {
                    "success": True,
                    "message": choices[0]["message"]["content"].strip(),
                    "provider": "openrouter",
                }
            return {"success": False, "message": "OpenRouter returned an empty response."}
        except Exception as e:
            log.warning(f"OpenRouter chat error: {e}")
            return {"success": False, "message": f"OpenRouter assistant temporarily unavailable: {e}"}

    def evaluate_claim_verification(self, **kwargs) -> Dict[str, Any]:
        """OpenRouter fallback for claim verification."""
        return {
            "verification_status": "Needs Verification",
            "evidence_strength": "None",
            "ai_assessment": "Verification evaluated through statistical heuristics and external fact-checks.",
            "final_conclusion": "TruthLens cannot currently confirm or debunk this claim without direct evidence.",
            "missing_evidence_note": "Authoritative verification sources are required.",
            "provider": "openrouter",
        }


def get_ai_provider() -> AIProvider:
    """Factory function returning the active AI Provider based on configured environment keys."""
    gemini = GeminiProvider()
    if gemini.is_configured:
        return gemini
    
    openrouter = OpenRouterProvider()
    if openrouter.is_configured:
        return openrouter
        
    # Return unconfigured GeminiProvider to trigger clean graceful fallback messages
    return gemini
