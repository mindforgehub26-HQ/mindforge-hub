import { createRequire } from "node:module";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
)
  throw new Error("Local emulator hosts required.");
initializeApp({ projectId: "demo-mindforge" });
const db = getFirestore(),
  auth = getAuth();
const output = new URL("../../../qa/", import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const errors = [],
  checks = [];
const context = await browser.newContext({ colorScheme: "light" });
await context.route("**/*", (r) =>
  /^(http|ws):\/\/(localhost|127\.0\.0\.1):/.test(r.request().url())
    ? r.continue()
    : r.abort(),
);
await context.addInitScript(() => localStorage.setItem("analytics-consent","denied"));
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", (e) => errors.push(e.message));
async function go(p) {
  await page.goto("http://localhost:5173" + p);
  await page.locator("h1").waitFor();
}
async function login(email) {
  await page.goto("http://localhost:5173/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).waitFor();
  await page.evaluate(async (email) => {
    const { auth } = await import("/src/firebase/config.ts");
    const sdk = await import("/node_modules/.vite/deps/firebase_auth.js");
    const encode = (o) =>
      btoa(JSON.stringify(o))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    const token =
      encode({ alg: "none", typ: "JWT" }) +
      "." +
      encode({
        sub: email,
        email,
        email_verified: true,
        name: email.startsWith("owner") ? "QA Owner" : "QA Customer",
        iss: "https://accounts.google.com",
        aud: "demo-local-app",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }) +
      ".";
    await sdk.signInWithCredential(
      auth,
      sdk.GoogleAuthProvider.credential(token),
    );
  }, email);
  await page.waitForURL(/\/(admin)?$/);
}

try {
  await login("mindforgehub26@gmail.com");
  const projects = await db.collection("projects").get();
  const id = projects.docs[0].id;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      localStorage.setItem("mindforge-theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const route of [
        "/admin",
        "/admin/enquiries",
        "/admin/customers",
        "/admin/projects",
        "/admin/projects/new",
        "/admin/projects/" + id,
        "/admin/portfolio",
        "/admin/content",
        "/admin/activity",
        "/admin/settings",
      ]) {
        await go(route);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          theme + " overflow " + route + " " + width,
        );
      }
    }
  }
  await go("/admin");
  await page.screenshot({
    path: new URL("admin-dark.png", output).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open workspace navigation" }).click();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Enquiries", exact: true })
    .click();
  assert.equal(await page.locator(".workspace-sidebar.is-open").count(), 0);
  await go("/admin/enquiries");
  await page.getByLabel("Search records").fill("nonexistent");
  await page.getByRole("heading", { name: "No matching enquiries" }).waitFor();
  await page.getByLabel("Search records").fill("QA booking");
  await page.getByRole("link", { name: "QA booking project" }).waitFor();
  await go("/admin/settings");
  await page.getByLabel("Display name").fill("QA Owner Updated");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Profile updated.", { exact: true }).waitFor();
  await go("/admin/portfolio");
  await page
    .getByLabel("Edit entry")
    .selectOption({ label: "QA demonstration (published)" });
  await page.getByLabel("Visibility").selectOption("false");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("select")
      ?.selectedOptions[0].textContent?.includes("(draft)"),
  );
  await go("/portfolio");
  await page
    .getByText("No approved examples are published here yet.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "QA demonstration" }).count(),
    0,
  );
  await go("/admin");
  await page.getByRole("button", { name: "Open workspace navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login("second-qa@example.test");
  await go("/account/projects/" + id);
  await page
    .getByText("This record is unavailable or you do not have access.", {
      exact: true,
    })
    .waitFor();
  await go("/account/projects");
  await page
    .getByRole("heading", { name: "Your next project starts here" })
    .waitFor();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL("admin-browser-results.json", output),
    JSON.stringify(
      {
        passed: [
          "10 admin routes at 320/768/1440 in light and dark",
          "Mobile workspace navigation",
          "Enquiry search empty/match states",
          "Profile save",
          "Portfolio unpublish removes public entry",
          "Second customer cannot open guessed project URL",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log("Additional admin and customer isolation browser checks passed.");
} catch (e) {
  await page.screenshot({
    path: new URL("admin-failure.png", output).pathname.replace(
      /^\/(\w:)/,
      "$1",
    ),
    fullPage: true,
  });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
