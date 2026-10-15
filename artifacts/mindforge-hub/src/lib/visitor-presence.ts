import { initializeApp, getApps } from "firebase/app";
import { getAuth, browserSessionPersistence, setPersistence, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import app from "@/firebase/config";
let client: Promise<{auth: ReturnType<typeof getAuth>; db: ReturnType<typeof getFirestore>}> | undefined;
function getClient() {
 return client ||= (async () => {
  const name = "visitor-metrics";
  const secondary = getApps().find(a => a.name === name) || initializeApp(app.options, name);
  const auth = getAuth(secondary), db = getFirestore(secondary);
  if (import.meta.env.VITE_USE_EMULATORS === "true") {
   connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings:true});
   connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  await setPersistence(auth, browserSessionPersistence);
  await auth.authStateReady();
  return {auth,db};
 })();
}
export async function heartbeat(allowed: () => boolean) {
 if (!allowed()) return;
 const {auth,db} = await getClient();
 if (!allowed()) return;
 const user = auth.currentUser || (await signInAnonymously(auth)).user;
 if (!allowed()) return;
 await runTransaction(db, async tx => {
  const ref = doc(db,"visitorPresence",user.uid), existing = await tx.get(ref);
  if (!allowed()) return;
  if (existing.exists()) {
   // Suppress duplicate effects/tabs and enforce the same cadence as the rules.
   if (Date.now() - existing.data().lastSeen.toMillis() < 60000) return;
   tx.update(ref,{lastSeen:serverTimestamp()});
  } else tx.set(ref,{createdAt:serverTimestamp(),lastSeen:serverTimestamp()});
 });
}
