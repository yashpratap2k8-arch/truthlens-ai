"""FastAPI application: REST endpoints for analysis, history, statistics."""
import os
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)
load_dotenv()
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from . import analysis, auth, database as db, ml, ai_agent, ai_provider, gemini_agent, evidence_retriever
from .extractor import ExtractionError, extract_article

log = logging.getLogger("analyzer")
MAX_CHARS = 30_000
MAX_FILE_BYTES = 1_000_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    try:
        ml.load_model()
        log.info("Model loaded.")
    except ml.ModelNotTrained as e:
        log.warning(str(e))
    yield


app = FastAPI(title="AI Fake News Analyzer", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://truthlens-ai-gamma-two.vercel.app",
        "https://truthlens-ai.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https:\/\/truthlens-ai.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Error handling -------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Invalid request. Please check your input and try again."})


@app.exception_handler(Exception)
async def unexpected_handler(request: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


# ---- Schemas --------------------------------------------------------------
class TextRequest(BaseModel):
    text: str = Field(..., max_length=200_000)
    title: Optional[str] = Field(None, max_length=300)


class UrlRequest(BaseModel):
    url: str = Field(..., max_length=2000)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., max_length=5000)


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[dict] = None


class ClaimVerificationRequest(BaseModel):
    claim: str = Field(..., min_length=2, max_length=1000)
    context: Optional[dict] = None


class EvidenceRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)


class GeminiChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[dict] = None


def search_google_fact_checks(text: str, title: Optional[str] = None) -> dict:
    """Search published fact-checks related to the submitted news using Google Fact Check Tools API."""
    import json
    import urllib.parse
    import urllib.request
    import urllib.error

    api_key = (os.getenv("GOOGLE_FACT_CHECK_API_KEY") or "").strip()

    if not api_key:
        return {
            "status": "not_configured",
            "matches": [],
            "message": "External fact-check API is not configured on the server.",
        }

    # Best search query: use title if available, otherwise first concise headline clause
    if title and len(title.strip()) > 5:
        query = title.strip()
    else:
        first_sentence = text.strip().split(".")[0].split("\n")[0]
        words = first_sentence.split()[:12]
        query = " ".join(words) or text.strip()[:100]

    params = urllib.parse.urlencode({
        "query": query,
        "key": api_key,
    })

    url = f"https://factchecktools.googleapis.com/v1alpha1/claims:search?{params}"

    try:
        request = urllib.request.Request(url, headers={"User-Agent": "TruthLens/1.0"})
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))

        raw_claims = data.get("claims", [])
        matches = []

        for claim in raw_claims[:5]:
            reviews = []
            for review in claim.get("claimReview", []):
                reviews.append({
                    "publisher": review.get("publisher", {}).get("name") or "Independent Fact-Checker",
                    "title": review.get("title") or "Fact Review",
                    "url": review.get("url"),
                    "review_date": review.get("reviewDate"),
                    "rating": review.get("textualRating") or "Unrated",
                })

            matches.append({
                "claim": claim.get("text"),
                "claimant": claim.get("claimant"),
                "claim_date": claim.get("claimDate"),
                "reviews": reviews,
            })

        message = (
            f"Found {len(matches)} matching published fact-check review(s)."
            if matches
            else "No matching fact-check evidence was found in the available fact-check source."
        )

        return {
            "status": "success",
            "matches": matches,
            "message": message,
            "query": query,
        }

    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        log.warning(f"Fact check lookup exception: {e}")
        return {
            "status": "unavailable",
            "matches": [],
            "message": "External fact-check service is temporarily unreachable; relying on linguistic analysis.",
            "query": query,
        }


