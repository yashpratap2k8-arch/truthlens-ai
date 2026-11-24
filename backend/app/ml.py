"""Text cleaning, model definition, loading and prediction.

The model is a TF-IDF + Logistic Regression pipeline trained by train.py.
It estimates how much a text *resembles* the fake articles in its training data.
It does NOT check facts.
"""
import json
import re
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODEL_DIR / "model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"

# ---- Decision rules (probability that a text is "fake") -------------------
FAKE_T, REAL_T = 0.75, 0.25              # normal texts
SHORT_FAKE_T, SHORT_REAL_T = 0.85, 0.15  # short texts need stronger evidence
SHORT_TEXT_WORDS = 30
MIN_WORDS = 6
MIN_VOCAB_COVERAGE = 0.5                 # share of words the model has seen before

# ---- Cleaning -------------------------------------------------------------
URL_RE = re.compile(r"https?://\S+|www\.\S+|pic\.twitter\.com/\S+")
# ISOT real articles start with e.g. "WASHINGTON (Reuters) - ". Removing it stops
# the model from simply learning the publisher tag.
SOURCE_TAG_RE = re.compile(r"^\s*[A-Z][A-Za-z .,/'-]{0,40}\(Reuters\)\s*-?\s*")


def strip_source_tag(text: str) -> str:
    return SOURCE_TAG_RE.sub("", text, count=1)


def clean_text(text: str) -> str:
    """Lowercase, drop URLs / publisher name / punctuation / digits."""
    text = URL_RE.sub(" ", text).lower()
    text = re.sub(r"\breuters\b", " ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    preprocessor=clean_text,
                    stop_words="english",
                    ngram_range=(1, 2),
                    min_df=3,
                    max_df=0.7,
                    max_features=100_000,
                    sublinear_tf=True,
                ),
            ),
            ("clf", LogisticRegression(max_iter=1000, C=2.0)),  # label 1 = fake
        ]
    )


# ---- Loading --------------------------------------------------------------
class ModelNotTrained(RuntimeError):
    pass


_cache = {}


def model_exists() -> bool:
    return MODEL_PATH.exists()


def load_model():
    if "pipe" not in _cache:
        if not MODEL_PATH.exists():
            raise ModelNotTrained(
                "No trained model found. Run `python train.py` in the backend folder first (see README)."
            )
        pipe = joblib.load(MODEL_PATH)
        _cache["pipe"] = pipe
        _cache["features"] = pipe.named_steps["tfidf"].get_feature_names_out()
    return _cache["pipe"]


def load_metrics():
    if not METRICS_PATH.exists():
        return None
    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))


# ---- Prediction -----------------------------------------------------------
def decide(p_fake: float, word_count: int, coverage: float):
    """
    Evaluates model probability against training thresholds.
    Returns: (model_prediction, legacy_verdict, reasons)
    
    Distinct concepts:
    - model_prediction: statistical classification of linguistic patterns ('Likely Fake', 'Likely Real', or 'Uncertain / Mixed')
    - legacy_verdict: compatible with existing database schemas ('Likely Fake', 'Likely Real', 'Needs Verification')
    """
    reasons = []
    if word_count < MIN_WORDS:
        reasons.append(f"The text has only {word_count} words, which is too short for a reliable linguistic estimate.")
        return "Uncertain / Insufficient Words", "Needs Verification", reasons
    if coverage < MIN_VOCAB_COVERAGE:
        reasons.append(
            f"Only {coverage * 100:.0f}% of the words were seen during training, so the text vocabulary diverges from the training dataset."
        )
        return "Uncertain / Unseen Vocabulary", "Needs Verification", reasons

    hi, lo = FAKE_T, REAL_T
    if word_count < SHORT_TEXT_WORDS:
        hi, lo = SHORT_FAKE_T, SHORT_REAL_T
        reasons.append("The text is short, so a stricter threshold (85% / 15%) was applied to avoid over-interpreting brief phrasing.")

    if p_fake >= hi:
        model_pred = "Likely Fake"
        verdict = "Likely Fake"
        reasons.append(f"Model identified significant stylistic alignment ({p_fake * 100:.1f}%) with sensational or fabricated news patterns in the training corpus.")
    elif p_fake <= lo:
        model_pred = "Likely Real"
        verdict = "Likely Real"
        reasons.append(f"Model identified stylistic alignment ({(1 - p_fake) * 100:.1f}%) with conventional news wire and editorial patterns in the training corpus.")
    else:
        model_pred = "Uncertain / Mixed"
        verdict = "Needs Verification"
        reasons.append("The model's probability sits in the inconclusive middle range (25%–75%), reflecting mixed writing signals.")

    return model_pred, verdict, reasons


def predict(text: str, top_n: int = 12) -> dict:
    pipe = load_model()
    vec, clf = pipe.named_steps["tfidf"], pipe.named_steps["clf"]
    feats = _cache["features"]

    X = vec.transform([strip_source_tag(text)])
    p_fake = float(clf.predict_proba(X)[0, 1])

    # How many of the (non-stop) words were known to the model?
    tokens = [t for t in re.findall(r"[a-z]{2,}", clean_text(text)) if t not in ENGLISH_STOP_WORDS]
    known = sum(1 for t in tokens if t in vec.vocabulary_)
    coverage = known / len(tokens) if tokens else 0.0

    # Per-term contribution = tf-idf value x coefficient (positive -> fake)
    coo, coefs = X.tocoo(), clf.coef_[0]
    contribs = sorted(
        ((str(feats[j]), float(v * coefs[j])) for j, v in zip(coo.col, coo.data)),
        key=lambda t: abs(t[1]),
        reverse=True,
    )[:top_n]
    words = [
        {"word": w, "weight": round(c, 4), "direction": "fake" if c > 0 else "real"}
        for w, c in contribs
    ]

    word_count = len(text.split())
    model_prediction, verdict, reasons = decide(p_fake, word_count, coverage)
    return {
        "p_fake": p_fake,
        "coverage": coverage,
        "word_count": word_count,
        "words": words,
        "model_prediction": model_prediction,
        "verdict": verdict,
        "reasons": reasons,
    }
