import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { analyticsConfigured, consentGranted, trackEvent } from "@/lib/analytics";
import VisitorTracking, { visitorTrackingConfigured } from "./VisitorTracking";
import { publicPaths } from "@/lib/site";
export default function Analytics() {
  const [path] = useLocation();
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow((analyticsConfigured || visitorTrackingConfigured) && !localStorage.getItem("analytics-consent")); } catch { /* no storage: no analytics */ } }, []);
  useEffect(() => {
    trackEvent("page_view", path);
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a");
      if (a?.href.startsWith("https://wa.me/")) trackEvent("whatsapp_click", path);
      else if (a?.href.startsWith("mailto:") || a?.href.startsWith("tel:")) trackEvent("contact_click", path);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [path]);
  if (!show || !publicPaths.includes(path)) return <VisitorTracking />;
  const choose = (value: string) => { try { localStorage.setItem("analytics-consent", value); } catch { /* remain opt-out */ } setShow(false); window.dispatchEvent(new Event("analytics-consent-changed")); if(consentGranted()) trackEvent("page_view", path); };
  return <aside aria-label="Optional analytics" className="fixed bottom-0 left-0 z-50 max-w-lg glass-dark p-5 rounded-xl border border-purple-400">
    <p className="text-sm mb-3">Allow optional analytics to help improve these pages? Enquiry details are excluded. <Link href="/privacy" className="underline">Privacy details</Link></p>
    <div className="flex gap-3"><button className="btn-outline" onClick={() => choose("denied")}>Decline</button><button className="btn-primary" onClick={() => choose("granted")}>Allow analytics</button></div>
  </aside>;
}
