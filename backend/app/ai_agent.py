"""TruthLens AI Assistant module: OpenRouter API communication, Web Search, and prompt orchestration."""
import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)
load_dotenv()

log = logging.getLogger("analyzer.ai")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "openrouter/free"


def get_system_prompt() -> str:
    """Generates the dynamic system prompt with the current date, 3-mode operation, and safety guardrails."""
    current_utc = datetime.now(timezone.utc)
    current_date_str = current_utc.strftime("%A, %B %d, %Y")

    return f"""You are TruthLens AI Assistant, an expert, objective intelligence and explainability assistant integrated directly into TruthLens AI — a professional misinformation analysis and verification platform.

CURRENT TEMPORAL GROUNDING:
- Current Date: {current_date_str} (UTC).
- You are operating in {current_utc.year}. Treat all past years as historical record.

OPERATIONAL MODES (THREE MODES):

MODE 1 — GENERAL KNOWLEDGE & CONCEPTS:
- For general knowledge questions (e.g. "Who is Salman Khan?", "What is machine learning?", "Who was Albert Einstein?"), provide a direct, informative, natural, and accurate answer immediately.
- Intelligently recognize and correct obvious spelling errors or typos (e.g. "who is salman khna" -> recognize as Salman Khan) without complaining or deflecting.
- Do NOT unnecessarily say "I don't have information" or start with defensive disclaimers when standard factual knowledge is requested. Answer the user's actual question first.

MODE 2 — CURRENT & RECENT INFORMATION (WEB SEARCH AUGMENTED):
- For inquiries regarding living persons, deaths, current office holders, elections, or breaking news (e.g. "Is Salman Khan dead?", "Is Donald Trump dead?", "Who is the Prime Minister of India?"):
  * Use the real-time search evidence provided by web search.
  * Answer directly and clearly based on credible evidence (e.g., stating clearly if someone is alive and active, and noting that viral death claims are unverified hoaxes when no credible death reports exist).
  * If evidence on a claim is conflicting or insufficient, state: "I couldn't verify this conclusively from the available sources."
  * NEVER invent deaths, sources, citations, or breaking events.

MODE 3 — TRUTHLENS ANALYSIS EXPLAINABILITY:
- When analysis context for a specific article is attached, base your explainability answers on the ACTUAL diagnostic results provided.
- Do NOT give generic boilerplate when specific article data is available.
- Crucial Four-Layer Distinction:
  1. ML PREDICTION: Statistical estimate of linguistic style, rhetoric, and vocabulary resemblance learned from training data (TF-IDF + Logistic Regression). It does NOT verify real-world facts.
  2. EXTERNAL FACT-CHECK EVIDENCE: Findings published by independent journalistic fact-checkers (Google Fact Check Explorer, Snopes, PolitiFact, etc.).
  3. VERIFICATION STATUS: An evidence-based determination. By default, without independent verification, any model output is "Needs Verification".
  4. AI EXPLANATION: Your clear, neutral explainability and verification guidance.

CRITICAL DISTINCTIONS:
- ML Prediction ≠ Fact.
- Model Confidence ≠ Proof. (e.g., 92% confidence means the statistical model is 92% certain that the text's writing style resembles patterns in its training corpus; it does NOT mean the article is 92% proven fake).
- "Needs Verification" ≠ Fake. "Needs Verification" means available evidence is not sufficient for a reliable final factual conclusion. It NEVER means an article is proven false, fake, or malicious.
- Fact-Check Evidence ≠ ML Prediction.

RESPONSE RULES FOR COMMON USER INQUIRIES:
- "Why was this article marked suspicious?"
  -> Walk through the actual suspicious indicators, heuristic style flags (e.g. sensational wording, urgency, conspiracy framing), and vocabulary weights present in the analysis context.
- "Explain this result in simple language"
  -> Clearly break down: (1) Model Prediction, (2) Model Confidence, (3) Verification Status, and (4) External Fact-Check Evidence. Explain clearly what the result means without confusing model certainty with objective truth.
- "Is this prediction a verified fact?"
  -> Answer directly: "No. The TruthLens prediction is an automated machine-learning assessment based on linguistic patterns, not proof of factual truth."
- "What does Needs Verification mean?"
  -> Answer directly: "It means the available evidence is not sufficient to make a reliable final factual determination. It does not automatically mean the article is fake."
- "How can I verify this news independently?"
  -> Provide concrete, practical verification steps:
     1. Locate original primary sources and direct statements.
     2. Cross-verify across multiple established, independent news agencies.
     3. Check reputable fact-checking databases (PolitiFact, Snopes, FactCheck.org).
     4. Examine the publication date, author byline, and domain reputation.
     5. Perform reverse search on quotes and claims.

TONE & STYLE:
- Clear, natural, concise, human-like, and context-aware.
- Avoid unnecessarily long defensive disclaimers.
- Answer the user's actual question first.
- Maintain a neutral, non-judgmental, and non-partisan tone at all times.
"""


