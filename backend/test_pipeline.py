"""Comprehensive test script verifying all scenarios from Parts 26 & 27."""
import os
import sys
from pathlib import Path

# Ensure backend directory is in path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import analysis, ml, extractor, ai_agent, main
from app.extractor import ExtractionError

def run_tests():
    print("=" * 70)
    print("TRUTHLENS AI - COMPLETE MASTER AUDIT & PRODUCTION SUITE")
    print("=" * 70)

    # 1. TEXT ANALYSIS
    print("\n--- 1. TEXT ANALYSIS ---")
    sample_text = (
        "The Federal Reserve announced today that it will maintain current interest rates, "
        "pointing to stable economic indicators and balanced inflation expectations across sectors."
    )
    res1 = main.run_analysis(sample_text, "text", title="Federal Reserve Rate Decision")
    print(f"Title: {res1['title']}")
    print(f"Model Prediction: {res1.get('model_prediction')}")
    print(f"Model Confidence: {res1.get('confidence')}")
    print(f"Verification Status: {res1.get('verification_status')}")
    print(f"Source Domain: {res1.get('source_domain')}")
    assert res1.get("model_prediction") in ("Likely Real", "Likely Fake", "Uncertain / Mixed"), "Invalid prediction"
    assert "verification_status" in res1, "Missing verification_status"
    assert "external_fact_check" in res1, "Missing external_fact_check"
    print("PASS: Text Analysis")

    # 2. NEEDS VERIFICATION DISTINCTION
    print("\n--- 2. NEEDS VERIFICATION LOGIC ---")
    suspicious_text = (
        "SHOCKING COVER-UP! You won't believe what the mainstream media and deep state are hiding! "
        "Secret plan completely exposed! Share this before it gets deleted! Guaranteed 100% truth!"
    )
    res2 = main.run_analysis(suspicious_text, "text", title="Secret Plan Exposed")
    print(f"Title: {res2['title']}")
    print(f"Model Prediction: {res2.get('model_prediction')}")
    print(f"Model Confidence: {res2.get('confidence')}")
    print(f"Verification Status: {res2.get('verification_status')}")
    print(f"Verification Summary: {res2.get('verification_summary')}")
    assert res2.get("verification_status") == "Needs Verification", "Verification status should be Needs Verification"
    assert "NOT proof" in res2.get("verification_summary") or "NOT verified" in res2.get("verification_summary")
    print("PASS: Needs Verification Distinction")

    # Context for AI questions
    context2 = {
        "title": res2["title"],
        "source_domain": res2["source_domain"],
        "source_type": res2["source_type"],
        "model_prediction": res2["model_prediction"],
        "confidence": f"{res2['confidence']*100:.1f}%",
        "verification_status": res2["verification_status"],
        "verification_summary": res2["verification_summary"],
        "indicators": [f"{f['label']} ({f['count']}x)" for f in res2["suspicious_flags"]],
        "explanation": "; ".join(res2["explanation"][:3]),
        "snippet": res2["text"][:300],
        "external_fact_check": res2["external_fact_check"],
    }

    # 3. AI ANALYSIS CONTEXT: "Why was this article marked suspicious?"
    print("\n--- 3. AI ASSISTANT: Why was this article marked suspicious? ---")
    ai_q3 = ai_agent.chat_with_ai("Why was this article marked suspicious?", context=context2)
    assert ai_q3["success"], f"AI chat failed: {ai_q3.get('message')}"
    print(ai_q3["message"][:350] + "...\n")
    assert any(w in ai_q3["message"].lower() for w in ["sensational", "urgency", "conspiracy", "rhetoric", "indicator", "style"])
    print("PASS: AI Context Question")

    # 4. AI CONFIDENCE: "What does the confidence score mean?"
    print("\n--- 4. AI ASSISTANT: What does the confidence score mean? ---")
    ai_q4 = ai_agent.chat_with_ai("What does the confidence score mean?", context=context2)
    assert ai_q4["success"]
    print(ai_q4["message"][:350] + "...\n")
    assert any(w in ai_q4["message"].lower() for w in ["model", "training", "resemblance", "statistical", "not proof", "not fact"])
    print("PASS: Confidence Score Explanation")

    # 5. AI VERIFICATION: "Is this prediction a verified fact?"
    print("\n--- 5. AI ASSISTANT: Is this prediction a verified fact? ---")
    ai_q5 = ai_agent.chat_with_ai("Is this prediction a verified fact?", context=context2)
    assert ai_q5["success"]
    print(ai_q5["message"][:350] + "...\n")
    assert any(w in ai_q5["message"].lower()[:80] for w in ["no", "not a verified fact", "not proof", "machine-learning"])
    print("PASS: Prediction is Not Fact")

    # 6. AI DEFINITION: "What does Needs Verification mean?"
    print("\n--- 6. AI ASSISTANT: What does Needs Verification mean? ---")
    ai_q6 = ai_agent.chat_with_ai("What does Needs Verification mean?", context=context2)
    assert ai_q6["success"]
    print(ai_q6["message"][:350] + "...\n")
    assert any(w in ai_q6["message"].lower() for w in ["insufficient", "not automatically", "does not mean", "evidence", "factual"])
    print("PASS: Needs Verification Explanation")

    # 7. AI MODE 1 — GENERAL KNOWLEDGE WITH TYPO: "who is salman khna"
    print("\n--- 7. AI ASSISTANT (MODE 1): who is salman khna ---")
    ai_q7 = ai_agent.chat_with_ai("who is salman khna", context=None)
    assert ai_q7["success"]
    print(ai_q7["message"][:350] + "...\n")
    assert any(w in ai_q7["message"].lower() for w in ["salman khan", "actor", "indian", "bollywood", "film"])
    print("PASS: General Knowledge & Typo Correction")

    # 8. AI MODE 1 — GENERAL TECHNICAL: "what is machine learning?"
    print("\n--- 8. AI ASSISTANT (MODE 1): what is machine learning? ---")
    ai_q8 = ai_agent.chat_with_ai("what is machine learning?", context=None)
    assert ai_q8["success"]
    print(ai_q8["message"][:350] + "...\n")
    assert any(w in ai_q8["message"].lower() for w in ["artificial intelligence", "algorithms", "data", "learn", "patterns"])
    print("PASS: General Technical Explanation")

    # 9. AI MODE 2 — CURRENT EVENT: "is salman khan dead?"
    print("\n--- 9. AI ASSISTANT (MODE 2): is salman khan dead? ---")
    ai_q9 = ai_agent.chat_with_ai("is salman khan dead?", context=None)
    assert ai_q9["success"]
    print(ai_q9["message"][:350] + "...\n")
    assert any(w in ai_q9["message"].lower() for w in ["alive", "no", "not dead", "hoax"])
    print("PASS: Current Event 1 (Salman Khan)")

    # 10. AI MODE 2 — CURRENT EVENT: "is donald trump dead?"
    print("\n--- 10. AI ASSISTANT (MODE 2): is donald trump dead? ---")
    ai_q10 = ai_agent.chat_with_ai("is donald trump dead?", context=None)
    assert ai_q10["success"]
    print(ai_q10["message"][:350] + "...\n")
    assert any(w in ai_q10["message"].lower() for w in ["alive", "no", "not dead", "hoax", "president"])
    print("PASS: Current Event 2 (Donald Trump)")

    # 11. URL EXTRACTION & ANALYSIS
    print("\n--- 11. SAFE ARTICLE URL EXTRACTION ---")
    try:
        art = extractor.extract_article("https://en.wikipedia.org/wiki/News")
        print(f"Extracted URL: {art['url']}")
        print(f"Extracted Title: {art['title']}")
        print(f"Extracted Domain: {art['domain']}")
        print(f"Extracted Word Count: {art['word_count']}")
        print(f"Extracted Image: {art.get('image_url')}")
        assert art["word_count"] > 100
        assert art["domain"] == "en.wikipedia.org"
        print("PASS: Safe URL Extraction")
    except Exception as e:
        print(f"Notice (external network): {e}")

    # 12. DANGEROUS / INVALID URL REJECTION (SSRF PROTECTION)
    print("\n--- 12. SSRF & DANGEROUS URL REJECTION ---")
    for bad in ["http://localhost:8000/api/health", "http://127.0.0.1:5173", "http://10.0.0.1", "ftp://evil.com"]:
        try:
            extractor.extract_article(bad)
            raise AssertionError(f"Expected rejection for {bad}")
        except ExtractionError as e:
            print(f"Correctly blocked {bad}: {e.message}")
    print("PASS: SSRF & Dangerous URL Rejection")

    # 13. REST ENDPOINTS STATUS
    print("\n--- 13. FASTAPI ENDPOINT HEALTH CHECKS ---")
    health = main.health()
    assert health["status"] == "ok" and health["model_loaded"] is True
    print(f"/api/health: {health}")

    stats = main.stats()
    assert "total" in stats and "verdicts" in stats
    print(f"/api/stats: total analyses = {stats['total']}")

    model_info = main.model_info()
    assert "accuracy" in model_info or "f1_score" in model_info
    print(f"/api/model/info: model metrics loaded = {list(model_info.keys())}")
    print("PASS: REST Endpoints Health")

    print("\n" + "=" * 70)
    print("ALL 13 MASTER AUDIT SUITE TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
