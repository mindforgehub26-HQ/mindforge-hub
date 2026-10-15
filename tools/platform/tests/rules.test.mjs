import { before, after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  getCountFromServer,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mindforge",
    firestore: {
      rules: await readFile("../../firebase/firestore.rules", "utf8"),
    },
    storage: { rules: await readFile("../../firebase/storage.rules", "utf8") },
  });
});
after(async () => {
  await env?.cleanup();
});
const context = (uid, claims = {}) =>
  env.authenticatedContext(uid, {
    email: uid === "owner" ? "mindforgehub26@gmail.com" : uid + "@example.test",
    firebase: { sign_in_provider: "google.com" },
    email_verified: true,
    ...claims,
  });
const db = (uid, claims = {}) => context(uid, claims).firestore();
const timestamp = () => serverTimestamp();
const profile = (uid) => ({
  name: uid,
  email: uid + "@example.test",
  contactPreference: "Email",
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
const enquiry = (uid) => ({
  ownerUid: uid,
  title: "A software project",
  domain: "Python",
  technologies: "Flask",
  requirements: "Build a useful demonstration of a booking system.",
  deadline: "",
  budget: "",
  contactPreference: "Email",
  status: "Enquiry Received",
  projectId: "",
  archived: false,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});
const project = (uid) => ({
  ownerUid: uid,
  title: "Private project",
  domain: "Python",
  scope: "Agreed scope",
  status: "Confirmed",
  deadline: "",
  price: 1200,
  sourceEnquiryId: "",
  createdAt: timestamp(),
  updatedAt: timestamp(),
  auditId: "seeded-record",
});
async function seed(fn) {
  await env.withSecurityRulesDisabled((c) => fn(c.firestore(), c.storage()));
}
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (d) => {
    await Promise.all(
      ["alice", "bob", "owner"].map((uid) =>
        setDoc(doc(d, "users", uid), profile(uid)),
      ),
    );
    await setDoc(doc(d, "access/owner"), { role: "admin" });
    await setDoc(doc(d, "projects/alice-project"), project("alice"));
    await setDoc(doc(d, "projects/bob-project"), project("bob"));
    await setDoc(doc(d, "projects/alice-project/milestones/m1"), {
      title: "Build prototype",
      status: "Planned",
      dueDate: "",
    });
    await setDoc(doc(d, "projects/alice-project/updates/u1"), {
      body: "Work has started",
      createdAt: timestamp(),
    });
    await setDoc(doc(d, "internalNotes/project-alice-project"), {
      body: "Private note",
    });
    await setDoc(doc(d, "clients/alice-legacy"), { ownerUid: "alice" });
    await setDoc(doc(d, "portfolio/published"), {
      published: true,
      title: "Demonstration",
    });
    await setDoc(doc(d, "portfolio/draft"), {
      published: false,
      title: "Private draft",
    });
  });
});
function audited(d, path, data, merge = false) {
  const batch = writeBatch(d);
  const log = doc(collection(d, "activity"));
  batch.set(log, {
    actorUid: "owner",
    action: "Test admin change",
    entityPath: path,
    createdAt: timestamp(),
  });
  batch.set(
    doc(d, path),
    { ...data, updatedAt: timestamp(), auditId: log.id },
    { merge },
  );
  return batch.commit();
}
function submit(d, uid, id, changes = {}) {
  const batch = writeBatch(d);
  batch.set(doc(d, "enquiries", id), { ...enquiry(uid), ...changes });
  batch.set(doc(d, "submissionLimits", uid), {
    enquiryId: id,
    lastAt: timestamp(),
  });
  return batch.commit();
}
test("Anonymous clients cannot read private records, list profiles or submit enquiries", async () => {
  const d = env.unauthenticatedContext().firestore();
  for (const p of [
    "projects/alice-project",
    "users/alice",
    "access/owner",
    "internalNotes/project-alice-project",
    "clients/alice-legacy",
  ])
    await assertFails(getDoc(doc(d, p)));
  await assertFails(getDocs(collection(d, "users")));
  await assertFails(submit(d, "alice", "anonymous-enquiry"));
});
test("Customer can read only owned project, milestones and progress, including direct guessed paths", async () => {
  const a = db("alice"),
    b = db("bob");
  for (const path of [
    "projects/alice-project",
    "projects/alice-project/milestones/m1",
    "projects/alice-project/updates/u1",
  ]) {
    await assertSucceeds(getDoc(doc(a, path)));
    await assertFails(getDoc(doc(b, path)));
  }
  await assertFails(getDocs(collection(a, "projects")));
  await assertSucceeds(
    getDocs(query(collection(a, "projects"), where("ownerUid", "==", "alice"))),
  );
  await assertFails(
    getDocs(query(collection(a, "projects"), where("ownerUid", "==", "bob"))),
  );
  await assertFails(getDoc(doc(a, "users/bob")));
  await assertFails(getDoc(doc(a, "internalNotes/project-alice-project")));
});
test("Customer profile cannot grant role or change ownership, email, or protected records", async () => {
  const d = db("alice");
  await assertSucceeds(
    updateDoc(doc(d, "users/alice"), {
      name: "Alice updated",
      updatedAt: timestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(d, "users/alice"), { role: "admin", updatedAt: timestamp() }),
  );
  await assertFails(
    updateDoc(doc(d, "users/alice"), {
      email: "owner@example.test",
      updatedAt: timestamp(),
    }),
  );
  await assertFails(setDoc(doc(d, "access/alice"), { role: "admin" }));
  await assertFails(
    updateDoc(doc(d, "projects/alice-project"), { ownerUid: "bob" }),
  );
  await assertFails(updateDoc(doc(d, "projects/alice-project"), { price: 1 }));
  await assertFails(deleteDoc(doc(d, "projects/alice-project")));
});
test("Verified first sign-up creates an unprivileged profile; unverified sign-up is denied", async () => {
  await assertSucceeds(
    setDoc(
      doc(db("new-customer"), "users/new-customer"),
      profile("new-customer"),
    ),
  );
  await assertFails(
    setDoc(doc(db("rogue"), "users/rogue"), {
      ...profile("rogue"),
      role: "admin",
    }),
  );
  await assertFails(
    setDoc(
      doc(db("unverified", { email_verified: false }), "users/unverified"),
      profile("unverified"),
    ),
  );
});
test("Administrator requires both trusted claim and server-owned role; immediate demotion blocks stale token", async () => {
  await assertFails(getDocs(collection(db("alice", { admin: true }), "users")));
  await assertFails(getDocs(collection(db("owner"), "users")));
  const d = db("owner", { admin: true });
  await assertSucceeds(getDocs(collection(d, "users")));
  await seed((d) => setDoc(doc(d, "access/owner"), { role: "customer" }));
  await assertFails(getDocs(collection(d, "users")));
  await assertFails(
    audited(d, "projects/alice-project", { status: "Completed" }, true),
  );
});
test("Enquiry submissions validate ownership and required fields and enforce server cooldown", async () => {
  const d = db("alice");
  await assertSucceeds(getDoc(doc(d, "enquiries/new-enquiry-123")));
  await assertFails(
    submit(d, "alice", "invalid-owner-123", { ownerUid: "bob" }),
  );
  await assertFails(submit(d, "alice", "invalid-title-123", { title: "x" }));
  await assertFails(
    submit(d, "alice", "invalid-status-123", { status: "Confirmed" }),
  );
  await assertFails(submit(d, "alice", "extra-field-123", { role: "admin" }));
  await assertSucceeds(submit(d, "alice", "valid-enquiry-123"));
  await assertSucceeds(getDoc(doc(d, "enquiries/valid-enquiry-123")));
  await assertFails(getDoc(doc(db("bob"), "enquiries/valid-enquiry-123")));
  await assertFails(submit(d, "alice", "too-soon-enquiry"));
  await assertFails(
    updateDoc(doc(d, "enquiries/valid-enquiry-123"), { status: "Confirmed" }),
  );
  await assertFails(
    setDoc(doc(d, "submissionLimits/alice"), {
      lastAt: Timestamp.fromMillis(0),
      enquiryId: "valid-enquiry-123",
    }),
  );
});
test("Admin mutation requires an immutable matching audit entry and validates project fields", async () => {
  const d = db("owner", { admin: true });
  await assertFails(
    updateDoc(doc(d, "projects/alice-project"), {
      status: "Completed",
      updatedAt: timestamp(),
    }),
  );
  await assertSucceeds(
    audited(d, "projects/alice-project", { status: "Completed" }, true),
  );
  await assertFails(audited(d, "projects/alice-project", { price: -1 }, true));
  await assertFails(
    audited(d, "projects/alice-project", { ownerUid: "bob" }, true),
  );
  const logs = await getDocs(collection(d, "activity"));
  await assertFails(updateDoc(logs.docs[0].ref, { action: "Hide edit" }));
  await assertFails(deleteDoc(logs.docs[0].ref));
});
test("Confirmed enquiry converts atomically, preserves ownership and cannot be converted twice", async () => {
  await seed((d) =>
    setDoc(doc(d, "enquiries/confirmed-enquiry"), {
      ...enquiry("alice"),
      status: "Confirmed",
    }),
  );
  const d = db("owner", { admin: true });
  function convert(id, ownerUid = "alice") {
    const batch = writeBatch(d);
    for (const [path, data] of [
      [
        `projects/${id}`,
        { ...project(ownerUid), sourceEnquiryId: "confirmed-enquiry" },
      ],
      ["enquiries/confirmed-enquiry", { projectId: id }],
    ]) {
      const log = doc(collection(d, "activity"));
      batch.set(log, {
        actorUid: "owner",
        action: "Convert",
        entityPath: path,
        createdAt: timestamp(),
      });
      batch.set(
        doc(d, path),
        { ...data, updatedAt: timestamp(), auditId: log.id },
        { merge: true },
      );
    }
    return batch.commit();
  }
  await assertFails(convert("wrong-owner", "bob"));
  await assertSucceeds(convert("converted-project"));
  await assertFails(convert("duplicate-project"));
  await assertSucceeds(getDoc(doc(db("alice"), "projects/converted-project")));
});
test("Portfolio drafts are private, published queries public; customers cannot publish content", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(
    getDocs(
      query(collection(anon, "portfolio"), where("published", "==", true)),
    ),
  );
  await assertFails(getDoc(doc(anon, "portfolio/draft")));
  await assertFails(getDocs(collection(anon, "portfolio")));
  await assertFails(
    setDoc(doc(db("alice"), "siteContent/main"), { announcement: "Injected" }),
  );
  await assertSucceeds(
    audited(db("owner", { admin: true }), "siteContent/main", {
      announcement: "Approved announcement",
      pricingNote: "Request a written quote.",
    }),
  );
  await assertSucceeds(getDoc(doc(anon, "siteContent/main")));
});
test("Storage enforces ownership, content type and authentication for legacy payment proof", async () => {
  const owner = context("alice").storage(),
    other = context("bob").storage(),
    anon = env.unauthenticatedContext().storage();
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const path = "payment-proofs/alice/alice-legacy/proof.png";
  await assertSucceeds(
    uploadBytes(ref(owner, path), bytes, { contentType: "image/png" }),
  );
  await assertFails(
    uploadBytes(ref(other, path), bytes, { contentType: "image/png" }),
  );
  await assertFails(
    uploadBytes(
      ref(owner, "payment-proofs/alice/alice-legacy/file.html"),
      bytes,
      { contentType: "text/html" },
    ),
  );
  await assertFails(getBytes(ref(other, path)));
  await assertFails(getBytes(ref(anon, path)));
  await assertSucceeds(getBytes(ref(owner, path)));
});


