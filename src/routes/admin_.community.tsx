import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { LazyMap } from "@/components/map/LazyMap";
import { useAuth } from "@/context/AuthContext";
import { communityApi, type CommunityEvent } from "@/services/api";

export const Route = createFileRoute("/admin_/community")({ component: AdminCommunity });
type Volunteer = { user_id: number; name: string; joined_at: string; attendance_status: string };

function AdminCommunity() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<CommunityEvent[]>([]);
  const [summary, setSummary] = useState({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  completed: 0,
  cancelled: 0,
});
const [filter, setFilter] = useState("ALL");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [rosters, setRosters] = useState<Record<number, Volunteer[]>>({});
  const [attendance, setAttendance] = useState<Record<number, Record<number, "ATTENDED" | "ABSENT">>>({});
  async function load() {
  try {
    const statuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "COMPLETED",
      "CANCELLED",
    ];

    const results = await Promise.all(
      statuses.map(status => communityApi.adminEvents(status))
    );

    const all = results.flatMap(result => result.events);

    const detailed = await Promise.all(
      all.map(async event => {
        try {
          const result = await communityApi.event(event.id);
          return result.event;
        } catch {
          return event;
        }
      })
    );

    setItems(
      filter === "ALL"
        ? detailed
        : detailed.filter(event => event.status === filter)
    );

    setSummary({
      total: all.length,
      pending: all.filter(e => e.status === "PENDING").length,
      approved: all.filter(e => e.status === "APPROVED").length,
      rejected: all.filter(e => e.status === "REJECTED").length,
      completed: all.filter(e => e.status === "COMPLETED").length,
      cancelled: all.filter(e => e.status === "CANCELLED").length,
    });
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Could not load activities"
    );
  }



}
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, filter]);
  async function review(id: number, status: "APPROVED" | "REJECTED") {
    try { await communityApi.review(id, status, notes[id] ?? ""); toast.success(`Proposal ${status.toLowerCase()}.`); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Review failed"); }
  }
  async function setStatus(id: number, status: "CANCELLED" | "COMPLETED") {
    try { await communityApi.setStatus(id, status); toast.success("Activity updated."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Update failed"); }
  }
  async function handleAdminPhotoUpload(
  eventId: number,
  photoType: "BEFORE" | "AFTER",
  files: FileList | null,
) {
  if (!files || files.length === 0) return;

  try {
    await communityApi.uploadPhotos(
      eventId,
      photoType,
      Array.from(files).slice(0, 5),
      null,
    );

    toast.success(`${photoType} photos uploaded successfully.`);
    await load();
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Photo upload failed",
    );
  }
}
  async function loadRoster(id: number) {
    try { const result = await communityApi.volunteers(id); setRosters(v => ({ ...v, [id]: result.volunteers })); setAttendance(v => ({ ...v, [id]: Object.fromEntries(result.volunteers.map(person => [person.user_id, person.attendance_status === "ATTENDED" ? "ATTENDED" : "ABSENT"])) as Record<number, "ATTENDED" | "ABSENT"> })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load volunteers"); }
  }
  async function saveAttendance(id: number) {
    try { await communityApi.attendance(id, Object.entries(attendance[id] ?? {}).map(([user_id, status]) => ({ user_id: Number(user_id), status }))); toast.success("Attendance records saved."); await loadRoster(id); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save attendance"); }
  }
  return <div className="min-h-screen bg-background"><SiteNav /><main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
<div className="flex flex-wrap items-center justify-between gap-4">
  <div>
    <h1 className="text-3xl font-bold">Community Activity Management</h1>
    <p className="mt-2 text-muted-foreground">
      Review citizen proposals, manage approved activities and verify attendance.
    </p>
  </div>

  <Link
    to="/community"
    className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
  >
    + Propose Activity
  </Link>
</div>
    {!isAdmin ? <p className="rounded-xl border border-destructive/30 p-5 text-destructive">Administrator access is required.</p> : <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
  {[
    ["Total", summary.total],
    ["Pending", summary.pending],
    ["Approved", summary.approved],
    ["Rejected", summary.rejected],
    ["Completed", summary.completed],
    ["Cancelled", summary.cancelled],
  ].map(([label, count]) => (
    <div key={label} className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{count}</p>
    </div>
  ))}
</div>
      <select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-lg border border-input bg-card px-3 py-2">
  <option value="ALL">ALL ACTIVITIES</option>
  <option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option>
<option value="REJECTED">REJECTED</option>
<option value="CANCELLED">CANCELLED</option>
<option value="COMPLETED">COMPLETED</option></select>
      {items.length ? items.map(event => <article key={event.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{event.title}</h2><span className="text-xs font-semibold text-primary">{event.status}</span></div>
        <p className="text-sm text-muted-foreground">Proposed by {event.organizer?.name ?? `user #${event.created_by}`} · {event.location_name} · {new Date(event.starts_at).toLocaleString()}</p>
        <p className="text-sm">{event.description}</p><p className="text-sm"><strong>Safety:</strong> {event.safety_instructions}</p>
        <div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <h3 className="font-semibold">BEFORE Photos</h3>
    {event.photos?.filter(photo => photo.photo_type === "BEFORE").length ? (
      <div className="grid grid-cols-2 gap-2">
        {event.photos
          .filter(photo => photo.photo_type === "BEFORE")
          .map(photo => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt="Before activity"
              className="h-40 w-full rounded-lg object-cover"
            />
          ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No BEFORE photos uploaded.</p>
    )}
  </div>

  <div className="space-y-2">
    <h3 className="font-semibold">AFTER Photos</h3>
    {event.photos?.filter(photo => photo.photo_type === "AFTER").length ? (
      <div className="grid grid-cols-2 gap-2">
        {event.photos
          .filter(photo => photo.photo_type === "AFTER")
          .map(photo => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt="After activity"
              className="h-40 w-full rounded-lg object-cover"
            />
          ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No AFTER photos uploaded.</p>
    )}
  </div>
</div>
<div className="grid gap-3 md:grid-cols-2">
  {(event.status === "PENDING" || event.status === "APPROVED") && (
    <label className="cursor-pointer rounded-lg border border-border p-3 text-center text-sm font-semibold hover:bg-secondary">
      + Upload BEFORE Photos
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e =>
          void handleAdminPhotoUpload(event.id, "BEFORE", e.target.files)
        }
      />
    </label>
  )}

  {(event.status === "APPROVED" || event.status === "COMPLETED") && (
    <label className="cursor-pointer rounded-lg border border-border p-3 text-center text-sm font-semibold hover:bg-secondary">
      + Upload AFTER Photos
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e =>
          void handleAdminPhotoUpload(event.id, "AFTER", e.target.files)
        }
      />
    </label>
  )}
</div>
        <p className="text-xs text-muted-foreground">{event.volunteer_count}/{event.capacity} registrations · {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</p>
        <div className="h-52 overflow-hidden rounded-xl"><LazyMap latitude={event.latitude} longitude={event.longitude} label={event.location_name} /></div>
        {event.status === "PENDING" ? <><textarea value={notes[event.id] ?? ""} onChange={e => setNotes(v => ({ ...v, [event.id]: e.target.value }))} placeholder="Optional review note / rejection reason" className="w-full rounded-lg border border-input bg-background p-3 text-sm" /><div className="flex gap-2"><button onClick={() => void review(event.id, "APPROVED")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Approve</button><button onClick={() => void review(event.id, "REJECTED")} className="rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive">Reject</button></div></> : null}
        {event.status === "APPROVED" ? <div className="flex flex-wrap gap-2"><button onClick={() => void loadRoster(event.id)} className="rounded-lg border border-border px-4 py-2 text-sm">View volunteers</button><button onClick={() => void setStatus(event.id, "COMPLETED")} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Mark completed</button><button onClick={() => void setStatus(event.id, "CANCELLED")} className="rounded-lg border border-destructive px-4 py-2 text-sm text-destructive">Cancel activity</button></div> : null}
        {event.status === "COMPLETED" ? <button onClick={() => void loadRoster(event.id)} className="rounded-lg border border-border px-4 py-2 text-sm">Verify attendance</button> : null}
        {rosters[event.id] ? <div className="space-y-3 rounded-xl bg-secondary/40 p-4"><h3 className="font-semibold">Registered volunteers ({rosters[event.id]!.length})</h3>{rosters[event.id]!.map(person => <div key={person.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{person.name} · joined {new Date(person.joined_at).toLocaleDateString()}</span>{ event.status === "COMPLETED" ?  <select value={attendance[event.id]?.[person.user_id] ?? "ABSENT"} onChange={e => setAttendance(v => ({ ...v, [event.id]: { ...v[event.id], [person.user_id]: e.target.value as "ATTENDED" | "ABSENT" } }))} className="rounded border border-input bg-background px-2 py-1"><option value="ATTENDED">Attended</option><option value="ABSENT">Absent</option></select> : <span className="text-xs text-muted-foreground">{person.attendance_status}</span>}</div>)}{event.status === "COMPLETED" ? <button onClick={() => void saveAttendance(event.id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save verified attendance</button> : null}</div> : null}
      </article>) : <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No {filter.toLowerCase()} activities.</p>}
    </>}
  </main></div>;
}
