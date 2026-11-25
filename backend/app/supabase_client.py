"""Supabase Cloud Persistence Client for TruthLens AI.

Provides persistent cloud storage with Row Level Security (RLS) support.
Falls back safely to local SQLite storage whenever Supabase is not configured
or temporarily unreachable.
"""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

log = logging.getLogger("analyzer.supabase")


class SupabaseClient:
    """Lightweight REST-based client for Supabase PostgREST API with zero hard dependencies."""

    def __init__(self):
        self.url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
        self.anon_key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()
        self.service_role_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        self.timeout = 5.0

    @property
    def is_configured(self) -> bool:
        """Returns True only when both Supabase URL and at least one API key are present."""
        return bool(self.url and (self.service_role_key or self.anon_key))

    def _get_headers(self, use_service_role: bool = True) -> Dict[str, str]:
        key = self.service_role_key if (use_service_role and self.service_role_key) else self.anon_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def save_analysis(self, result: Dict[str, Any], snippet: str, user_id: Optional[str] = None) -> Optional[int]:
        """
        Persists analysis record, claims, evidence items, and prediction details to Supabase.
        Returns the cloud record ID on success, or None on failure/unconfigured.
        """
        if not self.is_configured:
            return None

        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # 1. Insert into public.analyses
            analysis_payload = {
                "created_at": now_iso,
                "source_type": result.get("source_type", "text"),
                "source_ref": result.get("source_ref"),
                "source_domain": result.get("source_domain"),
                "title": result.get("title"),
                "snippet": snippet,
                "input_type": result.get("input_type", "article"),
                "verdict": result.get("verdict", "Needs Verification"),
                "fake_probability": float(result.get("fake_probability", 0.5)),
                "confidence": float(result.get("confidence", 0.0)),
                "verification_status": result.get("verification_status", "Needs Verification"),
                "verification_reason": result.get("verification_reason", ""),
                "final_conclusion": result.get("final_conclusion", ""),
                "evidence_strength": result.get("evidence_strength", "None"),
                "raw_result": result,
            }
            if user_id:
                analysis_payload["user_id"] = user_id

            endpoint = f"{self.url}/rest/v1/analyses"
            resp = requests.post(
                endpoint,
                headers=self._get_headers(use_service_role=True),
                json=analysis_payload,
                timeout=self.timeout,
            )
            
            if resp.status_code in (200, 201):
                records = resp.json()
                if records and isinstance(records, list):
                    analysis_id = records[0].get("id")
                    
                    # 2. Insert Evidence Items if any
                    evidence_items = result.get("evidence_items", [])
                    if evidence_items and analysis_id:
                        self._save_evidence_items(analysis_id, evidence_items)
                        
                    return analysis_id
            else:
                log.warning(f"Supabase save_analysis returned status {resp.status_code}: {resp.text[:200]}")
                return None

        except Exception as e:
            log.warning(f"Supabase save_analysis error (falling back to SQLite): {e}")
            return None

    def _save_evidence_items(self, analysis_id: int, items: List[Dict[str, Any]]):
        """Helper to batch save evidence items to Supabase."""
        try:
            payloads = []
            now_iso = datetime.now(timezone.utc).isoformat()
            for item in items[:10]:
                payloads.append({
                    "analysis_id": analysis_id,
                    "source_name": item.get("source_name", "Unknown Source"),
                    "source_url": item.get("source_url", ""),
                    "source_type": item.get("source_type", "other"),
                    "snippet": item.get("snippet", "")[:1000],
                    "rating": item.get("rating"),
                    "relevance": item.get("relevance", "high"),
                    "evidence_strength": item.get("evidence_strength", "Moderate"),
                    "provenance": item.get("provenance", "authoritative_source_retrieval"),
                    "retrieved_at": item.get("retrieved_at", now_iso),
                })
            
            if payloads:
                endpoint = f"{self.url}/rest/v1/evidence_items"
                requests.post(
                    endpoint,
                    headers=self._get_headers(use_service_role=True),
                    json=payloads,
                    timeout=self.timeout,
                )
        except Exception as e:
            log.debug(f"Failed to batch insert evidence items to Supabase: {e}")

    def list_history(self, limit: int = 10, offset: int = 0, verdict: Optional[str] = None, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Queries historical records from Supabase."""
        if not self.is_configured:
            return None

        try:
            params = [
                f"limit={limit}",
                f"offset={offset}",
                "order=id.desc",
                "select=id,created_at,source_type,source_ref,title,snippet,verdict,fake_probability,confidence,verification_status,evidence_strength",
            ]
            if user_id:
                params.append(f"user_id=eq.{user_id}")
            if verdict:
                params.append(f"verdict=eq.{verdict}")

            endpoint = f"{self.url}/rest/v1/analyses?{'&'.join(params)}"
            headers = self._get_headers(use_service_role=False)
            headers["Prefer"] = "count=exact"
            
            resp = requests.get(endpoint, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                rows = resp.json()
                total = len(rows)
                # Parse Content-Range header if present
                content_range = resp.headers.get("Content-Range", "")
                if "/" in content_range:
                    try:
                        total = int(content_range.split("/")[-1])
                    except (ValueError, TypeError):
                        pass
                return {"items": rows, "total": total}
        except Exception as e:
            log.warning(f"Supabase list_history failed (falling back to local DB): {e}")
            return None

    def get_analysis(self, analysis_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves single analysis JSON from Supabase."""
        if not self.is_configured:
            return None

        try:
            endpoint = f"{self.url}/rest/v1/analyses?id=eq.{analysis_id}&select=raw_result"
            resp = requests.get(endpoint, headers=self._get_headers(use_service_role=False), timeout=self.timeout)
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    return rows[0].get("raw_result")
        except Exception as e:
            log.warning(f"Supabase get_analysis failed: {e}")
            return None

    def check_connection(self) -> Dict[str, Any]:
        """
        Validates Supabase URL and keys, tests connectivity,
        and inspects table availability and RLS accessibility.
        Never logs or returns raw secrets.
        """
        report = {
            "configured": self.is_configured,
            "url_valid": False,
            "anon_key_valid": False,
            "service_role_key_valid": False,
            "connected": False,
            "tables_ready": False,
            "rls_ready": False,
            "missing_vars": [],
            "error": None,
        }

        if not self.url:
            report["missing_vars"].append("SUPABASE_URL")
        elif self.url.startswith("https://") and ".supabase.co" in self.url:
            report["url_valid"] = True
        else:
            report["error"] = "SUPABASE_URL does not match expected format (https://<project-ref>.supabase.co)"

        if not self.anon_key:
            report["missing_vars"].append("SUPABASE_ANON_KEY")
        elif len(self.anon_key.split(".")) == 3:
            report["anon_key_valid"] = True

        if not self.service_role_key:
            report["missing_vars"].append("SUPABASE_SERVICE_ROLE_KEY")
        elif len(self.service_role_key.split(".")) == 3:
            report["service_role_key_valid"] = True

        if not self.is_configured:
            report["error"] = "Supabase credentials are not configured or empty in .env"
            return report

        try:
            endpoint = f"{self.url}/rest/v1/"
            resp = requests.get(endpoint, headers=self._get_headers(use_service_role=True), timeout=self.timeout)
            if resp.status_code in (200, 404):
                report["connected"] = True
                tbl_resp = requests.get(
                    f"{self.url}/rest/v1/analyses?limit=1",
                    headers=self._get_headers(use_service_role=True),
                    timeout=self.timeout
                )
                if tbl_resp.status_code in (200, 206):
                    report["tables_ready"] = True
                    anon_resp = requests.get(
                        f"{self.url}/rest/v1/analyses?limit=1",
                        headers=self._get_headers(use_service_role=False),
                        timeout=self.timeout
                    )
                    if anon_resp.status_code in (200, 206):
                        report["rls_ready"] = True
            else:
                report["error"] = f"HTTP {resp.status_code}"
        except Exception as exc:
            report["error"] = str(exc)

        return report


# Global singleton client instance
client = SupabaseClient()
