"""Train the TF-IDF + Logistic Regression model on the ISOT Fake News dataset.

Run from the backend folder:
    python train.py

Needs data/True.csv and data/Fake.csv (see README, step 3).
Writes models/model.joblib and models/metrics.json. All metrics are measured
on a held-out test set — nothing is hardcoded.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import joblib  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support  # noqa: E402
from sklearn.model_selection import train_test_split  # noqa: E402

from app.ml import MODEL_DIR, build_pipeline, strip_source_tag  # noqa: E402

HERE = Path(__file__).resolve().parent


def load_isot(data_dir: Path) -> pd.DataFrame:
    true_csv, fake_csv = data_dir / "True.csv", data_dir / "Fake.csv"
    missing = [p.name for p in (true_csv, fake_csv) if not p.exists()]
    if missing:
        sys.exit(f"Missing {', '.join(missing)} in {data_dir}. See README step 3 to download the ISOT dataset.")

    real, fake = pd.read_csv(true_csv), pd.read_csv(fake_csv)
    real["label"], fake["label"] = 0, 1  # 1 = fake
    df = pd.concat([real, fake], ignore_index=True)
    df["title"] = df["title"].fillna("").astype(str)
    df["text"] = df["text"].fillna("").astype(str).map(strip_source_tag)

    start = len(df)
    df = df[df["text"].str.split().str.len() >= 10]            # drop empty / tweet-only rows
    df = df.assign(content=(df["title"] + ". " + df["text"]).str.strip())
    df = df.drop_duplicates(subset="content")                   # duplicates would leak into the test set
    print(f"Loaded {start} rows, kept {len(df)} after removing empty rows and duplicates.")
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, default=HERE / "data")
    ap.add_argument("--out-dir", type=Path, default=MODEL_DIR)
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    df = load_isot(args.data_dir)
    X_train, X_test, y_train, y_test = train_test_split(
        df["content"], df["label"], test_size=args.test_size, stratify=df["label"], random_state=args.seed
    )

    print("Training TF-IDF + Logistic Regression ...")
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)

    pred = pipe.predict(X_test)
    prec, rec, f1, _ = precision_recall_fscore_support(y_test, pred, average="binary", pos_label=1)
    print(classification_report(y_test, pred, target_names=["real", "fake"], digits=4))

    vec, clf = pipe.named_steps["tfidf"], pipe.named_steps["clf"]
    feats, order = vec.get_feature_names_out(), clf.coef_[0].argsort()
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": "ISOT Fake News Dataset",
        "algorithm": "TF-IDF (1-2 grams) + Logistic Regression",
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "n_features": int(len(feats)),
        "accuracy": float(accuracy_score(y_test, pred)),
        "precision": float(prec),
        "recall": float(rec),
        "f1": float(f1),
        # rows = actual [real, fake], columns = predicted [real, fake]
        "confusion_matrix": confusion_matrix(y_test, pred, labels=[0, 1]).tolist(),
        "top_real_terms": [str(feats[i]) for i in order[:15]],
        "top_fake_terms": [str(feats[i]) for i in order[::-1][:15]],
    }

    args.out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, args.out_dir / "model.joblib")
    (args.out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"Saved model and metrics to {args.out_dir}  (test accuracy: {metrics['accuracy']:.4f})")


if __name__ == "__main__":
    main()
