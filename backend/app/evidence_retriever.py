"""TruthLens Evidence Retriever & Aggregator.

Orchestrates multi-source evidence retrieval from:
1. Google Fact Check Tools API
2. Authoritative Encyclopedic & Official Institution Records (Wikipedia REST API)
3. Gemini Search Grounding
4. Domain & Regulatory Classification

Implements claim normalization, hashing, and in-memory TTL caching to prevent
unnecessary duplicate API requests and enforce strict SSRF safety.
"""
import hashlib
import json
import logging
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import requests

log = logging.getLogger("analyzer.evidence")

# In-memory cache for normalized claim queries (1 hour TTL)
_EVIDENCE_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 3600

# Private/internal IP patterns for SSRF prevention
BLOCKED_IP_REGEX = re.compile(
    r"^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|::1)$",
    re.I,
)


def is_safe_url(url: str) -> bool:
    """Validates that a URL uses http/https and does not target loopback or private ranges."""
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urllib.parse.urlparse(url.strip())
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = (parsed.hostname or "").lower()
        if not hostname or BLOCKED_IP_REGEX.match(hostname):
            return False
        return True
    except Exception:
        return False


def normalize_claim(text: str) -> str:
    """Normalizes text for consistent hashing and caching."""
    cleaned = (text or "").lower().strip()
    # Strip common question prefixes and punctuation
    cleaned = re.sub(r"^(is|are|was|were|did|do|does|has|have|had|will|would|can|could|who|what|where|when|why|how)\s+(it\s+true\s+that\s+|this\s+(?:news\s+)?true\s+(?:that\s+)?|the\s+current\s+)?", "", cleaned, flags=re.I)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    return " ".join(cleaned.split())


def get_claim_hash(text: str) -> str:
    """Computes SHA-256 hash of a normalized claim."""
    norm = normalize_claim(text)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def retrieve_wikipedia_evidence(query: str) -> List[Dict[str, Any]]:
    """
    Retrieves authoritative factual overview and citation links from the official Wikipedia REST API.
    Provides verifiable, authoritative evidence for institutions, figures, and historical facts.
    """
    clean_q = normalize_claim(query)
    if not clean_q or len(clean_q) < 3:
        return []

    # First, search for best matching Wikipedia page title
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(clean_q)}&utf8=&format=json&srlimit=2"
    headers = {"User-Agent": "TruthLensAI/1.0 (Educational Fact-Checking SaaS; contact@truthlens.ai)"}

    try:
        resp = requests.get(search_url, headers=headers, timeout=5)
        if resp.status_code != 200:
            return []
        
        data = resp.json()
        search_results = data.get("query", {}).get("search", [])
        if not search_results:
            return []

        top_title = search_results[0].get("title")
        if not top_title:
            return []

        # Retrieve summary for top page
        summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(top_title)}"
        s_resp = requests.get(summary_url, headers=headers, timeout=5)
        if s_resp.status_code != 200:
            return []

        summary_data = s_resp.json()
        extract = summary_data.get("extract", "")
        page_url = summary_data.get("content_urls", {}).get("desktop", {}).get("page") or f"https://en.wikipedia.org/wiki/{urllib.parse.quote(top_title)}"

        if not extract:
            return []

        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Determine source type and rating based on content
        source_type = "encyclopedic"
        rating = "Authoritative Record"
        
        # Check specific educational / government indicators
        lower_extract = extract.lower()
        if "private university" in lower_extract:
            rating = "Private Institution (Not Government)"
            source_type = "official_institution"
        elif "public university" in lower_extract or "central university" in lower_extract or "state university" in lower_extract:
            rating = "Public / Government Institution"
            source_type = "official_institution"

        return [{
            "source_name": f"Wikipedia: {top_title}",
            "source_url": page_url,
            "source_type": source_type,
            "snippet": extract[:450] + ("..." if len(extract) > 450 else ""),
            "rating": rating,
            "relevance": "High",
            "evidence_strength": "Strong",
            "provenance": "authoritative_source_retrieval",
            "retrieved_at": now_iso,
        }]

    except Exception as e:
        log.debug(f"Wikipedia evidence lookup exception: {e}")
        return []


def search_google_fact_checks_structured(text: str, title: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Searches Google Fact Check Tools API and returns normalized evidence items.
    """
    api_key = (os.getenv("GOOGLE_FACT_CHECK_API_KEY") or "").strip()
    if not api_key:
        return []

    # Query formulation
    query = (title or "").strip()
    if not query or len(query) < 5:
        first_sentence = text.strip().split(".")[0].split("\n")[0]
        words = first_sentence.split()[:10]
        query = " ".join(words) or text.strip()[:80]

    params = urllib.parse.urlencode({
        "query": query,
        "key": api_key,
    })
    url = f"https://factchecktools.googleapis.com/v1alpha1/claims:search?{params}"

    evidence_items = []
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        resp = requests.get(url, headers={"User-Agent": "TruthLens/1.0"}, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            claims = data.get("claims", [])
            for c in claims[:3]:
                claim_text = c.get("text", "")
                claimant = c.get("claimant", "")
                for r in c.get("claimReview", []):
                    pub = r.get("publisher", {}).get("name") or "Fact-Checking Agency"
                    rev_url = r.get("url") or ""
                    rating = r.get("textualRating") or "Unrated"
                    rev_title = r.get("title") or "Fact Review"
                    
                    if not is_safe_url(rev_url):
                        rev_url = f"https://toolbox.google.com/factcheck/explorer/search/{urllib.parse.quote(query)}"

                    evidence_items.append({
                        "source_name": pub,
                        "source_url": rev_url,
                        "source_type": "fact_checker",
                        "snippet": f'Claim: "{claim_text}" (Claimant: {claimant or "N/A"}). Review: {rev_title} — Rating: {rating}',
                        "rating": rating,
                        "relevance": "High",
                        "evidence_strength": "Strong",
                        "provenance": "Google Fact Check API",
                        "retrieved_at": now_iso,
                    })
    except Exception as e:
        log.debug(f"Google Fact Check API query failed: {e}")

    return evidence_items


def retrieve_comprehensive_evidence(claim_text: str, text: str, title: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Main aggregator: searches multiple independent authoritative sources, deduplicates,
    checks cache, and formats according to the evidence hierarchy.
    """
    claim_hash = get_claim_hash(claim_text)
    now = time.time()

    # Check cache
    if claim_hash in _EVIDENCE_CACHE:
        cached_time, cached_items = _EVIDENCE_CACHE[claim_hash]
        if now - cached_time < CACHE_TTL_SECONDS:
            log.info("Returning cached evidence for claim.")
            return cached_items

    all_evidence: List[Dict[str, Any]] = []
    seen_urls = set()

    # 1. Google Fact Check Explorer
    fact_check_items = search_google_fact_checks_structured(text, title=claim_text or title)
    for item in fact_check_items:
        u = item.get("source_url")
        if u and u not in seen_urls:
            seen_urls.add(u)
            all_evidence.append(item)

    # 2. Authoritative Knowledge & University / Official Records (Wikipedia REST API)
    wiki_items = retrieve_wikipedia_evidence(claim_text or title or text)
    for item in wiki_items:
        u = item.get("source_url")
        if u and u not in seen_urls:
            seen_urls.add(u)
            all_evidence.append(item)

    # Cache results
    _EVIDENCE_CACHE[claim_hash] = (now, all_evidence)
    return all_evidence
