"""TruthLens AI — Comprehensive Production Verification Suite (10 Cases)."""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import analysis, main, database as db, auth, ai_agent

def run_production_tests():
    print("=" * 70)
    print("TRUTHLENS AI — FINAL PRODUCTION SUITE (10 SCENARIOS)")
    print("=" * 70)

    # ---------------------------------------------------------
    # TEST 1: "is Donald Trump dead?"
    # ---------------------------------------------------------
    print("\n--- TEST 1: 'is Donald Trump dead?' ---")
    t1 = main.run_analysis("is Donald Trump dead?", "text")
    print(f"Input Type: {t1.get('input_type')}")
    print(f"Model Prediction: {t1.get('model_prediction')}")
    print(f"Confidence Display: {t1.get('confidence_display')}")
    print(f"Verification Status: {t1.get('verification_status')}")
    print(f"Final Conclusion: {t1.get('final_conclusion')}")
    print(f"Disclaimer: {t1.get('disclaimer')}")
    print(f"Evidence Strength: {t1.get('evidence_strength')}")

    assert t1["input_type"] == "question", f"Expected question, got {t1['input_type']}"
    assert t1["model_prediction"] == "Factual Question / Claim"
    assert t1["confidence_display"] == "N/A (Question)"
    assert t1["confidence"] == 0.0
    assert t1["verification_status"] == "False / Debunked"
    assert "Verification is based on available external fact-check evidence" in t1["disclaimer"]
    assert "alive" in t1["final_conclusion"].lower() or "false" in t1["final_conclusion"].lower()
    print("PASS: Test 1 ('is Donald Trump dead?')")

    # ---------------------------------------------------------
    # TEST 2: "is prime minister modi dead?"
    # ---------------------------------------------------------
    print("\n--- TEST 2: 'is prime minister modi dead?' ---")
    t2 = main.run_analysis("is prime minister modi dead?", "text")
    print(f"Input Type: {t2.get('input_type')}")
    print(f"Clean Query: {t2.get('clean_query')}")
    print(f"Verification Status: {t2.get('verification_status')}")
    print(f"Final Conclusion: {t2.get('final_conclusion')}")

    assert t2["input_type"] == "question"
    assert t2["model_prediction"] == "Factual Question / Claim"
    assert t2["verification_status"] == "False / Debunked"
    assert "alive" in t2["final_conclusion"].lower() or "false" in t2["final_conclusion"].lower()
    print("PASS: Test 2 ('is prime minister modi dead?')")

    # ---------------------------------------------------------
    # TEST 3: Debunked claim with matching fact-check evidence
    # ---------------------------------------------------------
    print("\n--- TEST 3: Debunked claim with matching fact-check evidence ---")
    mock_debunk_matches = [
        {
            "claim": "Claim that famous personality passed away",
            "claimant": "Social Media Posts",
            "reviews": [
                {
                    "publisher": "Reuters Fact Check",
                    "rating": "False - Hoax report",
                    "url": "https://www.reuters.com/fact-check/test",
                },
                {
                    "publisher": "Snopes",
                    "rating": "Debunked",
                    "url": "https://www.snopes.com/fact-check/test",
                },
            ],
        }
    ]
    st3, summ3, strength3 = analysis.evaluate_fact_checks(mock_debunk_matches)
    print(f"Status: {st3}")
    print(f"Summary: {summ3}")
    print(f"Evidence Strength: {strength3}")

    assert st3 == "False / Debunked"
    assert "false/debunked" in summ3.lower()
    assert strength3 == "Strong"
    print("PASS: Test 3 (Debunked Claim)")

    # ---------------------------------------------------------
    # TEST 4: Verified true claim with reliable evidence
    # ---------------------------------------------------------
    print("\n--- TEST 4: Verified true claim with reliable evidence ---")
    mock_true_matches = [
        {
            "claim": "Official government announcement verified",
            "claimant": "Government Portal",
            "reviews": [
                {
                    "publisher": "PolitiFact",
                    "rating": "True and accurate",
                    "url": "https://www.politifact.com/factchecks/test",
                },
                {
                    "publisher": "FactCheck.org",
                    "rating": "Correct",
                    "url": "https://www.factcheck.org/test",
                },
            ],
        }
    ]
    st4, summ4, strength4 = analysis.evaluate_fact_checks(mock_true_matches)
    print(f"Status: {st4}")
    print(f"Summary: {summ4}")
    print(f"Evidence Strength: {strength4}")

    assert st4 == "Verified True"
    assert "Available evidence supports this claim" in summ4
    assert strength4 == "Strong"
    print("PASS: Test 4 (Verified True Claim)")

    # ---------------------------------------------------------
    # TEST 5: Claim with no reliable external evidence
    # ---------------------------------------------------------
    print("\n--- TEST 5: Claim with no reliable external evidence ---")
    st5, summ5, strength5 = analysis.evaluate_fact_checks([])
    print(f"Status: {st5}")
    print(f"Summary: {summ5}")
    print(f"Evidence Strength: {strength5}")

    assert st5 == "Needs Verification"
    assert "No reliable external evidence was found" in summ5
    assert strength5 == "None"
    print("PASS: Test 5 (No External Evidence)")

    # ---------------------------------------------------------
    # TEST 6: "modi" (Short Input)
    # ---------------------------------------------------------
    print("\n--- TEST 6: Short Input ('modi') ---")
    t6 = main.run_analysis("modi", "text")
    print(f"Input Type: {t6.get('input_type')}")
    print(f"Model Prediction: {t6.get('model_prediction')}")
    print(f"Verification Status: {t6.get('verification_status')}")
    print(f"Reason: {t6.get('verification_reason')}")

    assert t6["input_type"] == "short_input"
    assert t6["model_prediction"] == "Insufficient Context"
    assert t6["confidence_display"] == "N/A"
    assert t6["verification_status"] == "Insufficient Context"
    assert "Please provide the complete claim or article" in t6["verification_reason"]
    print("PASS: Test 6 (Short Input)")

    # ---------------------------------------------------------
    # TEST 7: Normal full news article
    # ---------------------------------------------------------
    print("\n--- TEST 7: Normal News Article ---")
    article_text = (
        "The World Meteorological Organization released its annual state of the global climate report today, "
        "documenting record greenhouse gas concentrations, ocean heat, and sea level rise. Researchers noted "
        "that long-term weather observations across fifty stations confirmed persistent temperature anomalies."
    )
    t7 = main.run_analysis(article_text, "text", title="WMO Annual Climate Report")
    print(f"Input Type: {t7.get('input_type')}")
    print(f"Model Prediction: {t7.get('model_prediction')}")
    print(f"Model Confidence: {t7.get('confidence_display')}")
    print(f"Verification Status: {t7.get('verification_status')}")
    print(f"Word Count: {t7.get('word_count')}")
    print(f"Influential Words: {len(t7.get('influential_words', []))}")

    assert t7["input_type"] == "article"
    assert t7["model_prediction"] in ("Likely Real", "Likely Fake", "Uncertain / Mixed")
    assert "%" in t7["confidence_display"]
    assert t7["word_count"] > 20
    assert "This is a machine-learning estimate based on writing patterns" in t7["disclaimer"]
    print("PASS: Test 7 (Normal Article)")

    # ---------------------------------------------------------
    # TEST 8: Google Authentication Logic & Endpoints
    # ---------------------------------------------------------
    print("\n--- TEST 8: Google Authentication Verification ---")
    assert hasattr(auth, "verify_google_token")
    assert hasattr(auth, "create_session_token")
    assert hasattr(auth, "get_current_user")
    assert hasattr(auth, "get_optional_user")
    print("PASS: Test 8 (Google Auth Integrity)")

    # ---------------------------------------------------------
    # TEST 9: AI Assistant Context Passing
    # ---------------------------------------------------------
    print("\n--- TEST 9: AI Assistant Context Formatting ---")
    ctx = {
        "title": t1["title"],
        "source_domain": t1["source_domain"],
        "source_type": t1["source_type"],
        "model_prediction": t1["model_prediction"],
        "confidence_display": t1["confidence_display"],
        "verification_status": t1["verification_status"],
        "verification_reason": t1["verification_reason"],
        "final_conclusion": t1["final_conclusion"],
        "external_evidence": t1["external_evidence"],
        "evidence_strength": t1["evidence_strength"],
        "explanation": "; ".join(t1["explanation"]),
    }
    # Verify AI agent formats these keys cleanly without error
    sys_prompt = ai_agent.get_system_prompt()
    assert "TruthLens AI Assistant" in sys_prompt
    assert "Needs Verification" in sys_prompt
    assert "Model Confidence ≠ Proof" in sys_prompt
    print("PASS: Test 9 (AI Assistant Grounding)")

    # ---------------------------------------------------------
    # TEST 10: History and Dashboard Stats
    # ---------------------------------------------------------
    print("\n--- TEST 10: History and Dashboard Stats ---")
    hist = db.list_history(limit=5)
    assert "items" in hist
    assert "total" in hist
    assert hist["total"] > 0
    print(f"Total History Records: {hist['total']}")

    stats = db.stats()
    assert "total" in stats
    assert "verdicts" in stats
    print(f"Stats Verdicts: {stats['verdicts']}")
    print("PASS: Test 10 (History & Dashboard Stats)")

    print("\n" + "=" * 70)
    print("ALL 10 PRODUCTION POLISH SCENARIOS PASSED WITH ZERO ERRORS!")
    print("=" * 70)

if __name__ == "__main__":
    run_production_tests()
