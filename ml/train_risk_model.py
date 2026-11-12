"""Reproducible training entry point for the baseline drainage-risk prototype.

Run from the project root, with the backend's virtual environment active:

    python -m ml.train_risk_model

It uses the same Flask app configuration as the API (so the same database and
the same feature SQL), trains the baseline, stores the predictions in
`risk_predictions`, and prints a short report. Nothing random beyond the fixed
RANDOM_STATE in `ml/risk_model.py`, so repeated runs give identical output.
"""

from __future__ import annotations

import json

from backend.app import create_app
from backend.services.risk import train_and_store


def main() -> None:
    app = create_app()
    with app.app_context():
        result = train_and_store()

    summary = {
        "trained": result["trained"],
        "model_type": result["model_type"],
        "model_version": result["model_version"],
        "features": result["features"],
        "samples": result["samples"],
        "target": {
            "kind": result["target"]["kind"],
            "labelling": result["target"]["labelling"],
        },
        "validation": result["validation"],
        "stored_predictions": result["stored_predictions"],
        "warnings": result["warnings"],
        "reason": result.get("reason"),
        "limitations": result["limitations"],
        "disclaimer": result["disclaimer"],
    }
    print(json.dumps(summary, indent=2))

    for item in result["predictions"][:10]:
        print(
            f"  {item['risk_level']:<6} score={item['risk_score']:.3f} "
            f"proxy={item['proxy_risk']:.3f} reports={item['report_count']} "
            f"at ({item['latitude']:.5f}, {item['longitude']:.5f})"
        )


if __name__ == "__main__":
    main()
