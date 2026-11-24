"""SQLite storage for analysis history and statistics."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "analyzer.db"
VERDICTS = ("Likely Real", "Needs Verification", "Likely Fake")


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                google_sub TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                name TEXT,
                picture TEXT,
                created_at TEXT NOT NULL,
                last_login_at TEXT NOT NULL
            )"""
        )
        c.execute("CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

        c.execute(
            """CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                source_type TEXT NOT NULL,      -- text | url | file
                source_ref TEXT,                -- URL or file name
                title TEXT,
                snippet TEXT,
                verdict TEXT NOT NULL,
                fake_probability REAL NOT NULL,
                confidence REAL NOT NULL,
                result_json TEXT NOT NULL,
                user_id INTEGER REFERENCES users(id)
            )"""
        )
        c.execute("CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at)")

        # Ensure user_id column exists if table was created previously
        cols = [r["name"] for r in c.execute("PRAGMA table_info(analyses)").fetchall()]
        if "user_id" not in cols:
            c.execute("ALTER TABLE analyses ADD COLUMN user_id INTEGER REFERENCES users(id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id)")


def get_or_create_user(google_sub: str, email: str, name: str = None, picture: str = None) -> dict:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_conn() as c:
        row = c.execute("SELECT * FROM users WHERE google_sub = ?", (google_sub,)).fetchone()
        if row:
            c.execute(
                "UPDATE users SET email = ?, name = ?, picture = ?, last_login_at = ? WHERE id = ?",
                (email, name or row["name"], picture or row["picture"], now, row["id"]),
            )
            return {
                "id": row["id"],
                "google_sub": google_sub,
                "email": email,
                "name": name or row["name"],
                "picture": picture or row["picture"],
                "created_at": row["created_at"],
                "last_login_at": now,
            }
        else:
            cur = c.execute(
                """INSERT INTO users (google_sub, email, name, picture, created_at, last_login_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (google_sub, email, name, picture, now, now),
            )
            return {
                "id": cur.lastrowid,
                "google_sub": google_sub,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": now,
                "last_login_at": now,
            }


def get_user_by_id(user_id: int):
    with get_conn() as c:
        row = c.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return dict(row)


def save_analysis(result: dict, snippet: str, user_id=None):
    """Insert a result and return (id, created_at)."""
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_conn() as c:
        cur = c.execute(
            """INSERT INTO analyses (created_at, source_type, source_ref, title, snippet,
                                     verdict, fake_probability, confidence, result_json, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                created_at,
                result["source_type"],
                result.get("source_ref"),
                result.get("title"),
                snippet,
                result["verdict"],
                result["fake_probability"],
                result["confidence"],
                json.dumps(result),
                user_id,
            ),
        )
        return cur.lastrowid, created_at


def list_history(limit=10, offset=0, verdict=None, user_id=None):
    clauses, params = [], []
    if user_id is not None:
        clauses.append("user_id = ?")
        params.append(user_id)
    else:
        clauses.append("user_id IS NULL")

    if verdict:
        clauses.append("verdict = ?")
        params.append(verdict)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with get_conn() as c:
        total = c.execute(f"SELECT COUNT(*) FROM analyses {where}", params).fetchone()[0]
        rows = c.execute(
            f"""SELECT id, created_at, source_type, source_ref, title, snippet,
                       verdict, fake_probability, confidence, user_id
                FROM analyses {where} ORDER BY id DESC LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ).fetchall()
    return {"items": [dict(r) for r in rows], "total": total}


def get_analysis(analysis_id: int, user_id=None):
    with get_conn() as c:
        row = c.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    if row is None:
        return None
    row_user_id = row["user_id"]
    if row_user_id is not None and row_user_id != user_id:
        return None
    data = json.loads(row["result_json"])
    data["id"], data["created_at"] = row["id"], row["created_at"]
    return data


def delete_analysis(analysis_id: int, user_id=None) -> bool:
    with get_conn() as c:
        if user_id is not None:
            return c.execute("DELETE FROM analyses WHERE id = ? AND user_id = ?", (analysis_id, user_id)).rowcount > 0
        else:
            return c.execute("DELETE FROM analyses WHERE id = ? AND user_id IS NULL", (analysis_id,)).rowcount > 0


def clear_history(user_id=None) -> int:
    with get_conn() as c:
        if user_id is not None:
            return c.execute("DELETE FROM analyses WHERE user_id = ?", (user_id,)).rowcount
        else:
            return c.execute("DELETE FROM analyses WHERE user_id IS NULL").rowcount


def stats(days=14):
    with get_conn() as c:
        total = c.execute("SELECT COUNT(*) FROM analyses").fetchone()[0]
        avg_conf = c.execute("SELECT AVG(confidence) FROM analyses").fetchone()[0]
        by_verdict = dict(c.execute("SELECT verdict, COUNT(*) FROM analyses GROUP BY verdict").fetchall())
        by_source = dict(c.execute("SELECT source_type, COUNT(*) FROM analyses GROUP BY source_type").fetchall())
        since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
        rows = c.execute(
            """SELECT substr(created_at, 1, 10) AS day, verdict, COUNT(*) AS n
               FROM analyses WHERE substr(created_at, 1, 10) >= ? GROUP BY day, verdict""",
            (since,),
        ).fetchall()

    daily = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        daily[d] = {"day": d, "real": 0, "review": 0, "fake": 0}
    key = {"Likely Real": "real", "Needs Verification": "review", "Likely Fake": "fake"}
    for r in rows:
        if r["day"] in daily and r["verdict"] in key:
            daily[r["day"]][key[r["verdict"]]] = r["n"]

    return {
        "total": total,
        "avg_confidence": avg_conf,
        "verdicts": {v: by_verdict.get(v, 0) for v in VERDICTS},
        "sources": {s: by_source.get(s, 0) for s in ("text", "url", "file")},
        "daily": list(daily.values()),
    }
