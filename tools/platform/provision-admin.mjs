import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const args = Object.fromEntries(
  process.argv.slice(2).map((x) => {
    const i = x.indexOf("=");
    return i < 0
      ? [x.replace(/^--/, ""), true]
      : [x.slice(2, i), x.slice(i + 1)];
  }),
);
if (!args.project || !args.uid || !["admin", "customer"].includes(args.role))
  throw new Error(
    "Usage: node provision-admin.mjs --project=PROJECT_ID --uid=FIREBASE_UID --role=admin|customer [--apply --confirm=PROJECT_ID]",
  );
const emulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (
  emulator &&
  (!args.project.startsWith("demo-") || !process.env.FIRESTORE_EMULATOR_HOST)
)
  throw new Error(
    "Emulator provisioning requires both emulator hosts and a demo- project.",
  );
if (!emulator && args.project.startsWith("demo-"))
  throw new Error("Demo provisioning requires emulator environment variables.");
initializeApp({
  projectId: args.project,
  ...(!emulator ? { credential: applicationDefault() } : {}),
});
const auth = getAuth(),
  db = getFirestore(),
  user = await auth.getUser(args.uid);
if (
  !user.emailVerified ||
  !user.providerData.some((p) => p.providerId === "google.com")
)
  throw new Error(
    "Only a verified Google account may be provisioned. Confirm the intended owner UID in Firebase first.",
  );
if (args.role === "admin" && !["mindforgehub26@gmail.com", "dayanandmk.dev@gmail.com"].includes(user.email))
  throw new Error("This Google account is not on the administrator allowlist.");
console.log(
  JSON.stringify({
    project: args.project,
    uid: args.uid,
    requestedRole: args.role,
    mode: args.apply ? "apply" : "dry-run",
  }),
);
if (!args.apply) {
  console.log(
    "No changes made. Review the project and UID, then repeat with --apply --confirm=PROJECT_ID.",
  );
  process.exit(0);
}
if (args.confirm !== args.project)
  throw new Error("Explicit --confirm must match --project.");
const claims = { ...(user.customClaims || {}) };
if (args.role === "admin") claims.admin = true;
else delete claims.admin;
// Demotion changes the server-owned record before claims, immediately rejecting stale admin tokens.
if (args.role === "customer")
  await db
    .doc("access/" + args.uid)
    .set({ role: "customer", updatedAt: FieldValue.serverTimestamp() });
await auth.setCustomUserClaims(args.uid, claims);
if (args.role === "admin")
  await db
    .doc("access/" + args.uid)
    .set({ role: "admin", updatedAt: FieldValue.serverTimestamp() });
await auth.revokeRefreshTokens(args.uid);
await db
  .collection("activity")
  .add({
    actorUid: "trusted-admin-cli",
    action:
      args.role === "admin"
        ? "Provision administrator"
        : "Remove administrator access",
    entityPath: "access/" + args.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
console.log("Role updated. The account must sign out and sign in again.");