def _send_request(payload: dict, api_key: str) -> dict:
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "TruthLens AI",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            data = json.loads(response.read().decode("utf-8"))

        choices = data.get("choices", [])
        if not choices or not choices[0].get("message", {}).get("content"):
            return {
                "success": False,
                "message": "The AI assistant returned an empty response. Please try again.",
            }

        answer = choices[0]["message"]["content"].strip()
        return {
            "success": True,
            "message": answer,
        }

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        log.warning(f"OpenRouter HTTP Error {e.code}: {error_body}")
        return {
            "success": False,
            "error_code": e.code,
            "message": "The AI assistant service is temporarily busy or unavailable. Please try again shortly.",
        }

    except urllib.error.URLError as e:
        log.warning(f"OpenRouter Connection Error: {e.reason}")
        return {
            "success": False,
            "message": "Unable to reach the AI service. Please verify your internet connection.",
        }

    except Exception as e:
        log.exception(f"Unexpected error communicating with OpenRouter: {e}")
        return {
            "success": False,
            "message": "An unexpected error occurred while communicating with the AI service.",
        }


def chat_with_ai(message: str, context: Optional[dict] = None) -> dict:
    """
    Sends the user message and optional analysis context to the active AI Assistant.
    Prioritizes Google Gemini with Google Search Grounding when GEMINI_API_KEY is present,
    and cleanly falls back to OpenRouter.
    Returns: {"success": True, "message": "...", "provider": "..."}
    """
    # 1. Check Gemini Provider first
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            from . import gemini_agent
            if gemini_agent.is_gemini_available():
                g_res = gemini_agent.chat_with_gemini(message, context)
                if g_res.get("success"):
                    return g_res
                log.info(f"Gemini chat failed ({g_res.get('message')}); falling back to OpenRouter...")
        except Exception as e:
            log.warning(f"Error attempting Gemini chat: {e}. Falling back to OpenRouter...")

    # 2. OpenRouter Provider
    api_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        log.warning("Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is set in the environment.")
        return {
            "success": False,
            "message": "AI Assistant is not configured on the server. Please set GEMINI_API_KEY or OPENROUTER_API_KEY in backend/.env.",
        }

    context_text = ""
    if context:
        title = context.get("title") or "Not specified"
        source_domain = context.get("source_domain") or context.get("source") or "Not specified"
        source_type = context.get("source_type") or "text"
        model_pred = context.get("model_prediction") or context.get("prediction") or "Uncertain"
        raw_conf = context.get("confidence")
        conf_display = context.get("confidence_display") or (f"{float(raw_conf)*100:.1f}%" if isinstance(raw_conf, (int, float)) and raw_conf <= 1.0 else str(raw_conf or "Not specified"))
        verif_status = context.get("verification_status") or "Needs Verification"
        verif_reason = context.get("verification_reason") or ""
        final_conclusion = context.get("final_conclusion") or ""
        external_evidence = context.get("external_evidence") or ""
        verif_summary = context.get("verification_summary") or "Available evidence is insufficient for factual verification."
        indicators = context.get("indicators") or context.get("suspicious_flags") or []
        explanation = context.get("explanation") or "Not specified"
        article_snippet = context.get("snippet") or context.get("text_snippet") or context.get("text") or ""
        if isinstance(article_snippet, str) and len(article_snippet) > 1200:
            article_snippet = article_snippet[:1200] + "..."

        author = context.get("author")
        pub_date = context.get("publication_date")
        ext_check = context.get("external_fact_check")

        ext_str = external_evidence or "No matching fact-check evidence was found in the available fact-check source."
        if isinstance(ext_check, dict):
            matches = ext_check.get("matches", [])
            if matches:
                formatted_reviews = []
                for m in matches[:3]:
                    rev_list = [f"{r.get('publisher', 'Source')}: {r.get('rating', 'Unrated')}" for r in m.get("reviews", [])]
                    claim_text = m.get("claim", "")
                    claimant = m.get("claimant", "N/A")
                    revs_str = ", ".join(rev_list)
                    formatted_reviews.append(f'  - Claim: "{claim_text}" | Claimant: {claimant} | Reviews: {revs_str}')
                ext_str = f"{len(matches)} published fact-check review(s) found:\n" + "\n".join(formatted_reviews)
            elif ext_check.get("message") and not external_evidence:
                ext_str = ext_check.get("message")

        context_text = f"""---
CURRENT TRUTHLENS ANALYSIS CONTEXT:
- Article Title / Headline: {title}
- Source / Domain: {source_domain} ({source_type})
- Author: {author or 'Not specified'}
- Publication Date: {pub_date or 'Not specified'}
- Model Prediction (Linguistic Style): {model_pred}
- Model Confidence: {conf_display}
- Overall Verification Status: {verif_status}
- Final Conclusion: {final_conclusion or 'None specified'}
- Verification Reason: {verif_reason or verif_summary}
- External Fact-Check Database Findings:
{ext_str}
- Detected Suspicious Signals / Heuristics: {json.dumps(indicators) if isinstance(indicators, (list, dict)) else str(indicators)}
- Diagnostic Explanation: {explanation}
- Article Content Sample / Snippet:
"{article_snippet}"
---
"""
    else:
        context_text = """---
CURRENT TRUTHLENS ANALYSIS CONTEXT:
No specific article analysis is currently active. The user is asking a general, historical, or standalone question.
Answer directly, naturally, and helpfully.
---
"""

    user_content = f"{context_text}\nUser Question:\n{message}".strip()

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": get_system_prompt()},
            {"role": "user", "content": user_content},
        ],
        "plugins": [{"id": "web"}],
    }

    # First attempt: with web search enabled
    res = _send_request(payload, api_key)
    if res.get("success"):
        return res

    # If web plugin returned an error or is unsupported, retry cleanly without plugin
    log.info("Retrying OpenRouter request without web plugin...")
    payload.pop("plugins", None)
    return _send_request(payload, api_key)
