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
await fetch(
  "http://127.0.0.1:8080/emulator/v1/projects/demo-mindforge/databases/(default)/documents",
  { method: "DELETE" },
);
await fetch(
  "http://127.0.0.1:9099/emulator/v1/projects/demo-mindforge/accounts",
  { method: "DELETE" },
);
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
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", (e) => errors.push(e.message));
async function go(p) {
  await page.goto("http://localhost:5173" + p);
  await page.locator("h1").waitFor();
}
async function login(email, destination = "/sign-in") {
  await page.goto("http://localhost:5173" + destination);
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
  await page.waitForURL(/\/(admin|account\/new)?$/);
}
try {
  const routes = [
    "/",
    "/services",
    "/domains",
    "/portfolio",
    "/how-it-works",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/blog",
    "/blog/choose-final-year-software-project",
    "/blog/software-project-viva",
    "/track",
  ];
  if (!process.env.SKIP_PUBLIC)
    for (const theme of ["light", "dark"]) {
      await go("/");
      await page.evaluate((t) => {
        localStorage.setItem("mindforge-theme", t);
        document.documentElement.classList.toggle("dark", t === "dark");
      }, theme);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 950 });
        for (const route of routes) {
          await go(route);
          assert.equal(await page.locator("h1").count(), 1, route);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            theme + " overflow " + route + " " + width,
          );
          if (route === "/" && [390, 1440].includes(width))
            await page.screenshot({
              path: new URL(
                "home-" + theme + "-" + width + ".png",
                output,
              ).pathname.replace(/^\/(\w:)/, "$1"),
              fullPage: true,
            });
        }
      }
    }
  checks.push(
    "13 routes at 4 viewport widths in both themes, no horizontal overflow",
  );
  await go("/");
  if (await page.getByRole("button", { name: "Switch to light theme" }).count())
    await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    false,
  );
  checks.push("Theme toggle persists after reload");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator("#mobile-navigation")
    .getByRole("link", { name: "Services", exact: true })
    .click();
  assert.equal(new URL(page.url()).pathname, "/services");
  await go("/contact");
  assert.equal(await page.locator("form").count(), 0);
  await page.getByRole("link", {name:"Submit enquiry", exact:true}).click();
  await page.getByRole("button", {name:"Continue with Google"}).waitFor();
  assert.equal(new URL(page.url()).pathname, "/account/new");
  checks.push("Visitor enquiry submission requires authentication");
  await login("customer-qa@example.test", "/account/new");
  await page.getByLabel("Project title or idea").waitFor();
  assert.equal(new URL(page.url()).pathname, "/account/new");
  checks.push("Sign-in from enquiry returns directly to the form");
  await page.evaluate(async () => { const {auth} = await import("/src/firebase/config.ts"); const {signOut} = await import("/node_modules/.vite/deps/firebase_auth.js"); await signOut(auth); });
  await login("customer-qa@example.test");
  await page.reload();
  assert.equal(new URL(page.url()).pathname, "/");
  await page.getByRole("button", {name:"Open navigation"}).click();
  await page.locator("#mobile-navigation").getByRole("button", {name:"Sign out"}).waitFor();
  checks.push(
    "First customer sign-in, profile creation and persistent session",
  );
  await go("/account/new");
  await page.getByLabel("Project title or idea").fill("QA booking project");
  await page.getByLabel(/^Domain/).selectOption("Python");
  await page.getByLabel("Technology preferences").fill("Flask");
  await page
    .getByLabel("Requirements and expected outcome")
    .fill("Create a booking workflow for a local emulator test.");
  await page
    .getByRole("button", { name: "Submit enquiry", exact: true })
    .click();
  await page
    .getByText("Your enquiry has been saved.", { exact: false })
    .waitFor();
  await go("/account/enquiries");
  await page.getByText("QA booking project", { exact: true }).waitFor();
  checks.push("Customer enquiry saves and appears in own list");
  await go("/admin");
  await page
    .getByRole("heading", { name: "Administrator access required" })
    .waitFor();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login("mindforgehub26@gmail.com");
  const owner = await auth.getUserByEmail("mindforgehub26@gmail.com");
  await auth.setCustomUserClaims(owner.uid, { admin: true });
  await db.doc("access/" + owner.uid).set({ role: "admin" });
  await page.evaluate(async () => {
    const { auth } = await import("/src/firebase/config.ts");
    await auth.currentUser.getIdToken(true);
  });
  await go("/admin");
  await page.getByRole("heading", { name: "Business overview" }).waitFor();
  await go("/admin/enquiries");
  await page
    .getByRole("link", { name: "QA booking project", exact: true })
    .click();
  await page.getByLabel("Enquiry status").selectOption("Confirmed");
  await page
    .getByRole("button", { name: "Save changes", exact: true })
    .first()
    .click();
  await page
    .getByText("Saved successfully.", { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Create project from confirmed enquiry" })
    .click();
  await page.waitForURL(/\/admin\/projects\/.+/);
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await page
    .getByLabel("Agreed scope")
    .fill("QA scope: build and explain the booking workflow.");
  await page.getByLabel("Agreed price").fill("1500");
  await page
    .getByRole("button", { name: "Save changes", exact: true })
    .first()
    .click();
  await page
    .getByText("Saved successfully.", { exact: true })
    .first()
    .waitFor();
  await page.getByLabel("Milestone", { exact: true }).fill("Working prototype");
  await page.getByRole("button", { name: "Add milestone" }).click();
  await page
    .getByText("Working prototype · Planned", { exact: true })
    .waitFor();
  await page
    .getByLabel("Progress update", { exact: true })
    .fill("The prototype is ready for review.");
  await page.getByRole("button", { name: "Publish update" }).click();
  await page
    .getByText("The prototype is ready for review.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Internal QA note, never visible to customer.");
  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Internal notes" }) })
    .getByRole("button", { name: "Save changes" })
    .click();
  checks.push(
    "Admin confirms enquiry, creates linked project, saves scope/price/milestone/update/private note",
  );
  await go("/admin/portfolio");
  await page.getByLabel("Title", { exact: true }).fill("QA demonstration");
  await page.getByLabel(/^Domain/).fill("Python");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic demonstration entry for local browser verification.");
  await page.getByLabel("Visibility").selectOption("true");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("select")
      ?.selectedOptions[0].textContent?.includes("QA demonstration"),
  );
  await go("/admin/content");
  await page.getByLabel("Announcement").fill("QA local preview announcement");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved successfully.").waitFor();
  await go("/");
  await page
    .getByText("QA local preview announcement", { exact: true })
    .waitFor();
  await go("/portfolio");
  await page.getByRole("heading", { name: "QA demonstration" }).waitFor();
  checks.push("Admin CMS changes appear publicly through permitted queries");
  await page.setViewportSize({ width: 1440, height: 950 });
  await go("/admin");
  await page.screenshot({
    path: new URL("admin-light.png", output).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login("customer-qa@example.test");
  await go("/account/projects/" + projectId);
  await page
    .getByText("QA scope: build and explain the booking workflow.", {
      exact: true,
    })
    .waitFor();
  await page.getByText("Working prototype", { exact: true }).waitFor();
  await page
    .getByText("The prototype is ready for review.", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByText("Internal QA note, never visible to customer.", {
        exact: true,
      })
      .count(),
    0,
  );
  checks.push(
    "Customer sees agreed project details and updates without internal notes",
  );
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const route of [
      "/account/projects",
      "/account/enquiries",
      "/account/projects/" + projectId,
      "/account/new",
      "/account/settings",
    ]) {
      await go(route);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Dashboard overflow " + route + " " + width,
      );
    }
  }
  await go("/account/projects");
  await page.screenshot({
    path: new URL("customer-light.png", output).pathname.replace(
      /^\/(\w:)/,
      "$1",
    ),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL("browser-results.json", output),
    JSON.stringify(
      {
        checks,
        pageErrors: errors,
        network: "Only localhost allowed; synthetic emulator records only",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks }, null, 2));
} catch (e) {
  await page.screenshot({
    path: new URL("failure.png", output).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  console.error(e);
  console.error("URL:", page.url());
  console.error("PAGE ERRORS:", errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
