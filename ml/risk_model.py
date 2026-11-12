"""Baseline drainage-risk model (Step 9) — an explainable PROTOTYPE.

What this is, and is not
-----------------------
This module trains a small, explainable baseline model on features derived
from the crowdsourced drainage reports the platform already holds. There is
**no real-world labelled flooding dataset** in this project, so the model is
NOT a flood forecast and must never be presented as an official warning.

The three layers are kept strictly separate, and the API exposes all three:

1. **Observed report data** — counts straight out of PostgreSQL/PostGIS
   (reports per area, severity, status, recency, spread).
2. **Engineered features** — the numeric columns in ``FEATURE_NAMES``.
3. **Proxy target** — a documented, transparent formula (``proxy_risk``) that
   turns the observed indicators into a 0–1 "reported-pressure" score. It is a
   *stand-in* for a real label, not a measured flood outcome.
4. **Model prediction** — a logistic regression fitted on the engineered
   features against the binarised proxy target. Its output is the risk score
   the API returns.

Reproducibility: no randomness beyond a fixed ``RANDOM_STATE``; the same input
rows always produce the same model and the same predictions.
"""

from __future__ import annotations

from typing import Iterable, Sequence

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_TYPE = "LogisticRegression (standardised features, explainable baseline)"
MODEL_VERSION = "baseline-logreg-v1"
RANDOM_STATE = 42

#: Engineered features, in the exact column order the model expects.
FEATURE_NAMES: tuple[str, ...] = (
    "report_count",
    "recent_count",
    "high_severity_count",
    "unresolved_count",
    "flood_related_count",
    "issue_type_variety",
    "density_per_km2",
    "recency_score",
    "spread_m",
)

#: Proxy-target weights. Every term is an observed report indicator, capped so
#: one very busy area cannot dominate the scale. Documented in the README.
PROXY_WEIGHTS: dict[str, dict[str, float]] = {
    "report_count": {"weight": 0.30, "cap": 8.0},
    "recent_count": {"weight": 0.25, "cap": 5.0},
    "high_severity_count": {"weight": 0.20, "cap": 4.0},
    "unresolved_count": {"weight": 0.15, "cap": 5.0},
    "recency_score": {"weight": 0.10, "cap": 1.0},
}

#: Score bands used for the LOW / MEDIUM / HIGH label shown in the UI.
RISK_THRESHOLDS = {"medium": 0.34, "high": 0.67}

#: Minimum number of areas (grid cells) before training is attempted at all.
MIN_SAMPLES = 4
#: Below these numbers a train/test or cross-validated metric would be noise.
MIN_SAMPLES_FOR_VALIDATION = 20
MIN_CLASS_FOR_VALIDATION = 5

LIMITATIONS: tuple[str, ...] = (
    "Prototype only: trained on crowdsourced drainage reports, not on verified flood outcomes.",
    "The target is a documented proxy score derived from report volume, severity, "
    "backlog and recency — it is not a measured flooding event.",
    "Reporting bias: areas with more engaged citizens look riskier than quiet areas.",
    "No rainfall, elevation, drainage-network or historical flooding data is used yet.",
    "Predictions are not official flood warnings and must not be used for emergency decisions.",
)


def _capped(value: float, cap: float) -> float:
    if cap <= 0:
        return 0.0
    return float(min(max(value, 0.0) / cap, 1.0))


def proxy_risk(row: dict) -> float:
    """Documented proxy target in [0, 1] built from observed indicators only."""
    score = 0.0
    for name, spec in PROXY_WEIGHTS.items():
        score += spec["weight"] * _capped(float(row.get(name, 0.0) or 0.0), spec["cap"])
    return round(min(score, 1.0), 4)


def risk_level(score: float) -> str:
    if score >= RISK_THRESHOLDS["high"]:
        return "HIGH"
    if score >= RISK_THRESHOLDS["medium"]:
        return "MEDIUM"
    return "LOW"


def combined_score(model_probability: float, proxy: float) -> float:
    """Reported risk score = geometric mean of the model probability and the proxy.

    The classifier only learns to *separate* areas, so on a small dataset it
    returns very confident probabilities even for an area with a single report.
    Multiplying it by the proxy magnitude (and taking the square root) keeps the
    model's ranking while making sure an area with very little reported activity
    can never reach a high score. Both inputs are returned to the API as well,
    so the model output and the proxy stay individually visible.
    """
    return round(float(np.sqrt(max(model_probability, 0.0) * max(proxy, 0.0))), 4)


def build_matrix(rows: Sequence[dict]) -> np.ndarray:
    """Feature matrix in ``FEATURE_NAMES`` order."""
    return np.array(
        [[float(row.get(name, 0.0) or 0.0) for name in FEATURE_NAMES] for row in rows],
        dtype=float,
    )


def _make_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("scale", StandardScaler()),
            (
                "model",
                LogisticRegression(
                    random_state=RANDOM_STATE,
                    max_iter=1000,
                    class_weight="balanced",
                ),
            ),
        ]
    )


