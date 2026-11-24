# TruthLens — AI Fake News Analyzer

A full-stack college project that estimates whether a news headline, article or web page **resembles misleading content**. It explains its reasoning, highlights suspicious wording, links to fact-checkers and keeps a history with analytics.

> **Important:** The model gives a probability based on *writing patterns*. It does **not** verify facts and never claims an article is definitely real or fake. Verdicts are `Likely Real`, `Likely Fake` or `Needs Verification`.

## Features
- Analyze pasted text, an article URL, or a dragged-and-dropped `.txt` file
- Verdict + model confidence (computed by the model, never hardcoded)
- Influential-word chart and highlighted text (suspicious wording, words pushing toward fake / real)
- Plain-language explanation, with uncertainty handling for short or unfamiliar text
- Fact-check search links (Google Fact Check Explorer, PolitiFact, FactCheck.org, Alt News, BOOM, Snopes)
- History (view, filter, delete, clear) stored in SQLite
- Analytics dashboard (verdict split, daily activity, sources) and real model metrics (accuracy, precision, recall, F1, confusion matrix)
- Dark/light theme, responsive layout, loading and error states

## Tech stack
React 18 · Vite · Tailwind CSS · Recharts · FastAPI · scikit-learn (TF-IDF + Logistic Regression) · SQLite

## Folder structure
```
fake-news-analyzer/
├── backend/
│   ├── requirements.txt
│   ├── train.py              # trains the model on ISOT, writes metrics
│   ├── data/                 # put True.csv and Fake.csv here
│   ├── models/               # model.joblib + metrics.json (generated)
│   └── app/
│       ├── main.py           # FastAPI routes
│       ├── ml.py             # cleaning, model, prediction, uncertainty rules
│       ├── analysis.py       # explanations, style heuristics, highlights, fact-check links
│       ├── extractor.py      # URL -> article text (blocks private addresses)
│       └── database.py       # SQLite history + statistics
└── frontend/
    ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html
    └── src/
        ├── main.jsx, App.jsx, api.js, constants.js, useTheme.js, index.css
        └── components/  Navbar Landing Analyzer ResultCard HighlightedText
                         History Dashboard Loader Badge
```

## Setup

You need **Python 3.10+** and **Node.js 18+**.

### 1. Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate      macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### 2. Get the dataset
Download the **ISOT Fake News Dataset** from the University of Victoria ISOT page (https://onlineacademiccommunity.uvic.ca/isot/) — a mirror also exists on Kaggle. Copy the two files into `backend/data/`:
```
backend/data/True.csv
backend/data/Fake.csv
```

### 3. Train the model (about a minute)
```bash
python train.py
```
This cleans the data, removes empty rows and duplicates, splits 80/20, trains the model, prints a classification report and saves `models/model.joblib` and `models/metrics.json`.

### 4. Start the API
```bash
uvicorn app.main:app --reload
```
API docs: http://127.0.0.1:8000/docs

### 5. Start the frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend on port 8000.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/analyze/text` | `{ "text": "..." }` |
| POST | `/api/analyze/url` | `{ "url": "https://..." }` |
| POST | `/api/analyze/file` | multipart upload, field `file` (.txt, ≤ 1 MB) |
| GET | `/api/history?limit=&offset=&verdict=` | paginated history |
| GET / DELETE | `/api/history/{id}` | open / delete one analysis |
| DELETE | `/api/history` | clear all |
| GET | `/api/stats` | dashboard statistics |
| GET | `/api/model/info` | metrics saved by `train.py` |
| GET | `/api/health` | status + whether a model is loaded |

## How the verdict is decided
1. **Clean:** lowercase, remove URLs, punctuation, digits and the publisher name "Reuters".
2. **Vectorize:** TF-IDF on 1–2 word sequences (English stop words removed).
3. **Predict:** Logistic Regression returns `p(fake)`.
4. **Decide cautiously** (`backend/app/ml.py`):
   - `p ≥ 0.75` → Likely Fake, `p ≤ 0.25` → Likely Real, otherwise **Needs Verification**
   - Under 30 words (e.g. headlines): stricter thresholds `0.85 / 0.15`
   - Under 6 words, or less than 50% of the words known to the model → always Needs Verification
5. **Explain:** each word's contribution = TF-IDF value × model coefficient. Style signals (sensational wording, ALL CAPS, …) are separate regex heuristics.

## Limitations (mention these in your viva)
- ISOT is mostly **US political news from 2016–2017**. The model learns the style and topics of its sources, so high test accuracy does not carry over to other topics, languages or recent events.
- The ML score measures resemblance to a dataset, not truth. A false claim written in a neutral style can score as "real".
- URL extraction fails on paywalled, JavaScript-only or bot-blocking sites.
- Fact-check links are searches, not confirmed matches.

## Troubleshooting
- **"No trained model found"** → run `python train.py` (step 3), then restart the API.
- **"Cannot reach the server"** → start `uvicorn` from inside the `backend` folder.
- **`ModuleNotFoundError: app`** → run commands from the `backend` folder.
- **Port already in use** → `uvicorn app.main:app --port 8001` and change the proxy target in `frontend/vite.config.js`.

## Ideas for improvement
Cross-validation, comparing Naive Bayes / SVM, a newer multi-source dataset, a calibration step, user accounts, Docker.