# ---- Core -----------------------------------------------------------------
def run_analysis(text, source_type, source_ref=None, title=None, user_id=None, extra_meta=None):
    text = (text or "").strip()
    if not text:
        raise HTTPException(400, "Please provide some text to analyze.")
    truncated = len(text) > MAX_CHARS
    text = text[:MAX_CHARS]

    try:
        result = analysis.analyze(text, title)
    except ml.ModelNotTrained as e:
        raise HTTPException(503, str(e))

    first_line = text.split("\n", 1)[0].strip()
    effective_title = title or (first_line[:90] + ("…" if len(first_line) > 90 else ""))

    # Domain resolution
    if extra_meta and extra_meta.get("domain"):
        source_domain = extra_meta["domain"]
    elif source_type == "url" and source_ref:
        from urllib.parse import urlparse
        source_domain = urlparse(source_ref).netloc.lower().replace("www.", "")
    elif source_type == "file":
        source_domain = "Uploaded Document"
    else:
        source_domain = "Direct Text Input"

    # Search external published fact-checks based on input type
    input_type = result.get("input_type", "article")

    if input_type == "short_input":
        fact_check = {
            "status": "skipped",
            "matches": [],
            "message": "Input is too brief for fact-checking. Please provide more context.",
        }
        verification_status = "Insufficient Context"
        verification_summary = "Please provide the complete claim or article for reliable analysis."
        result["verification_status"] = verification_status
        result["verification_reason"] = verification_summary
        result["verification_summary"] = verification_summary
        result["final_conclusion"] = "Insufficient context provided. Please enter a full claim or complete news article."
        result["external_evidence"] = "No reliable external evidence was found."
        result["evidence_strength"] = "None"
        result["disclaimer"] = "Input is insufficient for stylistic or factual analysis. Please submit a full sentence or article."
        result["verification_notice"] = "Input is too brief for stylistic or factual analysis."
    elif input_type == "question":
        clean_q = result.get("clean_query") or effective_title
        fact_check = search_google_fact_checks(text, title=clean_q)
        matches = fact_check.get("matches", [])
        if matches:
            v_status, v_reason, ev_strength = analysis.evaluate_fact_checks(matches)
            result["verification_status"] = v_status
            result["verification_reason"] = v_reason
            result["evidence_strength"] = ev_strength
            result["external_evidence"] = f"{len(matches)} matching fact-check report{'s' if len(matches) != 1 else ''}"
            result["final_conclusion"] = v_reason
            result["disclaimer"] = "Verification is based on available external fact-check evidence, not the ML writing-pattern classifier."
            result["verification_notice"] = "TruthLens found matching external fact-check evidence relevant to this claim."
            verification_summary = f"Factual question inquiry matched {len(matches)} fact-check report(s) (Status: {v_status})."
        else:
            result["verification_status"] = "Needs Verification"
            result["verification_reason"] = "No reliable external evidence was found to determine this claim."
            result["final_conclusion"] = "TruthLens cannot currently confirm or debunk this claim."
            result["external_evidence"] = "No reliable external evidence was found."
            result["evidence_strength"] = "None"
            result["disclaimer"] = "Verification is based on available external fact-check evidence, not the ML writing-pattern classifier."
            result["verification_notice"] = "TruthLens could not find sufficient reliable external evidence to determine this claim."
            verification_summary = "Factual question inquiry: No matching external fact-checks were identified; status remains Needs Verification."
        result["verification_summary"] = verification_summary
    else:
        search_q = result.get("clean_query") or effective_title
        fact_check = search_google_fact_checks(text, title=search_q)
        matches = fact_check.get("matches", [])
        if matches:
            v_status, v_reason, ev_strength = analysis.evaluate_fact_checks(matches)
            result["verification_status"] = v_status
            result["verification_reason"] = v_reason
            result["evidence_strength"] = ev_strength
            result["external_evidence"] = f"{len(matches)} matching fact-check report{'s' if len(matches) != 1 else ''}"
            result["final_conclusion"] = v_reason
            result["verification_notice"] = f"TruthLens found {len(matches)} matching external fact-check report(s) addressing this claim."
            verification_summary = (
                f"Model predicts '{result['model_prediction']}' with {result['confidence_display']} confidence. "
                f"External fact-check database matched {len(matches)} related claim review(s) (Status: {v_status}). "
                "Independent fact-checker findings take precedence over stylistic pattern estimates."
            )
        else:
            result["verification_status"] = "Needs Verification"
            result["verification_reason"] = (
                "The ML model analyzes writing patterns and cannot establish whether a real-world claim is true or false. "
                "No reliable external evidence was found to determine this claim."
            )
            result["external_evidence"] = "No reliable external evidence was found."
            result["evidence_strength"] = "None"
            result["verification_notice"] = (
                f"Model predicts '{result['model_prediction']}' with {result['confidence_display']} confidence. "
                "However, model confidence measures linguistic style resemblance to training articles, NOT proof of truth or falsity. "
                "No matching external fact-checks were identified; the overall status remains Needs Verification."
            )
            verification_summary = result["verification_notice"]
        result["verification_summary"] = verification_summary

    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")

    # Multi-source authoritative evidence retrieval and Gemini reasoning
    evidence_items = []
    ai_assessment = ""
    missing_evidence_note = ""
    provenance_list = ["ML Writing Pattern Analysis"]
    g_eval = None

    if input_type != "short_input":
        search_target = result.get("clean_query") or effective_title
        evidence_items = evidence_retriever.retrieve_comprehensive_evidence(search_target, text, title=effective_title)
        
        # If external fact check had matches, ensure they are represented in evidence_items
        for m in fact_check.get("matches", []):
            for r in m.get("reviews", []):
                rev_url = r.get("url") or ""
                if rev_url and not any(it.get("source_url") == rev_url for it in evidence_items):
                    evidence_items.append({
                        "source_name": r.get("publisher") or "Independent Fact-Checker",
                        "source_url": rev_url,
                        "source_type": "fact_checker",
                        "snippet": f'Claim: "{m.get("claim", "")}" — Rating: {r.get("rating", "Unrated")}',
                        "rating": r.get("rating", "Unrated"),
                        "relevance": "High",
                        "evidence_strength": "Strong",
                        "provenance": "Google Fact Check API",
                        "retrieved_at": now_iso,
                    })

        # Gemini Agent Reasoning Layer (Backend-only)
        if gemini_agent.is_gemini_available():
            try:
                g_eval = gemini_agent.evaluate_claim_with_gemini(
                    claim_text=search_target,
                    article_text=text,
                    title=effective_title,
                    source_domain=source_domain,
                    ml_prediction=result.get("model_prediction"),
                    ml_confidence=result.get("confidence_display"),
                    external_evidence=result.get("external_evidence"),
                    evidence_items=evidence_items,
                    fact_check_results=fact_check,
                )
                ai_assessment = g_eval.get("ai_assessment", "")
                missing_evidence_note = g_eval.get("missing_evidence_note", "")
                
                # Merge any web search grounding sources returned by Gemini
                for gs in g_eval.get("grounding_sources", []):
                    if gs.get("source_url") and not any(it.get("source_url") == gs.get("source_url") for it in evidence_items):
                        evidence_items.append(gs)

                if g_eval.get("provider") == "gemini":
                    provenance_list.append("Gemini Grounded Reasoning")
            except Exception as e:
                log.warning(f"Gemini claim evaluation exception: {e}")

    # Build provenance list
    for it in evidence_items:
        p = it.get("provenance")
        if p and p not in provenance_list:
            provenance_list.append(p)

    # General Factual Question & Claim Evidence Evaluation
    if input_type != "short_input":
        v_status, v_reason, final_conclusion, ev_strength = evidence_retriever.evaluate_evidence_against_claim(
            claim_text=text,
            clean_query=result.get("clean_query") or effective_title,
            input_type=input_type,
            evidence_items=evidence_items,
            gemini_eval=g_eval,
        )
        result["verification_status"] = v_status
        result["verification_reason"] = v_reason
        result["final_conclusion"] = final_conclusion
        result["evidence_strength"] = ev_strength

        if ev_strength != "None" and evidence_items:
            result["external_evidence"] = f"{len(evidence_items)} matching authoritative report{'s' if len(evidence_items) != 1 else ''}"
            if input_type == "question":
                result["verification_notice"] = f"TruthLens verified this factual inquiry against authoritative records (Status: {v_status})."
                result["verification_summary"] = f"Factual question inquiry resolved: {final_conclusion}"
            else:
                result["verification_notice"] = f"TruthLens verified external authoritative evidence addressing this claim (Status: {v_status})."
                result["verification_summary"] = (
                    f"Model predicts '{result['model_prediction']}' with {result['confidence_display']} confidence. "
                    f"External authoritative evidence confirms status: {v_status}. {final_conclusion}"
                )

    result.update(
        source_type=source_type,
        source_ref=source_ref,
        source_domain=source_domain,
        title=effective_title,
        truncated=truncated,
        external_fact_check=fact_check,
        evidence_items=evidence_items,
        ai_assessment=ai_assessment,
        missing_evidence_note=missing_evidence_note,
        evidence_provenance=provenance_list,
        verification_status=result["verification_status"],
        verification_reason=result["verification_reason"],
        verification_summary=result["verification_summary"],
        final_conclusion=result["final_conclusion"],
        evidence_strength=result["evidence_strength"],
        external_evidence=result.get("external_evidence", "No reliable external evidence was found."),
        last_verified=now_iso,
        author=(extra_meta.get("author") if extra_meta else None),
        publication_date=(extra_meta.get("publication_date") if extra_meta else None),
        image_url=(extra_meta.get("image_url") if extra_meta else None),
        description=(extra_meta.get("description") if extra_meta else None),
    )

    snippet = " ".join(text.split())[:180]
    result["id"], result["created_at"] = db.save_analysis(result, snippet, user_id=user_id)
    return result


