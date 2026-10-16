import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
export default function VisitorStats() {
 const [counts,setCounts]=useState<{total:number;live:number;at:string}|null>(null);
 const [error,setError]=useState(false);
 const enabled=import.meta.env.VITE_VISITOR_STATS_ENABLED === "true";
 useEffect(() => {
  if(!enabled)return;
  let active=true,busy=false;
  async function refresh(){
   if(busy || document.visibilityState!=="visible")return;
   busy=true;
   try {
    const c=collection(db,"visitorPresence");
    const [total,live]=await Promise.all([getCountFromServer(c),getCountFromServer(query(c,where("lastSeen",">=",Timestamp.fromMillis(Date.now()-120000))))]);
    if(active){setCounts({total:total.data().count,live:live.data().count,at:new Date().toLocaleTimeString()});setError(false);}
   }catch{if(active)setError(true);}finally{busy=false;}
  }
  void refresh();const timer=setInterval(refresh,60000);
  document.addEventListener("visibilitychange",refresh);
  return()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
 },[enabled]);
 return <section className="panel mb-6" aria-label="Website visitors"><h2 className="section-heading">Website visitors</h2>{!enabled ? <p className="muted">Visitor tracking is not enabled yet. Complete the Firebase setup in the deployment guide.</p> : <><div className="metric-grid mt-4"><div className="metric"><p>Total tracked visits</p><strong>{error ? "Unavailable" : counts?.total ?? "…"}</strong></div><div className="metric"><p>Active viewers · last 2 minutes</p><strong>{error ? "Unavailable" : counts?.live ?? "…"}</strong></div></div>{error ? <p role="status">Statistics could not refresh. Check the connection and visitor-statistics rules.</p> : <p className="muted text-sm">{counts ? "Updated " + counts.at : "Loading statistics…"} · Refreshes every minute.</p>}</>}<p className="muted text-sm mt-3">Automatically counts public-page browser sessions since tracking was enabled. Reloads in the same session are deduplicated; multiple tabs or devices can count separately. Hidden tabs and private account pages stop reporting. These estimates exclude opt-outs and may include bots.</p><div className="mt-5"><h3 className="section-heading">Google search performance</h3><p className="muted text-sm">Use Search Console to review indexed pages, impressions, clicks and queries. Search traffic and enquiries are different measures.</p><a className="text-link" href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">Open Google Search Console ↗</a></div></section>;
}
