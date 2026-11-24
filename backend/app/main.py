"""FastAPI application: REST endpoints for analysis, history, statistics."""
import os
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

from . import analysis, auth, database as db, ml, ai_agent
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    if len(text.split()) < 3:
        raise HTTPException(422, "Please provide at least a few words (a headline or an article).")
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

    # Search external published fact-checks
    fact_check = search_google_fact_checks(text, effective_title)

    # Verification status logic:
    # "Needs Verification" MUST NOT automatically mean Fake or Proven misinformation.
    # It means available evidence is not sufficient for a reliable final factual conclusion.
    if fact_check.get("matches"):
        verification_status = "Needs Verification (Fact-Checks Matched)"
        verification_summary = (
            f"Model predicts '{result['model_prediction']}' with {result['confidence']*100:.1f}% confidence. "
            f"External fact-check database matched {len(fact_check['matches'])} related claim review(s). "
            "Examine external reviews below for independent journalistic findings."
        )
    else:
        verification_status = "Needs Verification"
        verification_summary = (
            f"Model predicts '{result['model_prediction']}' with {result['confidence']*100:.1f}% confidence. "
            "However, model confidence measures linguistic style resemblance to training articles, NOT proof of truth or falsity. "
            "No matching external fact-checks were identified; the overall status remains Needs Verification."
        )

    result.update(
        source_type=source_type,
        source_ref=source_ref,
        source_domain=source_domain,
        title=effective_title,
        truncated=truncated,
        external_fact_check=fact_check,
        verification_status=verification_status,
        verification_summary=verification_summary,
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