# ---- Auth endpoints -------------------------------------------------------
@app.post("/api/auth/google")
def auth_google(req: GoogleAuthRequest):
    google_user = auth.verify_google_token(req.credential)
    user = db.get_or_create_user(
        google_sub=google_user["sub"],
        email=google_user["email"],
        name=google_user.get("name"),
        picture=google_user.get("picture"),
    )
    token = auth.create_session_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user["picture"],
        },
    }


@app.get("/api/auth/me")
def auth_me(user: dict = Depends(auth.get_current_user)):
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user["picture"],
        }
    }


@app.post("/api/auth/logout")
def auth_logout():
    return {"status": "logged_out"}


# ---- AI Assistant endpoint ------------------------------------------------
@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest, user: Optional[dict] = Depends(auth.get_optional_user)):
    res = await run_in_threadpool(ai_agent.chat_with_ai, req.message, req.context)
    if not res.get("success"):
        status_code = 503 if "not configured" in res.get("message", "").lower() else 502
        return JSONResponse(status_code=status_code, content=res)
    return res


# ---- Analysis endpoints ---------------------------------------------------
@app.post("/api/analyze/text")
def analyze_text(req: TextRequest, user: Optional[dict] = Depends(auth.get_optional_user)):
    user_id = user["id"] if user else None
    return run_analysis(req.text, "text", None, (req.title or "").strip() or None, user_id=user_id)


