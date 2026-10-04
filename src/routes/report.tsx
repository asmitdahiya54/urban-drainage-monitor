import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, CheckCircle2, ImagePlus, MapPin, RefreshCw, Trash2, FileText } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { LocationPicker } from "@/components/map/LocationPicker";
import { BackendWarning } from "@/components/BackendStatus";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import { isDemoToken } from "@/lib/demoAuth";
import { downscaleImage, saveDemoReport, type DemoReport } from "@/lib/demoReports";
import {
  ApiError,
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
        content: "Submit a community drainage report with a map location, photos and severity.",
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

/** Form categories, mapped onto the backend's existing issue types. */
const CATEGORIES: { value: string; label: string; backend: IssueType }[] = [
  { value: "BLOCKED_DRAIN", label: "Blocked Drain", backend: "BLOCKED_DRAIN" },
  { value: "WATERLOGGING", label: "Waterlogging", backend: "WATERLOGGING" },
  { value: "OVERFLOWING_MANHOLE", label: "Overflowing Manhole", backend: "SEWAGE_OVERFLOW" },
  { value: "DRAIN_DAMAGE", label: "Drain Damage", backend: "DAMAGED_DRAIN" },
  { value: "GARBAGE_BLOCKING", label: "Garbage Blocking Drain", backend: "BLOCKED_DRAIN" },
  { value: "OTHER", label: "Other", backend: "OTHER" },
];

const TITLE_MIN = 5;
const TITLE_MAX = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;
const LANDMARK_MAX = 200;
const MAX_PHOTOS = 3;
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Errors = Partial<
  Record<
    "title" | "category" | "severity" | "description" | "location" | "landmark" | "photos",
    string | undefined
  >
>;

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-destructive";

function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <span id={id} className="mt-1 block text-xs font-medium text-destructive">
      {message}
    </span>
  );
}

