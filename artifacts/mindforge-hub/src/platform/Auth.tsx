import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase/config";
import { ensureProfile } from "./data";
import { Link } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";
import { isAllowedAdmin } from "./admin-policy";
const Context = createContext<{ user: User; admin: boolean } | null>(null);
export function useSession() {
  return useContext(Context)!;
}
export default function AuthGate({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null),
    [admin, setAdmin] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let roleUnsub = () => {},
      active = true,
      version = 0;
    getRedirectResult(auth).catch(() => {
      if (active)
        setError("Google sign-in could not finish. Please try again.");
    });
    const unsub = onIdTokenChanged(auth, async (u) => {
      const current = ++version;
      roleUnsub();
      setError("");
      setReady(false);
      setAdmin(false);
      setUser(u);
      if (!u) {
        setReady(true);
        return;
      }
      try {
        await ensureProfile();
        const token = await u.getIdTokenResult();
        if (!active || current !== version) return;
        roleUnsub = onSnapshot(
          doc(db, "access", u.uid),
          (s) => {
            if (!active || current !== version) return;
            setAdmin(u.emailVerified && isAllowedAdmin(u.email) && token.signInProvider === "google.com" && token.claims.admin === true && s.data()?.role === "admin");
            setReady(true);
          },
          () => {
            setAdmin(false);
            setReady(true);
          },
        );
      } catch {
        if (active && current === version) {
          setError(
            "Your account signed in, but its profile could not be initialized. Ask the business to check the database rules.",
          );
          setReady(true);
        }
      }
    });
    return () => {
      active = false;
      unsub();
      roleUnsub();
    };
  }, []);
  const login = async () => {
    setBusy(true);
    setError("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      if (e.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch {
          setError(
            "Sign-in is unavailable. Check the authorized domain and try again.",
          );
        }
      } else
        setError(
          e.code === "auth/popup-closed-by-user"
            ? "Sign-in was cancelled. You can try again."
            : e.code === "auth/operation-not-allowed" ? "Google sign-in is not enabled yet. Please contact us so we can finish account setup." : e.code === "auth/unauthorized-domain" ? "Google sign-in is not configured for this website address yet. Please contact us." : "Sign-in failed. Check your connection and try again.",
        );
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return (
      <div className="auth-page">
        <p role="status">Checking your session…</p>
      </div>
    );
  if (!user || error)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="flex justify-between items-center">
            <Link href="/" className="brand">
              MindForge Hub
            </Link>
            <ThemeToggle />
          </div>
          <p className="eyebrow mt-10">YOUR PROJECT WORKSPACE</p>
          <h1>Sign up or sign in with Google</h1>
          <p className="muted">
            Sign in with Google to submit an enquiry, follow your projects and
            see agreed progress updates. First-time sign-in creates a customer
            account.
          </p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button
            className="btn-primary w-full justify-center mt-6"
            disabled={busy}
            onClick={
              user
                ? () => {
                    setError("");
                    signOut(auth);
                  }
                : login
            }
          >
            {busy
              ? "Connecting…"
              : user
                ? "Sign out and retry"
                : "Continue with Google"}
          </button>
          <p className="text-sm muted mt-5">
            We never receive your Google password.{" "}
            <Link href="/privacy" className="text-link">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link href="/terms" className="text-link">
              Service terms
            </Link>
          </p>
          <Link href="/" className="text-link mt-6 inline-block">
            Back to the website
          </Link>
        </div>
      </div>
    );
  if (adminOnly && !admin)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Administrator access required</h1>
          <p className="muted">
            This account can use the customer workspace. Administrator access
            must be provisioned by the business owner.
          </p>
          <Link href="/account" className="btn-primary mt-6">
            Open my workspace
          </Link>
          <button className="btn-outline mt-4" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </div>
    );
  return (
    <Context.Provider value={{ user, admin }}>{children}</Context.Provider>
  );
}