@app.post("/api/analyze/url")
def analyze_url(req: UrlRequest, user: Optional[dict] = Depends(auth.get_optional_user)):
    try:
        article = extract_article(req.url)
    except ExtractionError as e:
        raise HTTPException(e.status_code, e.message)
    except Exception as e:
        log.exception(f"Unexpected error extracting URL: {e}")
        raise HTTPException(422, "Unable to extract readable article content from this URL.")

    user_id = user["id"] if user else None
    extra_meta = {
        "domain": article.get("domain"),
        "author": article.get("author"),
        "publication_date": article.get("publication_date"),
        "canonical_url": article.get("canonical_url"),
        "description": article.get("description"),
        "image_url": article.get("image_url"),
    }
    return run_analysis(
        article["text"],
        "url",
        article["url"],
        article["title"],
        user_id=user_id,
        extra_meta=extra_meta,
    )


@app.post("/api/analyze/file")
async def analyze_file(file: UploadFile = File(...), user: Optional[dict] = Depends(auth.get_optional_user)):
    name = file.filename or "upload.txt"
    if not name.lower().endswith((".txt", ".md")):
        raise HTTPException(415, "Only .txt files are supported.")
    raw = await file.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(413, "The file is too large (limit 1 MB).")
    text = raw.decode("utf-8", errors="replace")
    user_id = user["id"] if user else None
    return await run_in_threadpool(run_analysis, text, "file", name, None, user_id)


# ---- History & stats ------------------------------------------------------
@app.get("/api/history")
def history(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    verdict: Optional[str] = None,
    user: Optional[dict] = Depends(auth.get_optional_user),
):
    if verdict and verdict not in db.VERDICTS:
        raise HTTPException(422, "Unknown verdict filter.")
    user_id = user["id"] if user else None
    return db.list_history(limit, offset, verdict, user_id=user_id)