test("Only the two verified Google identities may use a provisioned admin role", async () => {
  for (const email of ["mindforgehub26@gmail.com", "dayanandmk.dev@gmail.com"]) {
    await assertSucceeds(getDocs(collection(db("owner", { admin: true, email }), "users")));
  }
  for (const claims of [
    { email: "other@gmail.com" },
    { email: "mindforgehub26@gmail.com.attacker.test" },
    { email_verified: false },
    { firebase: { sign_in_provider: "password" } },
  ]) {
    await assertFails(getDocs(collection(db("owner", { admin: true, ...claims }), "users")));
  }
});


test("Visitor presence is private, owner-only, timestamp-validated and throttled", async () => {
 const anon = db("visit-one", {email_verified:false, firebase:{sign_in_provider:"anonymous"}});
 const ref = doc(anon,"visitorPresence/visit-one");
 await assertSucceeds(setDoc(ref,{createdAt:timestamp(),lastSeen:timestamp()}));
 await assertFails(updateDoc(ref,{lastSeen:timestamp()}));
 await assertFails(updateDoc(ref,{email:"private@example.test"}));
 await assertFails(setDoc(doc(anon,"visitorPresence/another"),{createdAt:timestamp(),lastSeen:timestamp()}));
 await assertFails(getDocs(collection(anon,"visitorPresence")));
 await assertFails(getCountFromServer(collection(db("alice"),"visitorPresence")));
 await assertFails(getDoc(doc(db("bob"),"visitorPresence/visit-one")));
 await assertFails(setDoc(doc(db("alice"),"visitorPresence/alice"),{createdAt:timestamp(),lastSeen:timestamp()}));
 const count = await assertSucceeds(getCountFromServer(collection(db("owner",{admin:true}),"visitorPresence")));
 if(count.data().count !== 1) throw new Error("Unexpected visitor count");
 await seed(d => updateDoc(doc(d,"visitorPresence/visit-one"),{lastSeen:Timestamp.fromMillis(Date.now()-70000)}));
 await assertSucceeds(updateDoc(ref,{lastSeen:timestamp()}));
 await assertFails(updateDoc(ref,{lastSeen:Timestamp.fromMillis(Date.now()+999999)}));
 await assertFails(deleteDoc(ref));
});
