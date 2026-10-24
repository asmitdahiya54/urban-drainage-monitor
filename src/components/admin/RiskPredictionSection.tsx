/**
 * Admin "Risk Prediction" section (Step 9).
 *
 * Shows the prototype baseline model: predicted LOW / MEDIUM / HIGH areas, the
 * risk score, the report counts behind each score and the training details.
 * It is deliberately styled as an internal analysis panel, never as an official
 * warning, and repeats the prototype disclaimer in a neutral tone.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { LazyMap } from "@/components/map/LazyMap";
import type { MapRiskArea } from "@/components/map/MapCanvas";
import {
  ApiError,
  RISK_DISCLAIMER,
  riskApi,
  type RiskLevel,
  type RiskPredictionsResponse,
  type RiskTrainingResult,
} from "@/services/api";

const LEVEL_STYLES: Record<RiskLevel, string> = {
  HIGH: "bg-destructive/10 text-destructive border-destructive/30",
  MEDIUM: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  LOW: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400",
};

const LEVEL_ORDER: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];

function Disclaimer() {
  return (
    <p className="mt-3 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-semibold">Prototype:</span> {RISK_DISCLAIMER}
    </p>
  );
}

export function RiskPredictionSection() {
  const [data, setData] = useState<RiskPredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<RiskTrainingResult | null>(null);
  const [trainError, setTrainError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return riskApi
      .predictions()
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "The risk predictions could not be loaded right now.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const train = useCallback(async () => {
    setTraining(true);
    setTrainError(null);
    try {
      const result = await riskApi.train();
      setTrainResult(result);
      await load();
    } catch (err: unknown) {
      setTrainError(
        err instanceof ApiError ? err.message : "The model could not be trained right now.",
      );
    } finally {
      setTraining(false);
    }
  }, [load]);

  const predictions = data?.predictions ?? [];

  const counts = useMemo(() => {
    const base: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    predictions.forEach((item) => {
      base[item.risk_level] = (base[item.risk_level] ?? 0) + 1;
    });
    return base;
  }, [predictions]);

  const riskAreas: MapRiskArea[] = useMemo(
    () =>
      predictions.map((item) => ({
        id: item.id,
        latitude: item.latitude,
        longitude: item.longitude,
        level: item.risk_level,
        score: item.risk_score,
        reportCount: item.indicators?.report_count ?? null,
      })),
    [predictions],
  );

  const insufficient = Boolean(trainResult && !trainResult.trained);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Risk prediction (prototype)</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            An explainable baseline model trained on the reports this platform already holds. It
            highlights areas under the most reported drainage pressure.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void train()}
          disabled={training}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {training ? "Training…" : predictions.length > 0 ? "Retrain model" : "Train model"}
        </button>
      </div>

      <Disclaimer />

      {trainError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {trainError}
        </p>
      )}

      {insufficient && trainResult && (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-4">
          <p className="text-sm font-semibold">Not enough data to train yet</p>
          <p className="mt-1 text-sm text-muted-foreground">{trainResult.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Areas found: {trainResult.areas}. More reports across more locations are needed.
          </p>
        </div>
      )}

      {trainResult?.trained && (
        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Training summary</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>Model: {trainResult.model_type}</li>
              <li>Version: {trainResult.model_version}</li>
              <li>Training samples (areas): {trainResult.samples}</li>
              <li>Predictions stored: {trainResult.stored_predictions}</li>
              <li>Features used: {trainResult.features.length}</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Validation</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>
                {trainResult.validation.performed
                  ? `${trainResult.validation.method}: accuracy ${trainResult.validation.accuracy}, ROC-AUC ${trainResult.validation.roc_auc}`
                  : "No score reported"}
              </li>
              {trainResult.validation.note && <li>{trainResult.validation.note}</li>}
              <li>
                Target: {trainResult.target.kind} ({trainResult.target.labelling})
              </li>
            </ul>
          </div>
          {trainResult.warnings.length > 0 && (
            <div className="sm:col-span-2">
              <p className="font-semibold">Warnings</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {trainResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="sm:col-span-2">
            <p className="font-semibold">Limitations</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {trainResult.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading && <p className="mt-4 text-sm text-muted-foreground">Loading risk predictions…</p>}

      {error && !loading && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {!loading && !error && predictions.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {data?.message ?? "No prototype predictions yet — train the baseline model first."}
          </p>
        </div>
      )}

      {!loading && !error && predictions.length > 0 && (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {LEVEL_ORDER.map((level) => (
              <div key={level} className={`rounded-xl border p-4 ${LEVEL_STYLES[level]}`}>
                <dt className="text-xs font-semibold uppercase tracking-wide">{level} risk</dt>
                <dd className="mt-1 text-2xl font-bold">{counts[level]}</dd>
                <dd className="text-xs opacity-80">area{counts[level] === 1 ? "" : "s"}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">
            Generated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : "—"} ·
            model {data?.model_version}
          </p>

          <div className="mt-4 h-72 overflow-hidden rounded-xl border border-border sm:h-80">
            <LazyMap
              latitude={null}
              longitude={null}
              zoom={11}
              riskAreas={riskAreas}
              label="Loading risk map…"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Area</th>
                  <th className="px-3 py-2.5">Reports</th>
                  <th className="px-3 py-2.5">Recent (30d)</th>
                  <th className="px-3 py-2.5">High/critical</th>
                  <th className="px-3 py-2.5">Unresolved</th>
                  <th className="px-3 py-2.5">Predicted</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLES[item.risk_level]}`}
                      >
                        {item.risk_level}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{item.risk_score.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5">{item.indicators?.report_count ?? "—"}</td>
                    <td className="px-3 py-2.5">{item.indicators?.recent_count ?? "—"}</td>
                    <td className="px-3 py-2.5">{item.indicators?.high_severity_count ?? "—"}</td>
                    <td className="px-3 py-2.5">{item.indicators?.unresolved_count ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {item.prediction_date
                        ? new Date(item.prediction_date).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data?.limitations && data.limitations.length > 0 && (
            <details className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                How this prototype works, and what it cannot do
              </summary>
              <p className="mt-2 text-muted-foreground">
                Model: {data.model_type}. Features: {data.features.join(", ")}.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {data.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
