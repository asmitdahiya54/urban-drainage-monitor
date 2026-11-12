import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import { communityApi, type CommunityNotification } from "@/services/api";
export const Route = createFileRoute("/community_/notifications")({ component: NotificationsPage });
function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const [rows, setRows] = useState<CommunityNotification[]>([]);
  const [category, setCategory] = useState("ALL");

  const filteredRows = rows.filter((n) => {
    if (category === "ALL") return true;

    if (category === "PROPOSALS") {
      return n.type.startsWith("PROPOSAL_");
    }

    if (category === "VOLUNTEERS") {
      return n.type.startsWith("VOLUNTEER_");
    }

    if (category === "ACTIVITY") {
      return n.type.startsWith("EVENT_") || n.type === "ORGANIZER_UPDATE";
    }

    return true;
  });
async function load(){try{setRows((await communityApi.notifications()).notifications)}catch(e){toast.error(e instanceof Error?e.message:"Could not load notifications")}}useEffect(() => {
  if (!isAuthenticated) return;

  void load();

  const timer = window.setInterval(() => {
    void load();
  }, 30000);

  return () => window.clearInterval(timer);
}, [isAuthenticated]);async function mark(id:number){try{await communityApi.markRead(id);await load()}catch(e){toast.error(e instanceof Error?e.message:"Update failed")}}async function all(){try{await communityApi.markAllRead();await load()}catch(e){toast.error(e instanceof Error?e.message:"Update failed")}}return <div className="min-h-screen bg-background"><SiteNav/><main className="mx-auto max-w-3xl space-y-5 px-4 py-10"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-1 text-sm text-muted-foreground">Private updates about your community activities.</p></div><div className="flex items-center gap-3">
  <button
    onClick={() => void load()}
    className="whitespace-nowrap text-sm font-semibold text-primary"
  >
    Refresh
  </button>

  <button
    onClick={() => void all()}
    className="whitespace-nowrap text-sm font-semibold text-primary"
  >
    Mark all read
  </button>
</div></div>
<div className="flex flex-wrap gap-2">
  {[
    ["ALL", "All"],
    ["PROPOSALS", "Proposals"],
    ["VOLUNTEERS", "Volunteers"],
    ["ACTIVITY", "Activity updates"],
  ].map(([value, label]) => (
    <button
      key={value}
      onClick={() => setCategory(value ?? "ALL")}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        category === value
          ? "bg-primary text-primary-foreground"
          : "border border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  ))}
</div>
{!isAuthenticated?<p>Sign in to view notifications.</p>:filteredRows.length ? filteredRows.map(n =><article key={n.id} className={`rounded-xl border border-border p-4 ${n.read_at?"bg-card":"bg-primary/5"}`}><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
  {n.type.replaceAll("_", " ")}
</p><div className="flex items-start justify-between gap-3"><p className="text-sm">{n.message}</p>{!n.read_at&&<button onClick={()=>void mark(n.id)} className="shrink-0 text-xs font-semibold text-primary">Mark read</button>}</div><p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>{n.event_id&&<Link to="/community/$eventId" params={{eventId:String(n.event_id)}} className="mt-2 inline-block text-xs font-semibold text-primary">Open activity →</Link>}</article>):<p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{category === "ALL"
  ? "You're all caught up."
  : category === "VOLUNTEERS"
  ? "No volunteer notifications yet."
  : category === "PROPOSALS"
    ? "No proposal notifications yet."
    : "No activity updates yet."}</p>}</main></div>}
