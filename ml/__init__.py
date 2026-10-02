"""Machine-learning package for Urban Drainage Monitor.

`risk_model` holds the baseline drainage-risk prototype: feature definitions,
the documented proxy target, model construction, training and prediction.
It deliberately contains no Flask or database code so it can be unit-tested
and re-run reproducibly on any tabular input.
"""

from .risk_model import (  # noqa: F401
    FEATURE_NAMES,
    MODEL_TYPE,
    MODEL_VERSION,
    PROXY_WEIGHTS,
    RANDOM_STATE,
    RISK_THRESHOLDS,
    LIMITATIONS,
    build_matrix,
    combined_score,
    proxy_risk,
    risk_level,
    train_baseline,
)
