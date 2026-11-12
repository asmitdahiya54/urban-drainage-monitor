import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { useAuth } from "@/context/AuthContext";
import { communityApi, type CommunityEvent } from "@/services/api";
export const Route = createFileRoute("/community/my-events")({ component: MyEvents });
function MyEvents() {
 const {isAuthenticated}=useAuth(); const [proposed,setProposed]=useState<CommunityEvent[]>([]); const [joined,setJoined]=useState<CommunityEvent[]>([]);
 useEffect(()=>{ if(isAuthenticated) communityApi.myEvents().then(r=>{setProposed(r.proposed);setJoined(r.joined)}).catch(e=>toast.error(e.message)); },[isAuthenticated]);
 const list=(title:string,items:CommunityEvent[],own=false)=><section className="space-y-3"><h2 className="text-xl font-bold">{title}</h2>{items.length?items.map(e=><article key={e.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{e.title}</h3><span className="text-xs font-semibold text-primary">{e.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{e.location_name} · {new Date(e.starts_at).toLocaleString()}</p>{own&&e.status==="REJECTED"&&e.review_note&&<p className="mt-2 text-sm text-destructive">Review reason: {e.review_note}</p>}<p className="mt-2 text-xs text-muted-foreground">{e.volunteer_count}/{e.capacity} volunteers</p></article>):<p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No activities to show yet.</p>}</section>;
 return <div className="min-h-screen bg-background"><SiteNav/><main className="mx-auto max-w-4xl space-y-8 px-4 py-10"><div><h1 className="text-3xl font-bold">My Activities</h1><p className="mt-2 text-muted-foreground">Track the activities you proposed and joined.</p></div>{!isAuthenticated?<p>Please <Link to="/login" className="text-primary">sign in</Link> to view your activities.</p>:<>{list("Activities I proposed",proposed,true)}{list("Activities I joined",joined)}</>}</main></div>;
}
