"""Explanations, writing-style heuristics, highlights and fact-check links.

Everything here is separate from the ML score: style signals are simple
pattern matches, and fact-check links are search links (not verdicts).
"""
import re
from urllib.parse import quote, quote_plus

from . import ml

DISCLAIMER = (
    "This is a machine-learning estimate based on writing patterns, not a verified fact. "
    "It cannot confirm whether a claim is true. Always check the claims with trusted sources."
)


def classify_input_type(text: str) -> tuple[str, str]:
    """
    Classifies the input into:
    - 'short_input': extremely short (1-2 words or too brief to form a proposition)
    - 'question': a factual question or inquiry (e.g. 'is Narendra Modi dead?', 'Did X happen?')
    - 'article': standard statement, headline, or news article
    Returns: (input_type, clean_query)
    """
    cleaned = (text or "").strip()
    words = cleaned.split()

    if len(words) < 3 and not (cleaned.endswith("?") and len(words) >= 2):
        return "short_input", cleaned

    # Check for question marks or interrogative patterns
    is_q = False
    if cleaned.endswith("?"):
        is_q = True
    elif re.match(r"^(is|are|was|were|did|do|does|has|have|had|will|would|can|could|who|what|where|when|why|how|should|shall)\b", cleaned, re.I):
        is_q = True
    elif re.search(r"\b(is\s+it\s+true\s+that|is\s+this\s+(?:news\s+)?true|did\s+.*\s+happen|has\s+.*\s+died|is\s+.*\s+dead|is\s+.*\s+alive|who\s+is\s+the\s+current|did\s+.*\s+announce|was\s+.*\s+arrested)\b", cleaned, re.I):
        is_q = True

    if is_q:
        q_clean = re.sub(
            r"^(is|are|was|were|did|do|does|has|have|had|will|would|can|could|who|what|where|when|why|how)\s+(it\s+true\s+that\s+|this\s+(?:news\s+)?true\s+(?:that\s+)?|the\s+current\s+)?",
            "",
            cleaned,
            flags=re.I,
        )
        q_clean = q_clean.rstrip("?").strip()
        return "question", q_clean or cleaned

    return "article", cleaned


def evaluate_fact_checks(matches: list) -> tuple[str, str, str]:
    """
    Evaluates matches from fact check databases and maps to standard statuses:
    - Verified True
    - Likely True
    - False / Debunked
    - Misleading
    - Partially True
    - Needs Verification
    Returns: (status, summary, evidence_strength)
    evidence_strength: 'Strong' | 'Moderate' | 'Limited' | 'None'
    """
    if not matches:
        return "Needs Verification", "No reliable external evidence was found to determine this claim.", "None"

    all_ratings = []
    total_reviews = 0
    for m in matches:
        reviews = m.get("reviews", [])
        total_reviews += len(reviews)
        for r in reviews:
            if r.get("rating"):
                all_ratings.append(r["rating"].lower())

    ratings_str = " ".join(all_ratings)

    if total_reviews >= 2:
        evidence_strength = "Strong"
    elif total_reviews == 1:
        evidence_strength = "Moderate"
    else:
        evidence_strength = "Limited"

    if any(k in ratings_str for k in ["pants on fire", "false", "fake", "incorrect", "debunk", "hoax", "fabricated"]):
        status = "False / Debunked"
        summary = "Available fact-check evidence indicates that this claim is false/debunked."
    elif any(k in ratings_str for k in ["half true", "half-true", "partially true", "partly true", "mixture", "partially", "partly"]):
        status = "Partially True"
        summary = "Independent fact-checkers found the claim to be partially true or containing accurate elements alongside context caveats."
    elif any(k in ratings_str for k in ["misleading", "missing context", "out of context", "distorted", "exaggerat"]):
        status = "Misleading"
        summary = "Independent fact-checkers determined this claim to be misleading, out of context, or exaggerated."
    elif any(k in ratings_str for k in ["mostly true", "true", "correct", "accurate"]):
        if any(k in ratings_str for k in ["mostly true"]):
            status = "Likely True"
            summary = "Available evidence mostly supports this claim."
        else:
            status = "Verified True"
            summary = "Available evidence supports this claim."
    else:
        status = "Needs Verification"
        summary = "Fact-check entries were located, but their ratings are inconclusive or unrated. Available evidence remains insufficient for a final determination."
        evidence_strength = "Limited"

    return status, summary, evidence_strength

STYLE_PATTERNS = {
    "sensational": ("Sensational wording", [
        r"shocking", r"bombshell", r"unbelievable", r"jaw[- ]dropping", r"explosive", r"outrageous",
        r"horrifying", r"you won'?t believe", r"devastating", r"meltdown", r"slams?", r"destroyed?",
    ]),
    "conspiracy": ("Conspiracy / secrecy framing", [
        r"cover[- ]?up", r"they don'?t want you to know", r"hidden truth", r"mainstream media",
        r"deep state", r"wake up", r"hoax", r"globalists?", r"secret (?:plan|agenda)", r"sheeple",
    ]),
    "absolute": ("Absolute claims", [
        r"100 ?%", r"guaranteed", r"proven", r"everyone knows", r"nobody", r"undeniable",
        r"without a doubt", r"totally", r"completely", r"absolutely",
    ]),
    "urgency": ("Urgency / share pressure", [
        r"share (?:this )?before", r"share if you", r"must (?:watch|see|read)", r"urgent",
        r"before it'?s deleted", r"spread the word", r"going viral",
    ]),
}
MAX_SPANS = 400