@app.get("/api/history/{analysis_id}")
def history_item(analysis_id: int, user: Optional[dict] = Depends(auth.get_optional_user)):
    user_id = user["id"] if user else None
    item = db.get_analysis(analysis_id, user_id=user_id)
    if item is None:
        raise HTTPException(404, "That analysis no longer exists.")
    return item


@app.delete("/api/history/{analysis_id}")
def delete_item(analysis_id: int, user: Optional[dict] = Depends(auth.get_optional_user)):
    user_id = user["id"] if user else None
    if not db.delete_analysis(analysis_id, user_id=user_id):
        raise HTTPException(404, "That analysis no longer exists.")
    return {"deleted": analysis_id}


@app.delete("/api/history")
def clear_history(user: Optional[dict] = Depends(auth.get_optional_user)):
    user_id = user["id"] if user else None
    return {"deleted": db.clear_history(user_id=user_id)}


@app.get("/api/stats")
def stats():
    return db.stats()


# ---- Verification & Evidence endpoints -----------------------------------
@app.post("/api/verification/claim")
async def verify_claim(req: ClaimVerificationRequest, user: Optional[dict] = Depends(auth.get_optional_user)):
    """Directly verifies a factual claim against authoritative evidence and Gemini reasoning."""
    search_target = req.claim.strip()
    evidence_items = await run_in_threadpool(evidence_retriever.retrieve_comprehensive_evidence, search_target, search_target)
    
    # Evaluate with Gemini if available
    gemini_res = await run_in_threadpool(
        gemini_agent.evaluate_claim_with_gemini,
        claim_text=search_target,
        evidence_items=evidence_items,
    )
    
    provenance = ["authoritative_source_retrieval"]
    if gemini_res.get("provider") == "gemini":
        provenance.append("Gemini web grounding")
    
    return {
        "claim": search_target,
        "verification_status": gemini_res.get("verification_status", "Needs Verification"),
        "evidence_strength": gemini_res.get("evidence_strength", "Limited" if evidence_items else "None"),
        "ai_assessment": gemini_res.get("ai_assessment", ""),
        "final_conclusion": gemini_res.get("final_conclusion", "TruthLens cannot currently confirm or debunk this claim."),
        "missing_evidence_note": gemini_res.get("missing_evidence_note", ""),
        "evidence_items": evidence_items,
        "evidence_provenance": provenance,
    }


@app.post("/api/verification/evidence")
async def search_evidence(req: EvidenceRequest):
    """Retrieves authoritative evidence records for a search query without full ML analysis."""
    items = await run_in_threadpool(evidence_retriever.retrieve_comprehensive_evidence, req.query, req.query)
    return {
        "query": req.query,
        "total_sources": len(items),
        "evidence_items": items,
    }


@app.post("/api/ai/gemini")
async def ai_gemini_direct(req: GeminiChatRequest):
    """Direct Gemini assistant endpoint."""
    res = await run_in_threadpool(gemini_agent.chat_with_gemini, req.message, req.context)
    if not res.get("success"):
        return JSONResponse(status_code=503, content=res)
    return res


@app.get("/api/verification/{analysis_id}")
def get_verification_details(analysis_id: int, user: Optional[dict] = Depends(auth.get_optional_user)):
    """Retrieves evidence and verification breakdown for a previously analyzed item."""
    user_id = user["id"] if user else None
    item = db.get_analysis(analysis_id, user_id=user_id)
    if not item:
        raise HTTPException(404, "Analysis record not found.")
    return {
        "analysis_id": analysis_id,
        "title": item.get("title"),
        "verification_status": item.get("verification_status"),
        "evidence_strength": item.get("evidence_strength"),
        "final_conclusion": item.get("final_conclusion"),
        "ai_assessment": item.get("ai_assessment"),
        "evidence_items": item.get("evidence_items", []),
        "evidence_provenance": item.get("evidence_provenance", []),
        "last_verified": item.get("last_verified"),
    }


# ---- Model / health -------------------------------------------------------
@app.get("/api/model/info")
def model_info():
    metrics = ml.load_metrics()
    if metrics is None:
        raise HTTPException(503, "The model has not been trained yet. Run `python train.py` (see README).")
    return metrics


@app.get("/api/health")
def health():
    return {"status": "ok", "model_loaded": ml.model_exists()}
