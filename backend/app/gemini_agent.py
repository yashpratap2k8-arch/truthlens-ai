"""TruthLens Gemini Agent: Context-aware AI verification and explainability service.

Integrates Google Gemini API into TruthLens AI for:
- Grounded claim evaluation
- Factual question reasoning
- Evidence synthesis and explanation
- Cross-referencing ML predictions with real-world verification
"""
import logging
import os
from typing import Any, Dict, List, Optional
from .ai_provider import GeminiProvider

log = logging.getLogger("analyzer.gemini_agent")

# Initialize backend provider singleton
_gemini_provider = GeminiProvider()


def is_gemini_available() -> bool:
    """Returns True if the Gemini API key is configured on the backend."""
    return _gemini_provider.is_configured


def evaluate_claim_with_gemini(
    claim_text: str,
    article_text: Optional[str] = None,
    title: Optional[str] = None,
    source_domain: Optional[str] = None,
    ml_prediction: Optional[str] = None,
    ml_confidence: Optional[str] = None,
    external_evidence: Optional[str] = None,
    evidence_items: Optional[List[Dict[str, Any]]] = None,
    fact_check_results: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates a claim using Google Gemini with context awareness and search grounding.
    Adheres strictly to the evidence hierarchy:
    - Never blindly trusts ML prediction.
    - Only marks Verified True or False when solid evidence is present.
    - Preserves Needs Verification when reliable evidence is missing.
    """
    if not is_gemini_available():
        return {
            "status": "unavailable",
            "message": "Gemini API is not configured on the server. Falling back to rule-based verification.",
            "verification_status": "Needs Verification",
            "evidence_strength": "None",
            "ai_assessment": "Gemini AI agent is not configured; status is based on external fact-check databases.",
            "final_conclusion": "TruthLens cannot currently confirm or debunk this claim.",
            "missing_evidence_note": "Direct independent verification required.",
            "grounding_sources": [],
        }

    return _gemini_provider.evaluate_claim_verification(
        claim_text=claim_text,
        article_text=article_text,
        title=title,
        source_domain=source_domain,
        ml_prediction=ml_prediction,
        ml_confidence=ml_confidence,
        external_evidence=external_evidence,
        evidence_items=evidence_items,
    )


def chat_with_gemini(message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Direct explainability chat with Gemini.
    Answers user questions such as:
    - 'Why is this claim suspicious?'
    - 'What evidence supports this?'
    - 'Is this verified?'
    """
    if not is_gemini_available():
        return {
            "success": False,
            "message": "Gemini API key is not configured on the backend. Please check GEMINI_API_KEY.",
        }

    return _gemini_provider.generate_chat_response(message, context)
