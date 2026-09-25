import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { LocationPicker } from "@/components/map/LocationPicker";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import {
  ApiError,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  SEVERITIES,
  STATUS_LABELS,
  reportsApi,
  type DuplicateCheck,
  type DuplicateMatch,
  type IssueType,
  type Severity,
} from "@/services/api";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Drainage Issue | Urban Drainage Monitor" },
      {
        name: "description",
        content:
          "Report blocked drains, waterlogging and overflow points in your neighbourhood to help city teams respond faster.",
      },
      { property: "og:title", content: "Report a Drainage Issue | Urban Drainage Monitor" },
      {
        property: "og:description",
        content: "Submit a community drainage report with a map location and severity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ReportPage />
    </ProtectedRoute>
  ),
});

const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

function ReportPage() {
  const navigate = useNavigate();

  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("MEDIUM");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Step 8 — duplicate detection state.
  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateCheck | null>(null);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  function setPoint(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setLatText(String(lat));
    setLngText(String(lng));
  }

  function onLatText(value: string) {
    setLatText(value);
    const parsed = Number(value);
    setLatitude(value.trim() !== "" && Number.isFinite(parsed) ? parsed : null);
  }

  function onLngText(value: string) {
    setLngText(value);
    const parsed = Number(value);
    setLongitude(value.trim() !== "" && Number.isFinite(parsed) ? parsed : null);
  }

  /** Mirrors the backend rules so obvious mistakes never need a round trip. */
  function validate(): string | null {
    if (!issueType) return "Choose the type of drainage issue.";
    if (!severity) return "Choose how severe the problem is.";
    const trimmed = description.trim();
    if (trimmed.length < DESCRIPTION_MIN)
      return `Please describe the problem in at least ${DESCRIPTION_MIN} characters.`;
    if (trimmed.length > DESCRIPTION_MAX)
      return `Description must be at most ${DESCRIPTION_MAX} characters.`;
    if (latitude === null || longitude === null)
      return "Pick the location on the map, or enter latitude and longitude.";
    if (latitude < -90 || latitude > 90) return "Latitude must be between -90 and 90.";
    if (longitude < -180 || longitude > 180) return "Longitude must be between -180 and 180.";
    return null;
  }

  /** Sends the report. `confirm` skips the backend duplicate guard on purpose. */
  async function submitReport(confirm: boolean) {
    setError(null);
    setCancelled(false);
    setSubmitting(true);
    try {
      const { message, report } = await reportsApi.create({
        issue_type: issueType,
        description: description.trim(),
        severity,
        latitude: latitude as number,
        longitude: longitude as number,
        ...(confirm ? { confirm_duplicate: true } : {}),
      });
      setDuplicate(null);
      setSuccess(message);
      // Give the confirmation a moment to be read, then open the report.
      setTimeout(() => {
        navigate({ to: "/report/$id", params: { id: String(report.id) } });
      }, 1200);
    } catch (caught) {
      setSubmitting(false);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong while sending your report. Please try again.",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || checking) return; // no duplicate submissions

    const problem = validate();
    if (problem) {
      setError(problem);
      setSuccess(null);
      return;
    }

    // Ask the backend (PostGIS) whether this looks like an existing problem.
    setError(null);
    setCheckNote(null);
    setCancelled(false);
    setChecking(true);
    try {
      const check = await reportsApi.checkDuplicate({
        latitude: latitude as number,
        longitude: longitude as number,
        issue_type: issueType as IssueType,
        severity,
      });
      setChecking(false);
      if (check.duplicate) {
        setDuplicate(check);
        return; // wait for the citizen to choose
      }
      setDuplicate(null);
    } catch {
      // A failed check must never block a citizen from reporting.
      setChecking(false);
      setCheckNote("We could not check for similar nearby reports, so we sent yours as it is.");
    }

    await submitReport(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">New report</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Report Drainage Issue</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Tell us what is wrong and exactly where it is. City teams use the location to find the
          spot and to see where problems repeat.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Issue type
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType | "")}
                disabled={submitting}
                className={fieldClass}
              >
                <option value="">Select an issue type</option>
                {ISSUE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Severity
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity | "")}
                disabled={submitting}
                className={fieldClass}
              >
                <option value="">Select severity</option>
                {SEVERITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={DESCRIPTION_MAX}
              disabled={submitting}
              placeholder="The drain is blocked and water is collecting on the road."
              className={fieldClass}
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {description.trim().length}/{DESCRIPTION_MAX} characters
            </span>
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Location</legend>
            <LocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={setPoint}
              disabled={submitting}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Latitude
                <input
                  type="text"
                  inputMode="decimal"
                  value={latText}
                  onChange={(e) => onLatText(e.target.value)}
                  disabled={submitting}
                  placeholder="28.6139"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium">
                Longitude
                <input
                  type="text"
                  inputMode="decimal"
                  value={lngText}
                  onChange={(e) => onLngText(e.target.value)}
                  disabled={submitting}
                  placeholder="77.2090"
                  className={fieldClass}
                />
              </label>
            </div>
          </fieldset>

          {checking && (
            <p role="status" className="text-sm text-muted-foreground">
              Checking for similar reports nearby…
            </p>
          )}

          {duplicate && (
            <section
              role="alert"
              aria-labelledby="duplicate-heading"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
            >
              <h2 id="duplicate-heading" className="text-sm font-semibold">
                A similar drainage report already exists nearby.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Someone may have reported this same problem in the last {duplicate.params.days}{" "}
                days, within {Math.round(duplicate.params.radius_m)} m of your location. Check the
                details below before you continue.
              </p>
              <ul className="mt-3 space-y-2">
                {duplicate.matches.map((match: DuplicateMatch) => (
                  <li
                    key={match.id}
                    className="rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">Report #{match.id}</span>
                      <span>{ISSUE_TYPE_LABELS[match.issue_type] ?? match.issue_type}</span>
                      <span className="text-muted-foreground">
                        {STATUS_LABELS[match.status] ?? match.status}
                      </span>
                      <span className="text-muted-foreground">
                        {Math.round(match.distance_m)} m away
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Severity {match.severity.toLowerCase()} ·{" "}
                      {match.created_at ? new Date(match.created_at).toLocaleDateString() : "—"} ·
                      match confidence {Math.round(match.confidence * 100)}%
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => submitReport(true)}
                  disabled={submitting}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Continue Anyway"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicate(null);
                    setCancelled(true);
                  }}
                  disabled={submitting}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {cancelled && (
            <p role="status" className="text-sm text-muted-foreground">
              Your report was not submitted. The existing nearby report already covers this problem
              — change the details or the location if it is a different issue.
            </p>
          )}

          {checkNote && (
            <p role="status" className="text-sm text-muted-foreground">
              {checkNote}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary"
            >
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || checking || Boolean(success) || Boolean(duplicate)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
          >
            {checking ? "Checking…" : submitting ? "Submitting…" : "Submit report"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
