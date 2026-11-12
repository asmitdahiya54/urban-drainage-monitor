import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera, Upload, Image as ImageIcon } from "lucide-react";
import { CalendarDays, MapPin, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { LazyMap } from "@/components/map/LazyMap";
import { communityApi, type CommunityEvent } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
export const Route = createFileRoute("/community_/$eventId")({ component: EventPage });
function EventPage() {
  const { eventId } = Route.useParams(); const id = Number(eventId); const { isAuthenticated, user } = useAuth();
  const [event, setEvent] = useState<(CommunityEvent & { updates: {id:number;message:string;created_at:string}[] }) | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
const [publishing, setPublishing] = useState(false);
const [uploading, setUploading] = useState(false);

async function handlePhotoUpload(
  photoType: "BEFORE" | "AFTER",
  files: FileList | null,
) {
  if (!files || files.length === 0) return;

  const selectedFiles = Array.from(files);

  if (selectedFiles.length > 5) {
    toast.error("You can upload a maximum of 5 photos at once.");
    return;
  }

  const validTypes = ["image/jpeg", "image/png", "image/webp"];

  if (selectedFiles.some((file) => !validTypes.includes(file.type))) {
    toast.error("Only JPG, PNG and WebP images are allowed.");
    return;
  }

  if (selectedFiles.some((file) => file.size > 5 * 1024 * 1024)) {
    toast.error("Each photo must be smaller than 5 MB.");
    return;
  }

  setUploading(true);

  try {
    let location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    } | null = null;

    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          },
        );

        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      } catch {
        toast.info("GPS unavailable. Photos will upload without location.");
      }
    }

    const result = await communityApi.uploadPhotos(
      id,
      photoType,
      selectedFiles,
      location,
    );

    toast.success(result.message);

    const refreshed = await communityApi.event(id);
    setEvent(refreshed.event);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Photo upload failed.");
  } finally {
    setUploading(false);
  }
}

  
const canPublish = Boolean(
  user && event && (user.role === "admin" || user.id === event.organizer?.id)
);
  useEffect(() => { communityApi.event(id).then(r => setEvent(r.event)).catch(e => toast.error(e.message)); }, [id]);
  async function join() {
  if (!isAuthenticated) {
    toast.error("Please sign in to volunteer.");
    return;
  }

  try {
    toast.success((await communityApi.join(id)).message);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not join");
  }
}

