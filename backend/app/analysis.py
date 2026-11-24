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
    pred = ml.predict(text)
    flags, style_spans = find_style_signals(text, pred["word_count"])
    spans = to_utf16(text, merge_spans(style_spans + influence_spans(text, pred["words"])))
    p = pred["p_fake"]
    conf = round(max(p, 1 - p), 4)
    model_prediction = pred.get("model_prediction", pred.get("verdict", "Uncertain"))

    # Verification status: Without independent fact-check proof, status is ALWAYS Needs Verification
    verification_status = "Needs Verification"
    verification_summary = (
        f"The ML model predicts '{model_prediction}' with {conf * 100:.1f}% confidence based on text patterns. "
        "However, model confidence is a measure of linguistic resemblance, NOT proof of truth or falsity. "
        "Available evidence is insufficient for a final factual determination; the overall status is Needs Verification."
    )

    return {
        "verdict": pred["verdict"],
        "model_prediction": model_prediction,
        "model_confidence": conf,
        "verification_status": verification_status,
        "verification_summary": verification_summary,
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