def _labels(proxies: np.ndarray) -> tuple[np.ndarray, str, list[str]]:
    """Binarise the proxy score, with an honest fallback for small datasets."""
    warnings: list[str] = []
    labels = (proxies >= 0.5).astype(int)
    if len(set(labels.tolist())) > 1:
        return labels, "absolute-threshold-0.5", warnings

    if float(np.max(proxies) - np.min(proxies)) < 1e-9:
        return labels, "degenerate", ["Every area has an identical proxy score."]

    median = float(np.median(proxies))
    labels = (proxies > median).astype(int)
    warnings.append(
        "Too few areas crossed the absolute proxy threshold, so areas were labelled "
        "relative to the median of this dataset. The classes are relative, not absolute."
    )
    if len(set(labels.tolist())) < 2:
        return labels, "degenerate", warnings
    return labels, "relative-median-split", warnings


def _validate(matrix: np.ndarray, labels: np.ndarray, pipeline: Pipeline) -> dict:
    """Cross-validate only when the sample size makes a metric meaningful."""
    n = len(labels)
    counts = np.bincount(labels, minlength=2)
    smallest_class = int(counts.min())

    if n < MIN_SAMPLES_FOR_VALIDATION or smallest_class < MIN_CLASS_FOR_VALIDATION:
        return {
            "performed": False,
            "method": None,
            "accuracy": None,
            "roc_auc": None,
            "note": (
                f"Only {n} areas ({smallest_class} in the smaller class) — too small for a "
                "meaningful train/test or cross-validated score, so no accuracy is reported. "
                "Any number here would be noise."
            ),
        }

    folds = min(5, smallest_class)
    splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
    predicted = cross_val_predict(pipeline, matrix, labels, cv=splitter)
    probabilities = cross_val_predict(pipeline, matrix, labels, cv=splitter, method="predict_proba")
    return {
        "performed": True,
        "method": f"stratified {folds}-fold cross-validation",
        "accuracy": round(float(accuracy_score(labels, predicted)), 3),
        "roc_auc": round(float(roc_auc_score(labels, probabilities[:, 1])), 3),
        "note": (
            "Measured against the engineered proxy target, so it shows how learnable that "
            "formula is — it is NOT accuracy against real flooding events."
        ),
    }


def train_baseline(rows: Iterable[dict]) -> dict:
    """Fit the baseline on engineered area rows.

    Returns a dict with ``trained``, the fitted ``pipeline`` (or None), the
    per-area ``predictions``, validation information, feature importances and
    the standing limitations. Never raises on small data — it reports instead.
    """
    rows = list(rows)
    base = {
        "trained": False,
        "pipeline": None,
        "model_type": MODEL_TYPE,
        "model_version": MODEL_VERSION,
        "features": list(FEATURE_NAMES),
        "samples": len(rows),
        "predictions": [],
        "validation": {"performed": False, "accuracy": None, "roc_auc": None, "note": None},
        "target": {"kind": "proxy", "weights": PROXY_WEIGHTS, "labelling": None},
        "warnings": [],
        "limitations": list(LIMITATIONS),
    }

    if len(rows) < MIN_SAMPLES:
        base["reason"] = (
            f"Not enough data: {len(rows)} area(s) with reports, at least {MIN_SAMPLES} are "
            "needed before a baseline model can be fitted."
        )
        base["insufficient_data"] = True
        return base

    proxies = np.array([proxy_risk(row) for row in rows], dtype=float)
    labels, labelling, warnings = _labels(proxies)
    base["target"]["labelling"] = labelling
    base["warnings"] = warnings

    if labelling == "degenerate":
        base["reason"] = (
            "The reported data cannot be separated yet: every area produces effectively the "
            "same proxy score, so a classifier would learn nothing."
        )
        base["insufficient_data"] = True
        return base

    matrix = build_matrix(rows)
    pipeline = _make_pipeline()
    validation = _validate(matrix, labels, pipeline)
    pipeline.fit(matrix, labels)
    scores = pipeline.predict_proba(matrix)[:, 1]

    coefficients = pipeline.named_steps["model"].coef_[0]
    importances = sorted(
        (
            {"feature": name, "coefficient": round(float(value), 4)}
            for name, value in zip(FEATURE_NAMES, coefficients)
        ),
        key=lambda item: abs(item["coefficient"]),
        reverse=True,
    )

    predictions = []
    for row, proxy, label, probability in zip(rows, proxies, labels, scores):
        score = combined_score(float(probability), float(proxy))
        predictions.append(
            {
                **row,
                "proxy_risk": float(proxy),
                "proxy_label": int(label),
                "model_probability": round(float(probability), 4),
                "risk_score": score,
                "risk_level": risk_level(score),
            }
        )
    predictions.sort(key=lambda item: item["risk_score"], reverse=True)

    base.update(
        {
            "trained": True,
            "pipeline": pipeline,
            "predictions": predictions,
            "validation": validation,
            "feature_importance": importances,
            "insufficient_data": False,
        }
    )
    return base
