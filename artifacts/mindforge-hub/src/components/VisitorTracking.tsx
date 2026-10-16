import { useEffect } from "react";
import { useLocation } from "wouter";
import { visitorCountingAllowed } from "@/lib/analytics";
import { publicPaths } from "@/lib/site";
export const visitorTrackingConfigured = import.meta.env.VITE_VISITOR_STATS_ENABLED === "true";
export default function VisitorTracking() {
 const [path] = useLocation();
 useEffect(() => {
  if (!visitorTrackingConfigured || !publicPaths.includes(path)) return;
  let active = true, busy = false;
  const allowed = () => active && visitorCountingAllowed() && document.visibilityState === "visible";
  const tick = async () => {
   if (!allowed() || busy) return;
   busy=true;
   try { const {heartbeat} = await import("@/lib/visitor-presence"); await heartbeat(allowed); }
   catch { /* Optional statistics must never block customer actions. */ }
   finally { busy=false; }
  };
  void tick(); const timer = setInterval(tick,60000);
  document.addEventListener("visibilitychange",tick);
  window.addEventListener("analytics-consent-changed",tick);
  return () => {active=false;clearInterval(timer);document.removeEventListener("visibilitychange",tick);window.removeEventListener("analytics-consent-changed",tick);};
 },[path]);
 return null;
}
