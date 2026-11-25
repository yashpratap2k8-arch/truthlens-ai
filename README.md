# TruthLens AI — Grounded Fact Verification & Misinformation Analyzer

TruthLens AI is an explainable, full-stack AI platform designed to detect misleading content, analyze linguistic style signals, verify factual claims against authoritative external evidence, and provide explainable AI reasoning.

> **Crucial Four-Layer Distinction:**
> 1. **ML Prediction:** Statistical estimate of writing patterns learned from training data (TF-IDF + Logistic Regression). It does **not** verify real-world facts.
> 2. **External Fact-Check Evidence:** Independent journalistic findings (Google Fact Check Explorer, Reuters, Snopes, PolitiFact, etc.) and authoritative institution records (Wikipedia REST API).
> 3. **Verification Status:** An evidence-based determination (`Verified True`, `False / Debunked`, `Partially True`, `Needs Verification`, or `Insufficient Context`). By default, without authoritative evidence, status is `Needs Verification`.
> 4. **AI Reasoning Layer (Google Gemini / OpenRouter):** Context-aware explainability and evidence synthesis. Never blindly trusts the ML prediction.

---

## Architecture & Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend:** FastAPI, Python 3.10+, scikit-learn, Uvicorn
- **AI Reasoning Layer:** Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`) with Google Search Grounding & OpenRouter fallback
- **Cloud Database:** Supabase Postgres with Row Level Security (RLS)
- **Local Fallback Database:** SQLite (`analyzer.db`)
- **Authentication:** Google Identity Services (OAuth 2.0 with JWT backend verification)
- **Authoritative Evidence Engine:** Google Fact Check Tools API + Wikipedia REST API with SHA-256 caching and SSRF protection

---

## Local Development — One Click

To start the entire application after a laptop restart with **one action**:

1. **Double-click:**
   ```text
   start-truthlens.bat
   ```
2. Wait for the Backend (`port 8000`) and Frontend (`port 5173`) terminal windows to launch and pass health checks.
3. Your browser will open automatically at:
   **http://localhost:5173/**
4. **To safely stop all services:**
   Double-click `stop-truthlens.bat`

### Manual Commands:
- **Backend (Terminal 1):**
  ```powershell
  cd backend
  .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```
- **Frontend (Terminal 2):**
  ```powershell
  cd frontend
  npm.cmd run dev
  ```

---

## LAN Demo — Accessing TruthLens From Other Devices on Wi-Fi

You can demo and test TruthLens AI from a mobile phone, tablet, or another device connected to the **same Wi-Fi network**:

1. **Launch Services:**
   Double-click `start-truthlens.bat`.
   The launcher automatically detects your laptop's Wi-Fi IPv4 address (e.g. `192.168.1.185`) and binds both services to `0.0.0.0`:
   - **Frontend:** `http://<YOUR_LAN_IP>:5173/` (e.g., `http://192.168.1.185:5173/`)
   - **Backend:** `http://<YOUR_LAN_IP>:8000/` (e.g., `http://192.168.1.185:8000/`)

2. **Connect from Phone / Friends' Laptops:**
   - Make sure the device is connected to the **same Wi-Fi network** as the host laptop.
   - Open the browser on that device and navigate to `http://<YOUR_LAN_IP>:5173/`.

3. **Frontend API URL Configuration (Optional):**
   - By default, Vite dev proxy handles all `/api` calls seamlessly.
   - For direct backend calls from LAN devices, you can set `frontend/.env`:
     ```env
     VITE_API_BASE_URL=http://<YOUR_LAN_IP>:8000
     ```

4. **Windows Firewall Rule (If Inbound Access is Blocked):**
   If a phone on the same Wi-Fi shows a connection timeout, Windows Firewall may be blocking inbound traffic on ports 5173 and 8000.
   To allow inbound access for the demo, run this one-time command in PowerShell as Administrator:
   ```powershell
   New-NetFirewallRule -DisplayName "TruthLens AI Dev Ports" -Direction Inbound -LocalPort 5173,8000 -Protocol TCP -Action Allow
   ```

---

## Configuration & Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
# Google Gemini API (Get key from Google AI Studio: https://aistudio.google.com/)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Supabase Cloud Database (Get URL and keys from Supabase project settings)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter AI Assistant (Alternative / fallback provider)
OPENROUTER_API_KEY=

# Google Fact Check Tools API
GOOGLE_FACT_CHECK_API_KEY=

# Google OAuth Authentication (Google Cloud Console Web Client ID)
GOOGLE_CLIENT_ID=715141477596-epqp4kkggtpkh6868airgtgsmhlhoauu.apps.googleusercontent.com

# Session JWT Secret
SESSION_SECRET=truthlens_dev_secret_key_change_in_production
```

> **Security Note:** Never commit `backend/.env` or expose secret keys (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`) in frontend code.

---

## Google Gemini API Setup

1. Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).
2. In `backend/.env`, set:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. TruthLens uses Gemini for:
   - Factual question evaluation and evidence synthesis.
   - Grounded conversational explainability in the AI Assistant.
   - Official Google Search grounding when available on the selected model/tier.
4. **Fallback:** If `GEMINI_API_KEY` is not provided or unavailable, the system automatically falls back to OpenRouter or rule-based authoritative evidence checks without crashing.

---

## Supabase Cloud Database Setup

1. Create a free project at [Supabase](https://supabase.com/).
2. In the Supabase SQL Editor, run:
   - `database/supabase_schema.sql` (Creates tables: `profiles`, `analyses`, `claims`, `evidence_sources`, `evidence_items`, `predictions`, `conversations`, `messages`, `saved_results`).
   - `database/supabase_rls.sql` (Enforces Row Level Security policies for user isolation).
3. In `backend/.env`, set:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
4. **Zero-Downtime Fallback:** If Supabase is not configured or temporarily unreachable, TruthLens seamlessly saves and queries from local SQLite (`backend/analyzer.db`).

---

## Evidence Hierarchy & Verification Architecture

TruthLens enforces a strict evidence hierarchy:

| Status | Definition | Trigger Requirement |
|---|---|---|
| **Verified True** | Claim is supported by empirical fact | Confirmed by authoritative records or independent fact-checkers |
| **False / Debunked** | Claim is factually incorrect or fabricated | Debunked by independent fact-checkers or refuted by official records |
| **Partially True** | Claim contains true elements mixed with caveats | Evaluated as half-true or missing critical context |
| **Needs Verification** | Evidence is insufficient or inconclusive | **Default state** whenever reliable external evidence is absent |
| **Insufficient Context** | Input is too brief or fragmented | 1–2 words or fragmented input |

---

## Google Sign-In & System Clock Sync

If Google Sign-In ever displays `"Token used too early"` after rebooting your laptop:
- Windows **Settings** → **Time & Language** → **Date & Time**.
- Click **"Sync now"** under *Synchronize your clock*.
- Retry Sign in with Google.

---

## Running Verification Tests

```powershell
# Run the complete upgrade test suite:
.\backend\venv\Scripts\python.exe backend\test_upgrade_suite.py

# Run the original 10-scenario production suite:
.\backend\venv\Scripts\python.exe backend\test_production_suite.py
```
