import { useEffect, useState } from "react";
import { Link } from "wouter";
export default function AccountActions() {
 const [signed, setSigned] = useState(false);
 useEffect(() => { let active = true; let stop = () => {};
  Promise.all([import("@/firebase/config"), import("firebase/auth")]).then(([{auth}, {onAuthStateChanged}]) => {
    if (active) stop = onAuthStateChanged(auth, user => setSigned(!!user));
  }).catch(() => {});
  return () => { active = false; stop(); };
 }, []);
 const logout = async () => { const [{auth}, {signOut}] = await Promise.all([import("@/firebase/config"), import("firebase/auth")]); await signOut(auth); window.location.assign("/"); };
 return signed ? <><Link href="/account/new">Submit enquiry</Link><Link href="/account/projects">My project status</Link><button onClick={logout}>Sign out</button></> : <Link href="/sign-in">Sign up / Sign in</Link>;
}