async function publish() {
  if (!updateMessage.trim()) {
    toast.error("Please enter an update.");
    return;
  }

  setPublishing(true);

  try {
    await communityApi.publishUpdate(id, updateMessage.trim());
    toast.success("Update published successfully!");
    setUpdateMessage("");

    const result = await communityApi.event(id);
    setEvent(result.event);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not publish update");
  } finally {
    setPublishing(false);
  }
}

  
  if (!event) return <div className="min-h-screen bg-background"><SiteNav /><p className="p-12 text-center text-muted-foreground">Loading activity…</p></div>;
  return <div className="min-h-screen bg-background"><SiteNav /><main className="mx-auto max-w-4xl space-y-6 px-4 py-10"><Link to="/community" className="text-sm font-semibold text-primary">← Community Action Hub</Link><div className="rounded-2xl border border-border bg-card p-6"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">{event.status}</span><h1 className="mt-4 text-3xl font-bold">{event.title}</h1><p className="mt-3 text-muted-foreground">{event.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><p className="flex gap-2 text-sm"><MapPin className="size-4 text-primary" />{event.location_name}</p><p className="flex gap-2 text-sm"><CalendarDays className="size-4 text-primary" />{new Date(event.starts_at).toLocaleString()}</p><p className="flex gap-2 text-sm"><Users className="size-4 text-primary" />{event.volunteer_count} / {event.capacity} volunteers</p><p className="text-sm">Organizer: {event.organizer?.name ?? "Community organizer"}</p></div><div className="mt-6 h-72 overflow-hidden rounded-xl"><LazyMap latitude={event.latitude} longitude={event.longitude} label={event.location_name} /></div><div className="mt-6 rounded-xl bg-secondary/50 p-4"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Safety instructions</h2><p className="mt-2 text-sm text-muted-foreground">{event.safety_instructions}</p></div><button onClick={() => void join()} disabled={event.remaining_spaces <= 0} className="mt-6 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">Join as Volunteer</button></div>{(canPublish || (user && event.organizer?.id === user.id)) && (
  <section className="rounded-2xl border border-border bg-card p-6">
    <h2 className="text-xl font-bold flex items-center gap-2">
      <Camera className="size-5" />
      Activity Photos
    </h2>

    <p className="mt-2 text-sm text-muted-foreground">
      Upload photos showing the location before and after the community activity.
    </p>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="cursor-pointer rounded-xl border border-dashed border-border p-5 text-center hover:bg-secondary/50">
        <Upload className="mx-auto size-7 text-primary" />
        <span className="mt-2 block font-semibold">Upload BEFORE Photos</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          Show the original condition
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || !["PENDING", "APPROVED"].includes(event.status)}
          className="mt-3 block w-full text-xs"
          onChange={(e) => {
            void handlePhotoUpload("BEFORE", e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </label>

      <label className="cursor-pointer rounded-xl border border-dashed border-border p-5 text-center hover:bg-secondary/50">
        <Upload className="mx-auto size-7 text-primary" />
        <span className="mt-2 block font-semibold">Upload AFTER Photos</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          Show the completed work
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || !["APPROVED", "COMPLETED"].includes(event.status)}
          className="mt-3 block w-full text-xs"
          onChange={(e) => {
            void handlePhotoUpload("AFTER", e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>

    {uploading && (
      <p className="mt-3 text-sm text-primary">Uploading photos...</p>
    )}
  </section>
)}{canPublish && (
  <section className="rounded-2xl border border-border bg-card p-6">
    <h2 className="text-xl font-bold">Publish an Organizer Update</h2>

    <textarea
      value={updateMessage}
      onChange={(e) => setUpdateMessage(e.target.value)}
      placeholder="Write an update for registered volunteers..."
      maxLength={1000}
      rows={4}
      className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm"
    />

    <button
      onClick={() => void publish()}
      disabled={publishing || !updateMessage.trim()}
      className="mt-3 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
    >
      {publishing ? "Publishing..." : "Publish Update"}
    </button>
  </section>
)}
<section className="rounded-2xl border border-border bg-card p-6">
  <h2 className="flex items-center gap-2 text-xl font-bold">
    <ImageIcon className="size-5" />
    Before & After Gallery
  </h2>

  {(["BEFORE", "AFTER"] as const).map((type) => {
    const photos = (event.photos ?? []).filter(
      (photo) => photo.photo_type === type,
    );

    return (
      <div key={type} className="mt-6">
        <h3 className="mb-3 font-semibold">
          {type === "BEFORE" ? "Before the activity" : "After the activity"}
        </h3>

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {type.toLowerCase()} photos uploaded yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <a
                key={photo.id}
                href={photo.photo_url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={photo.photo_url}
                  alt={`${type} activity evidence`}
                  loading="lazy"
                  className="h-40 w-full object-cover transition-transform hover:scale-105"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  })}
</section>
<section className="rounded-2xl border border-border bg-card p-6">
  <h2 className="text-xl font-bold">Organizer updates</h2>{event.updates.length ? event.updates.map(u => <div key={u.id} className="border-b border-border py-3 last:border-0"><p>{u.message}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</p></div>) : <p className="mt-3 text-sm text-muted-foreground">No updates have been published.</p>}</section><p className="text-xs text-muted-foreground">Meeting location and time are provided by the organizer. Follow the approved safety instructions. Volunteers must not enter drains, handle sewage or perform hazardous repairs.</p></main></div>;
}