def find_style_signals(text: str, word_count: int):
    flags, spans = [], []

    def add(key, label, matches):
        if not matches:
            return
        examples = sorted({m.group(0).lower() for m in matches})[:5]
        flags.append({"type": key, "label": label, "count": len(matches), "examples": examples})
        spans.extend({"start": m.start(), "end": m.end(), "kind": "suspicious"} for m in matches)

    for key, (label, pats) in STYLE_PATTERNS.items():
        rx = re.compile(r"(?<!\w)(?:" + "|".join(pats) + r")(?!\w)", re.I)
        add(key, label, list(rx.finditer(text)))

    caps = list(re.finditer(r"(?<!\w)[A-Z]{4,}(?!\w)", text))
    if len(caps) >= 3 and len(caps) / max(word_count, 1) > 0.03:
        add("caps", "Excessive ALL-CAPS words", caps)
    bangs = list(re.finditer(r"!+", text))
    if len(bangs) >= 2 or any(len(m.group(0)) >= 2 for m in bangs):
        add("punctuation", "Heavy exclamation marks", bangs)
    return flags, spans


def influence_spans(text: str, words):
    spans = []
    for w in words:
        parts = [re.escape(p) for p in w["word"].split()]
        rx = re.compile(r"(?<!\w)" + r"\W+".join(parts) + r"(?!\w)", re.I)
        spans.extend({"start": m.start(), "end": m.end(), "kind": w["direction"]} for m in rx.finditer(text))
    return spans


def merge_spans(spans):
    """Keep non-overlapping highlights; style signals win over model words."""
    prio = {"suspicious": 0, "fake": 1, "real": 1}
    spans = sorted(spans, key=lambda s: (s["start"], prio[s["kind"]], -(s["end"] - s["start"])))
    out, last_end = [], -1
    for s in spans:
        if s["start"] >= last_end:
            out.append(s)
            last_end = s["end"]
        if len(out) >= MAX_SPANS:
            break
    return out


def to_utf16(text: str, spans):
    """The browser counts UTF-16 units; Python counts code points (differs for emoji)."""
    if all(ord(c) <= 0xFFFF for c in text):
        return spans
    shift, acc = [], 0
    for ch in text:
        shift.append(acc)
        acc += 2 if ord(ch) > 0xFFFF else 1
    shift.append(acc)
    return [{**s, "start": shift[s["start"]], "end": shift[s["end"]]} for s in spans]


def fact_check_links(title, text):
    seed = title or re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0]
    query = " ".join(re.findall(r"[A-Za-z0-9']+", seed)[:12]) or "news claim"
    q = quote_plus(query)
    note = "Search results — open to see whether this claim has been checked"
    return [
        {"name": "Google Fact Check Explorer", "url": f"https://toolbox.google.com/factcheck/explorer/search/{quote(query)}", "note": note},
        {"name": "PolitiFact", "url": f"https://www.politifact.com/search/?q={q}", "note": note},
        {"name": "FactCheck.org", "url": f"https://www.factcheck.org/?s={q}", "note": note},
        {"name": "Alt News (India)", "url": f"https://www.altnews.in/?s={q}", "note": note},
        {"name": "BOOM Live (India)", "url": f"https://www.boomlive.in/search?search_term={q}", "note": note},
        {"name": "Snopes", "url": f"https://www.google.com/search?q=site%3Asnopes.com+{q}", "note": note},
    ]


def build_explanation(pred, flags):
    p = pred["p_fake"] * 100
    conf = max(pred["p_fake"], 1 - pred["p_fake"]) * 100
    model_pred = pred.get("model_prediction", pred.get("verdict", "Uncertain"))
    lines = [
        f"Model Assessment: {model_pred} (Confidence: {conf:.1f}%). The model estimates a {p:.1f}% probability of resemblance to misleading news patterns and {100 - p:.1f}% resemblance to standard reporting.",
        "Verification Status: Needs Verification. This classification represents linguistic pattern resemblance, not verified factual proof. An automated model cannot verify real-world facts without independent factual evidence.",
    ]
    lines += pred["reasons"]
    fake_w = [w["word"] for w in pred["words"] if w["direction"] == "fake"][:5]
    real_w = [w["word"] for w in pred["words"] if w["direction"] == "real"][:5]
    if fake_w:
        lines.append("Terms pushing score toward 'fake': " + ", ".join(fake_w) + ".")
    if real_w:
        lines.append("Terms pushing score toward 'real': " + ", ".join(real_w) + ".")
    if flags:
        lines.append(
            "Writing-style signals found: "
            + ", ".join(f"{f['label']} ({f['count']})" for f in flags)
            + ". These are heuristic indicators (sensationalism/urgency), not proof of falsity."
        )
    else:
        lines.append("No sensational, conspiracy-style or share-pressure wording patterns were detected.")
    lines.append(
        "Cross-verification reminder: The ISOT dataset teaches writing style, not empirical truth. Always consult trusted news sources and fact-check databases to verify specific claims."
    )
    return lines


