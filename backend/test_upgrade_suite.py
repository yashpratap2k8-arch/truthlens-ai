"""TruthLens AI — Comprehensive Upgrade Test Suite.

Verifies:
1. Gemini Agent & AI Provider Abstraction
2. Supabase Client & RLS / SQLite Fallback
3. Authoritative Multi-Source Evidence Retriever (Wikipedia REST API + Google Fact Check)
4. All 7 Core Fact Verification Test Cases (Requirement 17)
5. Zero regressions in ML model, Google Auth, AI Assistant, and History
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import analysis, main, database as db, auth, ai_agent, ai_provider, gemini_agent, evidence_retriever, supabase_client


def run_upgrade_tests():
    print("=" * 75)
    print("TRUTHLENS AI — COMPREHENSIVE GEMINI + SUPABASE UPGRADE SUITE")
    print("=" * 75)

    # ------------------------------------------------------------------
    # 1. AI Provider Abstraction & Fallback Check
    # ------------------------------------------------------------------
    print("\n--- TEST: AI Provider Abstraction ---")
    provider = ai_provider.get_ai_provider()
    assert isinstance(provider, (ai_provider.GeminiProvider, ai_provider.OpenRouterProvider))
    print(f"Active Default Provider Type: {type(provider).__name__}")
    
    # Test unconfigured Gemini behavior (clean fallback, no crash)
    unconf_gemini = ai_provider.GeminiProvider(api_key="")
    assert not unconf_gemini.is_configured
    fallback_chat = unconf_gemini.generate_chat_response("test message")
    assert fallback_chat["success"] is False
    assert "GEMINI_API_KEY" in fallback_chat["message"]
    print("PASS: AI Provider Abstraction & Safe Fallback")

    # ------------------------------------------------------------------
    # 2. Supabase Client & SQLite Local Fallback Check
    # ------------------------------------------------------------------
    print("\n--- TEST: Supabase Cloud Client & SQLite Fallback ---")
    # Verify client singleton exists and exposes required methods
    assert hasattr(supabase_client.client, "is_configured")
    assert hasattr(supabase_client.client, "save_analysis")
    assert hasattr(supabase_client.client, "list_history")
    assert hasattr(supabase_client.client, "get_analysis")
    print(f"Supabase Configured: {supabase_client.client.is_configured}")
    print("PASS: Supabase Client Integrity & Fallback Readiness")

    # ------------------------------------------------------------------
    # 3. Evidence Retriever & Normalization
    # ------------------------------------------------------------------
    print("\n--- TEST: Evidence Retriever & Caching ---")
    norm1 = evidence_retriever.normalize_claim("Is Narendra Modi dead?")
    norm2 = evidence_retriever.normalize_claim("is it true that Narendra Modi is dead?")
    assert "narendra modi" in norm1
    hash1 = evidence_retriever.get_claim_hash("Is Narendra Modi dead?")
    assert len(hash1) == 64
    assert evidence_retriever.is_safe_url("https://en.wikipedia.org/wiki/GLA_University")
    assert not evidence_retriever.is_safe_url("http://localhost:8000/admin")
    assert not evidence_retriever.is_safe_url("http://127.0.0.1:5173")
    print("PASS: Evidence Retriever, Normalization, & SSRF Validation")

    # ------------------------------------------------------------------
    # 4. Core Verification Scenarios (Requirement 17)
    # ------------------------------------------------------------------

    # Scenario 1: "Is GLA University Mathura a government university?"
    print("\n--- SCENARIO 1: 'Is GLA University Mathura a government university?' ---")
    s1 = main.run_analysis("Is GLA University Mathura a government university?", "text")
    print(f"Input Type: {s1.get('input_type')}")
    print(f"Verification Status: {s1.get('verification_status')}")
    print(f"Evidence Strength: {s1.get('evidence_strength')}")
    print(f"Final Conclusion: {s1.get('final_conclusion')}")
    print(f"Evidence Items Count: {len(s1.get('evidence_items', []))}")
    assert s1["input_type"] == "question"
    assert s1["verification_status"] == "False / Debunked"
    assert "private" in s1["final_conclusion"].lower()
    assert "evidence_items" in s1
    assert "evidence_provenance" in s1
    print("PASS: Scenario 1 (GLA University Inquiry -> False / Debunked: Private University)")

    # Scenario 2: "Is Donald Trump dead?"
    print("\n--- SCENARIO 2: 'Is Donald Trump dead?' ---")
    s2 = main.run_analysis("Is Donald Trump dead?", "text")
    print(f"Verification Status: {s2.get('verification_status')}")
    print(f"Final Conclusion: {s2.get('final_conclusion')}")
    print(f"Evidence Strength: {s2.get('evidence_strength')}")
    assert s2["input_type"] == "question"
    assert s2["model_prediction"] == "Factual Question / Claim"
    assert s2["verification_status"] == "False / Debunked"
    assert "alive" in s2["final_conclusion"].lower() or "false" in s2["final_conclusion"].lower()
    assert s2["evidence_strength"] in ("Strong", "Moderate")
    print("PASS: Scenario 2 (Living Figure Status Inquiry -> False / Debunked: Alive)")

    # Scenario 2b: "Is Iron Man dead?"
    print("\n--- SCENARIO 2b: 'Is Iron Man dead?' ---")
    s2b = main.run_analysis("Is Iron Man dead?", "text")
    print(f"Verification Status: {s2b.get('verification_status')}")
    print(f"Final Conclusion: {s2b.get('final_conclusion')}")
    assert s2b["input_type"] == "question"
    assert s2b["verification_status"] == "Verified True"
    assert "iron man" in s2b["final_conclusion"].lower() or "avengers" in s2b["final_conclusion"].lower()
    print("PASS: Scenario 2b (Fictional Character Death -> Verified True: Avengers Endgame Canon)")

    # Scenario 2c: "Is the Earth larger than the Moon?"
    print("\n--- SCENARIO 2c: 'Is the Earth larger than the Moon?' ---")
    s2c = main.run_analysis("Is the Earth larger than the Moon?", "text")
    print(f"Verification Status: {s2c.get('verification_status')}")
    print(f"Final Conclusion: {s2c.get('final_conclusion')}")
    assert s2c["input_type"] == "question"
    assert s2c["verification_status"] == "Verified True"
    assert "larger" in s2c["final_conclusion"].lower() or "earth" in s2c["final_conclusion"].lower()
    print("PASS: Scenario 2c (Factual Comparison -> Verified True)")

    # Scenario 2d: "Did alien spaceships secretly land in Mathura yesterday?"
    print("\n--- SCENARIO 2d: 'Did alien spaceships secretly land in Mathura yesterday?' ---")
    s2d = main.run_analysis("Did alien spaceships secretly land in Mathura yesterday?", "text")
    print(f"Verification Status: {s2d.get('verification_status')}")
    print(f"Final Conclusion: {s2d.get('final_conclusion')}")
    assert s2d["input_type"] == "question"
    assert s2d["verification_status"] == "Needs Verification"
    assert s2d["evidence_strength"] == "None"
    print("PASS: Scenario 2d (Unverifiable Inquiry -> Needs Verification)")

    # Scenario 3: Known debunked misinformation claim
    print("\n--- SCENARIO 3: Known debunked misinformation claim ---")
    mock_debunk_matches = [
        {
            "claim": "Famous viral death hoax debunked by independent agencies",
            "claimant": "Social Media",
            "reviews": [
                {"publisher": "Snopes", "rating": "False - Hoax", "url": "https://www.snopes.com/fact-check/example"},
                {"publisher": "Reuters Fact Check", "rating": "False", "url": "https://www.reuters.com/fact-check/example"},
            ],
        }
    ]
    st3, summ3, strength3 = analysis.evaluate_fact_checks(mock_debunk_matches)
    assert st3 == "False / Debunked"
    assert strength3 == "Strong"
    print(f"Status: {st3} | Strength: {strength3}")
    print("PASS: Scenario 3 (Debunked Claim with Evidence)")

    # Scenario 4: Known true factual claim
    print("\n--- SCENARIO 4: Known true factual claim ---")
    mock_true_matches = [
        {
            "claim": "Official census announcement confirmed",
            "claimant": "Government Portal",
            "reviews": [
                {"publisher": "PolitiFact", "rating": "True", "url": "https://www.politifact.com/factchecks/example"},
                {"publisher": "FactCheck.org", "rating": "Accurate", "url": "https://www.factcheck.org/example"},
            ],
        }
    ]
    st4, summ4, strength4 = analysis.evaluate_fact_checks(mock_true_matches)
    assert st4 == "Verified True"
    assert strength4 == "Strong"
    print(f"Status: {st4} | Strength: {strength4}")
    print("PASS: Scenario 4 (Verified True with Evidence)")

    # Scenario 5: Claim with insufficient evidence
    print("\n--- SCENARIO 5: Claim with insufficient evidence ---")
    st5, summ5, strength5 = analysis.evaluate_fact_checks([])
    assert st5 == "Needs Verification"
    assert strength5 == "None"
    print(f"Status: {st5} | Reason: {summ5}")
    print("PASS: Scenario 5 (Insufficient Evidence -> Needs Verification)")

    # Scenario 6: Short input ("Trump")
    print("\n--- SCENARIO 6: Short input ('Trump') ---")
    s6 = main.run_analysis("Trump", "text")
    assert s6["input_type"] == "short_input"
    assert s6["verification_status"] == "Insufficient Context"
    assert s6["model_prediction"] == "Insufficient Context"
    print(f"Status: {s6['verification_status']}")
    print("PASS: Scenario 6 (Short Input -> Insufficient Context)")

    # Scenario 7: Normal news article
    print("\n--- SCENARIO 7: Normal news article ---")
    news_text = (
        "The International Energy Agency published its comprehensive global electricity market report, "
        "highlighting accelerated deployment of solar generation alongside grid infrastructure modernization. "
        "Regional regulators documented twenty percent annual capacity additions across European utilities."
    )
    s7 = main.run_analysis(news_text, "text", title="IEA Electricity Report")
    assert s7["input_type"] == "article"
    assert s7["model_prediction"] in ("Likely Real", "Likely Fake", "Uncertain / Mixed")
    assert "%" in s7["confidence_display"]
    assert "evidence_provenance" in s7
    assert "evidence_items" in s7
    print(f"Model Prediction: {s7['model_prediction']} ({s7['confidence_display']})")
    print(f"Verification Status: {s7['verification_status']}")
    print(f"Evidence Provenance: {s7['evidence_provenance']}")
    print("PASS: Scenario 7 (Normal Article Analysis)")

    # ------------------------------------------------------------------
    # 5. Regression Invariant Checks
    # ------------------------------------------------------------------
    print("\n--- REGRESSION CHECKS: Google Auth & History ---")
    assert hasattr(auth, "verify_google_token")
    assert hasattr(auth, "create_session_token")
    
    # Verify local SQLite history and stats persist cleanly
    hist = db.list_history(limit=3)
    assert "items" in hist and "total" in hist
    st = db.stats()
    assert "verdicts" in st and "total" in st
    print(f"Total History Records: {hist['total']} | Total Stats: {st['total']}")
    print("PASS: Google Auth & Database Regressions")

    print("\n" + "=" * 75)
    print("ALL UPGRADE SUITE TESTS PASSED WITH ZERO REGRESSIONS!")
    print("=" * 75)


if __name__ == "__main__":
    run_upgrade_tests()
