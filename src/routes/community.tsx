import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, MapPin, Users, HeartHandshake, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { LocationPicker } from "@/components/map/LocationPicker";
import { useAuth } from "@/context/AuthContext";
import { communityApi, type CommunityEvent, type CommunityStats } from "@/services/api";

export const Route = createFileRoute("/community")({ component: CommunityPage });
const categories = [
  ["DRAINAGE_AWARENESS", "Drainage awareness"], ["SAFE_PUBLIC_CLEANUP", "Safe public-area cleanup"],
  ["WATERLOGGING_ASSISTANCE", "Waterlogging assistance"], ["COMMUNITY_REPORTING", "Community reporting"],
  ["ENVIRONMENTAL_AWARENESS", "Environmental awareness"], ["OTHER", "Other"],
];
const emptyStats: CommunityStats = { approved_activities: 0, upcoming_activities: 0, volunteer_registrations: 0, completed_activities: 0, unique_volunteers: 0 };
function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<"APPROVED" | "COMPLETED">("APPROVED");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [point, setPoint] = useState<[number, number] | null>(null);
  async function load() {
    setLoading(true);
    try { const [e, s] = await Promise.all([communityApi.events(category || undefined, statusFilter), communityApi.stats()]); setEvents(e.events); setStats(s); if (isAuthenticated) { const mine = await communityApi.myEvents(); setJoinedIds(mine.joined.map(item => item.id)); } }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load community activities"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [category, statusFilter, isAuthenticated]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!point) { toast.error("Choose the meeting point on the map first."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    try {
      const starts = new Date(String(form.get("starts_at")));
      const endsRaw = String(form.get("ends_at") || "");
      await communityApi.propose({
        title: String(form.get("title")), description: String(form.get("description")),
        category: String(form.get("category")), location_name: String(form.get("location_name")),
        latitude: point[0], longitude: point[1], starts_at: starts.toISOString(),
        ...(endsRaw ? { ends_at: new Date(endsRaw).toISOString() } : {}),
        capacity: Number(form.get("capacity")), safety_instructions: String(form.get("safety_instructions")),
        ...(form.get("registration_deadline") ? { registration_deadline: new Date(String(form.get("registration_deadline"))).toISOString() } : {}),
      });
      toast.success("Proposal submitted for administrator approval."); setShowForm(false); formElement.reset(); setPoint(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit proposal"); }
    finally { setSaving(false); }
  }
  async function join(id: number) {
    if (!isAuthenticated) { void navigate({ to: "/login" }); return; }
    try { const result = await communityApi.join(id); toast.success(result.message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not join activity"); }
  }
  async function leave(id: number) { try { const result = await communityApi.leave(id); toast.success(result.message); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not leave activity"); } }
  return <div className="min-h-screen bg-background"><SiteNav />
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-7 sm:p-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><HeartHandshake className="size-4" /> COMMUNITY ACTION HUB</span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">Report It. Organize Help. <span className="text-primary">Make a Difference.</span></h1>
            <p className="mt-4 text-muted-foreground">Discover safe local activities, volunteer with your community and help make drainage concerns visible. Every activity is reviewed before it is published.</p>
          </div>
          <button onClick={() => isAuthenticated ? setShowForm(v => !v) : void navigate({ to: "/login" })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"><Plus className="size-4" /> Propose an Activity</button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Approved activities", stats.approved_activities], ["Upcoming activities", stats.upcoming_activities], ["Volunteer registrations", stats.volunteer_registrations], ["Completed activities", stats.completed_activities]].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">Live database total</p></div>)}
      </section>
      {showForm && <section className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-bold">Propose a community activity</h2><p className="mt-1 text-sm text-muted-foreground">Your proposal remains private until an administrator approves it.</p></div>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Activity title<input name="title" required minLength={5} maxLength={120} className="w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="e.g. Drainage awareness near college" /></label>
          <label className="space-y-1 text-sm font-medium">Category<select name="category" required className="w-full rounded-lg border border-input bg-background px-3 py-2">{categories.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Description<textarea name="description" required minLength={20} maxLength={3000} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">Meeting location<input name="location_name" required maxLength={200} className="w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="College main gate, Sohna" /></label>
          <label className="space-y-1 text-sm font-medium">Maximum volunteers<input name="capacity" type="number" min={1} max={500} defaultValue={10} required className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">Start date and time<input name="starts_at" type="datetime-local" required min={new Date(Date.now()+3600000).toISOString().slice(0,16)} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">End date and time (optional)<input name="ends_at" type="datetime-local" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">Registration deadline (optional)<input name="registration_deadline" type="datetime-local" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Safety instructions<textarea name="safety_instructions" required minLength={10} maxLength={1500} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2" defaultValue="Stay in public, authorized areas. Do not enter drains, touch sewage, or attempt repairs. Report hazards to municipal authorities." /></label>
          <div className="space-y-2 md:col-span-2"><p className="text-sm font-medium">Choose the meeting point on the map</p><LocationPicker latitude={point?.[0] ?? null} longitude={point?.[1] ?? null} onChange={(lat, lon) => setPoint([lat, lon])} /></div>
          <div className="flex flex-wrap gap-3 md:col-span-2"><button disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Submitting…" : "Submit for approval"}</button><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-5 py-2.5">Cancel</button></div>
        </form>
      </section>}
      <section className="space-y-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-bold">Volunteer opportunities</h2><p className="mt-1 text-sm text-muted-foreground">Administrator-approved activities open for participation.</p></div><div className="flex flex-wrap gap-2"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as "APPROVED" | "COMPLETED")} className="rounded-lg border border-input bg-card px-3 py-2 text-sm"><option value="APPROVED">Upcoming activities</option><option value="COMPLETED">Completed activities</option></select><select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-sm"><option value="">All categories</option>{categories.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
        {loading ? <p className="py-12 text-center text-muted-foreground">Loading approved activities…</p> : events.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-12 text-center"><Users className="mx-auto size-10 text-muted-foreground" /><h3 className="mt-3 font-semibold">No approved activities yet</h3><p className="mt-1 text-sm text-muted-foreground">Be the first to propose a safe community activity.</p></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{events.map(event => <article key={event.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">{event.status}</span><span className="text-xs text-muted-foreground">{categories.find(([v]) => v === event.category)?.[1] ?? event.category}</span></div><h3 className="mt-4 text-lg font-bold">{event.title}</h3><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{event.description}</p><div className="mt-4 space-y-2 text-sm"><p className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{event.location_name}</p><p className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />{new Date(event.starts_at).toLocaleString()}</p><p className="flex items-center gap-2"><Users className="size-4 text-primary" />{event.volunteer_count}/{event.capacity} volunteers · {event.remaining_spaces} spaces left</p></div><div className="mt-auto flex gap-2 pt-5"><Link to="/community/$eventId" params={{ eventId: String(event.id) }} className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold hover:bg-secondary">View details</Link>{event.status === "APPROVED" && (joinedIds.includes(event.id) ? <button onClick={() => void leave(event.id)} className="flex-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary">Leave Event</button> : <button onClick={() => void join(event.id)} disabled={event.remaining_spaces <= 0} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Join as Volunteer</button>)}</div></article>)}</div>}
      </section>
      <section className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><h3 className="font-semibold">Volunteer safety comes first</h3><p className="mt-1 text-sm text-muted-foreground">Activities are for safe, authorized community participation only. Never enter drains, handle sewage, remove hazardous waste or attempt infrastructure repairs. Refer dangerous conditions and repair work to authorized municipal personnel.</p></div></section>
    </main>
  </div>;
}
