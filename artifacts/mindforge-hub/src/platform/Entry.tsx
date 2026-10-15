import { useEffect } from "react";
import { useLocation } from "wouter";
import AuthGate, { useSession } from "./Auth";
import Admin from "./Admin";
import Customer from "./Customer";
function returnPath() {
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return /^\/account\/(new|enquiries|settings|projects(?:\/[A-Za-z0-9_-]+)?)$/.test(next) ? next : "/";
}
function Workspace() {
  const [path, navigate] = useLocation();
  const { admin } = useSession();
  useEffect(() => {
    if (path === "/sign-in")
      navigate(admin ? "/admin" : returnPath(), { replace: true });
    else if (path === "/account") navigate("/", { replace: true });
    else if (path === "/dashboard" || path.startsWith("/dashboard/")) navigate("/admin", { replace: true });
  }, [path, admin, navigate]);
  return path.startsWith("/admin") ? (
    <Admin />
  ) : path === "/sign-in" || path === "/account" || path.startsWith("/dashboard") ? (
    <p role="status">Opening your workspace…</p>
  ) : (
    <Customer />
  );
}
export default function Entry() {
  const [path] = useLocation();
  return (
    <AuthGate adminOnly={/^\/(admin|dashboard)(\/|$)/.test(path)}>
      <Workspace />
    </AuthGate>
  );
}