def analyze(text: str, title=None) -> dict:
    input_type, clean_query = classify_input_type(text)

    # 1. Short Input / Insufficient Words
    if input_type == "short_input":
        word_count = len((text or "").split())
        return {
            "verdict": "Needs Verification",
            "input_type": "short_input",
            "clean_query": clean_query,
            "model_prediction": "Insufficient Context",
            "model_confidence": 0.0,
            "confidence_display": "N/A",
            "confidence": 0.0,
            "fake_probability": 0.5,
            "real_probability": 0.5,
            "verification_status": "Insufficient Context",
            "verification_reason": "Please provide the complete claim or article for reliable analysis.",
            "final_conclusion": "Insufficient context provided. Please enter a full claim or complete news article.",
            "external_evidence": "No reliable external evidence was found.",
            "evidence_strength": "None",
            "word_count": word_count,
            "vocab_coverage": 0.0,
            "influential_words": [],
            "suspicious_flags": [],
            "highlights": [],
            "explanation": [
                f"The provided input has only {word_count} word{'s' if word_count != 1 else ''}, which is insufficient for linguistic style analysis.",
                "Machine-learning classification models evaluate rhetoric and sentence structure, which require complete phrasing.",
                "Please submit a complete headline, claim statement, or article excerpt.",
            ],
            "fact_check_links": [],
            "text": text,
            "disclaimer": "Input is insufficient for stylistic or factual analysis. Please submit a full sentence or article.",
        }

    # 2. Factual Questions
    if input_type == "question":
        word_count = len(text.split())
        return {
            "verdict": "Needs Verification",
            "input_type": "question",
            "clean_query": clean_query,
            "model_prediction": "Factual Question / Claim",
            "model_confidence": 0.0,
            "confidence_display": "N/A (Question)",
            "confidence": 0.0,
            "fake_probability": 0.5,
            "real_probability": 0.5,
            "verification_status": "Needs Verification",
            "verification_reason": "No reliable external evidence was found to determine this claim.",
            "final_conclusion": "TruthLens cannot currently confirm or debunk this claim.",
            "external_evidence": "No reliable external evidence was found.",
            "evidence_strength": "None",
            "word_count": word_count,
            "vocab_coverage": 0.0,
            "influential_words": [],
            "suspicious_flags": [],
            "highlights": [],
            "explanation": [
                "Factual Question / Claim Detected: Questions express inquiries rather than news article writing patterns.",
                "Linguistic style modeling is not applicable to factual verification.",
                "Factual verification relies on published fact-check records and primary sources.",
                "If reliable matching evidence exists, status is determined from that evidence; otherwise, it remains Needs Verification.",
            ],
            "fact_check_links": fact_check_links(title or clean_query, text),
            "text": text,
            "disclaimer": "Verification is based on available external fact-check evidence, not the ML writing-pattern classifier.",
        }

    # 3. Standard Article / Text Analysis
    pred = ml.predict(text)
    flags, style_spans = find_style_signals(text, pred["word_count"])
    spans = to_utf16(text, merge_spans(style_spans + influence_spans(text, pred["words"])))
    p = pred["p_fake"]
    conf = round(max(p, 1 - p), 4)
    conf_display = f"{conf * 100:.1f}%"
    model_prediction = pred.get("model_prediction", pred.get("verdict", "Uncertain"))

    verification_status = "Needs Verification"
    verification_reason = (
        "The ML model analyzes writing patterns and cannot establish whether a real-world claim is true or false. "
        "No reliable external evidence was found to determine this claim."
    )
    if model_prediction == "Likely Fake":
        final_conclusion = "The text exhibits writing patterns common in misleading articles, but cannot be proven true or false without external fact-checking."
    elif model_prediction == "Likely Real":
        final_conclusion = "The text exhibits writing patterns common in credible news reporting; verify specific claims with trusted sources."
    else:
        final_conclusion = "The text shows mixed linguistic signals, and available evidence is insufficient to determine credibility."

    return {
        "verdict": pred["verdict"],
        "input_type": "article",
        "clean_query": clean_query,
        "model_prediction": model_prediction,
        "model_confidence": conf,
        "confidence_display": conf_display,
        "verification_status": verification_status,
        "verification_reason": verification_reason,
        "final_conclusion": final_conclusion,
        "external_evidence": "No reliable external evidence was found.",
        "evidence_strength": "None",
        "lean": "fake" if p >= 0.5 else "real",
        "fake_probability": round(p, 4),
        "real_probability": round(1 - p, 4),
        "confidence": conf,
        "word_count": pred["word_count"],
        "vocab_coverage": round(pred["coverage"], 4),
        "influential_words": pred["words"],
        "suspicious_flags": flags,
        "highlights": spans,
        "explanation": build_explanation(pred, flags),
        "fact_check_links": fact_check_links(title, text),
        "text": text,
        "disclaimer": DISCLAIMER,
    }