function Section({
  step,
  title,
  icon,
  children,
}: {
  step: number;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur sm:p-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-sm font-semibold text-primary">
          {step}
        </span>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          {icon}
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

type Photo = { id: string; dataUrl: string; name: string };

function ReportPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const demoSession = isDemoToken(token);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("MEDIUM");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [landmark, setLandmark] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const replaceIndex = useRef<number | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<DemoReport | null>(null);

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
  function parseCoord(value: string) {
    const n = Number(value);
    return value.trim() !== "" && Number.isFinite(n) ? n : null;
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of list) {
      if (!PHOTO_TYPES.includes(file.type)) problems.push(`${file.name}: use JPG, PNG or WebP.`);
      else if (file.size > MAX_PHOTO_MB * 1024 * 1024)
        problems.push(`${file.name}: larger than ${MAX_PHOTO_MB} MB.`);
      else accepted.push(file);
    }
    const replacing = replaceIndex.current;
    const room = replacing !== null ? 1 : MAX_PHOTOS - photos.length;
    if (accepted.length > room) problems.push(`You can attach up to ${MAX_PHOTOS} photos.`);
    setProcessingPhotos(true);
    try {
      const prepared: Photo[] = [];
      for (const file of accepted.slice(0, Math.max(room, 0))) {
        try {
          prepared.push({
            id: crypto.randomUUID(),
            dataUrl: await downscaleImage(file),
            name: file.name,
          });
        } catch {
          problems.push(`${file.name}: could not be read.`);
        }
      }
      setPhotos((current) => {
        if (replacing !== null && prepared[0]) {
          const copy = [...current];
          copy[replacing] = prepared[0];
          return copy;
        }
        return [...current, ...prepared];
      });
    } finally {
      setProcessingPhotos(false);
      replaceIndex.current = null;
      setErrors((e) => ({ ...e, photos: problems.length ? problems.join(" ") : undefined }));
      if (galleryInput.current) galleryInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  }

  function pick(kind: "gallery" | "camera", index: number | null = null) {
    replaceIndex.current = index;
    (kind === "camera" ? cameraInput : galleryInput).current?.click();
  }

  function validate(): Errors {
    const next: Errors = {};
    const t = title.trim();
    if (t.length < TITLE_MIN)
      next.title = `Give the issue a title (at least ${TITLE_MIN} characters).`;
    else if (t.length > TITLE_MAX) next.title = `Title must be at most ${TITLE_MAX} characters.`;
    if (!category) next.category = "Choose an issue category.";
    if (!severity) next.severity = "Choose how severe the problem is.";
    const d = description.trim();
    if (d.length < DESCRIPTION_MIN)
      next.description = `Describe the problem in at least ${DESCRIPTION_MIN} characters.`;
    else if (d.length > DESCRIPTION_MAX)
      next.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
    if (latitude === null || longitude === null)
      next.location = "Pick the spot on the map, use your location, or enter coordinates.";
    else if (latitude < -90 || latitude > 90)
      next.location = "Latitude must be between -90 and 90.";
    else if (longitude < -180 || longitude > 180)
      next.location = "Longitude must be between -180 and 180.";
    if (landmark.length > LANDMARK_MAX)
      next.landmark = `Landmark must be at most ${LANDMARK_MAX} characters.`;
    return next;
  }

  function backendCategory(): IssueType {
    return CATEGORIES.find((c) => c.value === category)?.backend ?? "OTHER";
  }

  function saveLocally() {
    const report = saveDemoReport({
      title: title.trim(),
      category: CATEGORIES.find((c) => c.value === category)?.label ?? category,
      severity,
      description: description.trim(),
      latitude: latitude as number,
      longitude: longitude as number,
      landmark: landmark.trim(),
      photos: photos.map((p) => p.dataUrl),
      owner_email: user?.email ?? "",
    });
    setDemoResult(report);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitReport(confirm: boolean) {
    setError(null);
    setCancelled(false);
    setSubmitting(true);
    const extra = [landmark.trim() && `Landmark: ${landmark.trim()}`].filter(Boolean).join("\n");
    try {
      const { message, report } = await reportsApi.create({
        issue_type: backendCategory(),
        description: [title.trim(), description.trim(), extra].filter(Boolean).join("\n\n"),
        severity,
        latitude: latitude as number,
        longitude: longitude as number,
        ...(confirm ? { confirm_duplicate: true } : {}),
      });
      setDuplicate(null);
      setSuccess(message);
      setTimeout(() => navigate({ to: "/report/$id", params: { id: String(report.id) } }), 1200);
    } catch (caught) {
      // Server offline: keep the citizen's work as a clearly labelled demo record.
      if (caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)) {
        saveLocally();
        setSubmitting(false);
        return;
      }
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
    if (submitting || checking || processingPhotos) return;
    const nextErrors = validate();
    setErrors((e) => ({ ...nextErrors, photos: e.photos }));
    if (Object.keys(nextErrors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);

    if (demoSession) {
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 600));
      saveLocally();
      setSubmitting(false);
      return;
    }

    setCheckNote(null);
    setCancelled(false);
    setChecking(true);
    try {
      const check = await reportsApi.checkDuplicate({
        latitude: latitude as number,
        longitude: longitude as number,
        issue_type: backendCategory(),
        severity,
      });
      setChecking(false);
      if (check.duplicate) {
        setDuplicate(check);
        return;
      }
      setDuplicate(null);
    } catch {
      setChecking(false);
      setCheckNote("We could not check for similar nearby reports, so we sent yours as it is.");
    }
    await submitReport(false);
  }

  function resetForm() {
    setTitle("");
    setCategory("");
    setSeverity("MEDIUM");
    setDescription("");
    setLatitude(null);
    setLongitude(null);
    setLatText("");
    setLngText("");
    setLandmark("");
    setPhotos([]);
    setErrors({});
    setError(null);
    setDemoResult(null);
    setCheckNote(null);
  }

  if (demoResult) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
          <DemoSuccess report={demoResult} onAnother={resetForm} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const busy = submitting || checking;

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
        {!demoSession && (
          <BackendWarning demoNote="Reports you submit now will be saved only in this browser as clearly labelled demo records, not on the server." />
        )}
        {demoSession && (
          <p className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">Demo mode:</span> reports from demo
            accounts are saved only in this browser and are not sent to the city.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
          <Section
            step={1}
            title="Issue information"
            icon={<FileText className="size-5 text-primary" />}
          >
            <div className="space-y-5">
              <label className="block text-sm font-medium">
                Issue title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={TITLE_MAX}
                  disabled={busy}
                  placeholder="Blocked drain outside the market gate"
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby="title-error"
                  className={fieldClass}
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {title.trim().length}/{TITLE_MAX}
                </span>
                <FieldError id="title-error" message={errors.title} />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={busy}
                    aria-invalid={Boolean(errors.category)}
                    aria-describedby="category-error"
                    className={fieldClass}
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <FieldError id="category-error" message={errors.category} />
                </label>
                <div className="text-sm font-medium">
                  Severity
                  <div
                    className="mt-1.5 grid grid-cols-4 gap-2"
                    role="radiogroup"
                    aria-label="Severity"
                  >
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={severity === s.value}
                        onClick={() => setSeverity(s.value)}
                        disabled={busy}
                        className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${
                          severity === s.value
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <FieldError id="severity-error" message={errors.severity} />
                </div>
              </div>
              <label className="block text-sm font-medium">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={DESCRIPTION_MAX}
                  disabled={busy}
                  placeholder="The drain is blocked and water is collecting on the road."
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby="description-error"
                  className={fieldClass}
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {description.trim().length}/{DESCRIPTION_MAX} characters (minimum{" "}
                  {DESCRIPTION_MIN})
                </span>
                <FieldError id="description-error" message={errors.description} />
              </label>
            </div>
          </Section>

          <Section step={2} title="Location" icon={<MapPin className="size-5 text-primary" />}>
            <div className="space-y-4">
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                onChange={setPoint}
                disabled={busy}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Latitude
                  <input
                    inputMode="decimal"
                    value={latText}
                    onChange={(e) => {
                      setLatText(e.target.value);
                      setLatitude(parseCoord(e.target.value));
                    }}
                    disabled={busy}
                    placeholder="e.g. 28.6139"
                    aria-invalid={Boolean(errors.location)}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Longitude
                  <input
                    inputMode="decimal"
                    value={lngText}
                    onChange={(e) => {
                      setLngText(e.target.value);
                      setLongitude(parseCoord(e.target.value));
                    }}
                    disabled={busy}
                    placeholder="e.g. 77.2090"
                    aria-invalid={Boolean(errors.location)}
                    className={fieldClass}
                  />
                </label>
              </div>
              <FieldError id="location-error" message={errors.location} />
              <label className="block text-sm font-medium">
                Landmark or address{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
                <input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  maxLength={LANDMARK_MAX}
                  disabled={busy}
                  placeholder="Near the bus stop on Ring Road"
                  aria-invalid={Boolean(errors.landmark)}
                  className={fieldClass}
                />
                <FieldError id="landmark-error" message={errors.landmark} />
              </label>
            </div>
          </Section>

          <Section
            step={3}
            title="Photos (optional)"
            icon={<Camera className="size-5 text-primary" />}
          >
            <p className="text-xs text-muted-foreground">
              Up to {MAX_PHOTOS} photos · JPG, PNG or WebP · max {MAX_PHOTO_MB} MB each. Photos stay
              on this device in demo mode and are not uploaded.
            </p>
            <input
              ref={galleryInput}
              type="file"
              accept={PHOTO_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => pick("camera")}
                disabled={busy || processingPhotos || photos.length >= MAX_PHOTOS}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50"
              >
                <Camera className="size-4" /> Take photo
              </button>
              <button
                type="button"
                onClick={() => pick("gallery")}
                disabled={busy || processingPhotos || photos.length >= MAX_PHOTOS}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50"
              >
                <ImagePlus className="size-4" /> Choose from device
              </button>
            </div>
            {processingPhotos && (
              <p className="mt-3 text-xs text-muted-foreground">Preparing photos…</p>
            )}
            <FieldError id="photos-error" message={errors.photos} />
            {photos.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No photos selected yet.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <li
                    key={p.id}
                    className="overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <img
                      src={p.dataUrl}
                      alt={`Selected photo ${i + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="flex justify-between gap-1 p-1.5">
                      <button
                        type="button"
                        onClick={() => pick("camera", i)}
                        aria-label={`Retake photo ${i + 1}`}
                        className="rounded p-1.5 hover:bg-secondary"
                      >
                        <Camera className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => pick("gallery", i)}
                        aria-label={`Replace photo ${i + 1}`}
                        className="rounded p-1.5 hover:bg-secondary"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotos((c) => c.filter((x) => x.id !== p.id))}
                        aria-label={`Remove photo ${i + 1}`}
                        className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!demoSession && photos.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Photo upload to the city server isn't available yet; photos are kept only with demo
                records.
              </p>
            )}
          </Section>

          {checking && (
            <p role="status" className="text-sm text-muted-foreground">
              Checking for similar reports nearby…
            </p>
          )}

          {duplicate && (
            <section
              role="alert"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
            >
              <h2 className="text-sm font-semibold">
                A similar drainage report already exists nearby.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Someone may have reported this same problem in the last {duplicate.params.days}{" "}
                days, within {Math.round(duplicate.params.radius_m)} m of your location.
              </p>
              <ul className="mt-3 space-y-2">
                {duplicate.matches.map((match: DuplicateMatch) => (
                  <li
                    key={match.id}
                    className="rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <span className="font-semibold">Report #{match.id}</span> ·{" "}
                    {ISSUE_TYPE_LABELS[match.issue_type] ?? match.issue_type} ·{" "}
                    {STATUS_LABELS[match.status] ?? match.status} · {Math.round(match.distance_m)} m
                    away
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
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {cancelled && (
            <p role="status" className="text-sm text-muted-foreground">
              Your report was not submitted. Change the details or location if it is a different
              issue.
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
            disabled={busy || processingPhotos || Boolean(success) || Boolean(duplicate)}
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

function DemoSuccess({ report, onAnother }: { report: DemoReport; onAnother: () => void }) {
  return (
    <div className="rounded-2xl border border-primary/40 bg-card/80 p-6 shadow-sm backdrop-blur sm:p-8">
      <CheckCircle2 className="size-12 text-primary drop-shadow-[0_0_10px_var(--color-primary)]" />
      <span className="mt-4 inline-block rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
        DEMO RECORD — saved in this browser only, not sent to the city
      </span>
      <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Report saved</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reference{" "}
        <span className="font-mono font-semibold text-foreground">{report.reference}</span>
      </p>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Title</dt>
          <dd className="font-semibold">{report.title}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Category</dt>
          <dd>{report.category}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Severity</dt>
          <dd>{report.severity.charAt(0) + report.severity.slice(1).toLowerCase()}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Location</dt>
          <dd>
            {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
            {report.landmark && ` · ${report.landmark}`}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Description</dt>
          <dd className="whitespace-pre-line">{report.description}</dd>
        </div>
      </dl>
      {report.photos.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-3">
          {report.photos.map((src, i) => (
            <li key={i}>
              <img
                src={src}
                alt={`Report photo ${i + 1}`}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onAnother}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Report another issue
        </button>
        <Link
          to="/dashboard"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
