"""Test script for verification fix in TruthLens AI."""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import analysis, main, database as db

def test_all():
    print("==================================================")
    print("RUNNING TRUTHLENS VERIFICATION FIX TESTS")
    print("==================================================")

    # 1. Question handling
    print("\n--- TEST 1: Question Handling ('is prime minister modi dead?') ---")
    q_res = main.run_analysis("is prime minister modi dead?", "text")
    print(f"input_type: {q_res.get('input_type')}")
    print(f"model_prediction: {q_res.get('model_prediction')}")
    print(f"confidence_display: {q_res.get('confidence_display')}")
    print(f"confidence: {q_res.get('confidence')}")
    print(f"verification_status: {q_res.get('verification_status')}")
    print(f"final_conclusion: {q_res.get('final_conclusion')}")
    print(f"external_evidence: {q_res.get('external_evidence')}")

    assert q_res["input_type"] == "question", f"Expected question, got {q_res['input_type']}"
    assert q_res["model_prediction"] == "Factual Question / Claim", f"Wrong prediction: {q_res['model_prediction']}"
    assert q_res["confidence_display"] == "N/A (Question)", f"Wrong confidence display: {q_res['confidence_display']}"
    assert q_res["confidence"] == 0.0, f"Expected 0.0 confidence, got {q_res['confidence']}"
    assert q_res["verification_status"] == "Needs Verification", f"Wrong verification_status: {q_res['verification_status']}"
    assert "cannot currently confirm or debunk" in q_res["final_conclusion"]
    assert q_res["evidence_strength"] == "None"
    assert "Verification is based on available external fact-check evidence" in q_res["disclaimer"]
    assert "last_verified" in q_res
    print("PASS: Test 1 (Question Handling)")

    # 2. Short input handling
    print("\n--- TEST 2: Short Input Handling ('modi') ---")
    s_res = main.run_analysis("modi", "text")
    print(f"input_type: {s_res.get('input_type')}")
    print(f"model_prediction: {s_res.get('model_prediction')}")
    print(f"confidence_display: {s_res.get('confidence_display')}")
    print(f"verification_status: {s_res.get('verification_status')}")
    print(f"final_conclusion: {s_res.get('final_conclusion')}")

    assert s_res["input_type"] == "short_input", f"Expected short_input, got {s_res['input_type']}"
    assert s_res["model_prediction"] == "Insufficient Context"
    assert s_res["confidence_display"] == "N/A"
    assert s_res["confidence"] == 0.0
    assert s_res["verification_status"] == "Insufficient Context"
    assert "Insufficient context provided" in s_res["final_conclusion"]
    print("PASS: Test 2 (Short Input)")

    # 3. Two-word non-question short input
    print("\n--- TEST 3: Two-word Input ('breaking news') ---")
    s2_res = main.run_analysis("breaking news", "text")
    assert s2_res["input_type"] == "short_input"
    assert s2_res["verification_status"] == "Insufficient Context"
    print("PASS: Test 3 (Two-word Input)")

    # 4. Standard article text
    print("\n--- TEST 4: Standard Article Analysis ---")
    art_text = (
        "The Ministry of Health announced a new vaccination initiative across three states today, "
        "aimed at reducing seasonal influenza cases among high-risk demographics according to official releases."
    )
    art_res = main.run_analysis(art_text, "text", title="Vaccination Campaign")
    print(f"input_type: {art_res.get('input_type')}")
    print(f"model_prediction: {art_res.get('model_prediction')}")
    print(f"confidence_display: {art_res.get('confidence_display')}")
    print(f"verification_status: {art_res.get('verification_status')}")
    print(f"final_conclusion: {art_res.get('final_conclusion')}")
    print(f"external_evidence: {art_res.get('external_evidence')}")

    assert art_res["input_type"] == "article"
    assert art_res["model_prediction"] in ("Likely Real", "Likely Fake", "Uncertain / Mixed")
    assert "%" in art_res["confidence_display"]
    assert art_res["verification_status"] == "Needs Verification"
    assert "No reliable external evidence was found." in art_res["external_evidence"]
    assert "last_verified" in art_res
    print("PASS: Test 4 (Standard Article)")

    # 5. Fact Check Evaluator Unit Tests
    print("\n--- TEST 5: Fact Check Evaluator Mappings ---")
    # Debunked
    st_fake, _, str_fake = analysis.evaluate_fact_checks([{"reviews": [{"rating": "False - Debunked by Reuters"}, {"rating": "Fake claim"}]}])
    assert st_fake == "False / Debunked", f"Expected False / Debunked, got {st_fake}"
    assert str_fake == "Strong", f"Expected Strong, got {str_fake}"

    # Verified True
    st_true, _, str_true = analysis.evaluate_fact_checks([{"reviews": [{"rating": "Accurate and verified true"}]}])
    assert st_true == "Verified True", f"Expected Verified True, got {st_true}"
    assert str_true == "Moderate", f"Expected Moderate, got {str_true}"

    # Misleading
    st_mis, _, str_mis = analysis.evaluate_fact_checks([{"reviews": [{"rating": "Misleading context"}]}])
    assert st_mis == "Misleading", f"Expected Misleading, got {st_mis}"

    # Partially True
    st_part, _, str_part = analysis.evaluate_fact_checks([{"reviews": [{"rating": "Half True"}]}])
    assert st_part == "Partially True", f"Expected Partially True, got {st_part}"

    # Empty
    st_empty, _, str_empty = analysis.evaluate_fact_checks([])
    assert st_empty == "Needs Verification", f"Expected Needs Verification, got {st_empty}"
    assert str_empty == "None", f"Expected None, got {str_empty}"
    print("PASS: Test 5 (Fact Check Evaluator Mappings)")

    # 6. Database Verification
    print("\n--- TEST 6: DB Persistence ---")
    retrieved = db.get_analysis(q_res["id"])
    assert retrieved is not None
    assert retrieved["verdict"] == "Needs Verification"
    assert retrieved["model_prediction"] == "Factual Question / Claim"
    assert retrieved["confidence_display"] == "N/A (Question)"
    print("PASS: Test 6 (DB Persistence)")

    print("\n==================================================")
    print("ALL VERIFICATION FIX TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    test_all()
