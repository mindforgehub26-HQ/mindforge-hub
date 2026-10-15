# Run MindForge Hub

Open **PowerShell in the extracted project folder** containing `package.json`, `pnpm-workspace.yaml` and `firebase.json`. Use Node.js 22.12+ (Node 24 was tested). Java 21 is required only for the local Firebase emulators. Use pnpm 10.28.2; the machine's global pnpm 11 is incompatible with this repository's package-manager policy.

## Website preview

```powershell
npm exec --yes --package=pnpm@10.28.2 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/mindforge-hub dev
```

Open **http://localhost:5173/**. Stop the server with Ctrl+C. Public pages work without Firebase configuration; protected pages show an account-service error until Firebase is configured. Vite serves source locally; do not open an HTML file directly from File Explorer.

## Local demo with sign-in and dashboards

This uses a `demo-` project and local emulators, not production. Emulator Google sign-in uses synthetic test accounts and is not evidence of live Google OAuth approval. Data is ephemeral unless you explicitly export emulator data.

Create the demo configuration once (refuses to overwrite an existing `.env.local`):

```powershell
node tools/platform/setup-demo.mjs
```

In PowerShell terminal 1, from the project root:

```powershell
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/platform-tools exec firebase emulators:start --project demo-mindforge --only auth,firestore,storage --config ../../firebase.json
```

In terminal 2, run the website command above. Open `/sign-in` and create a **test** Google account in the emulator popup. It receives customer access. To provision a demo administrator, use its UID with the role command below, with both emulator host variables set.

Do not deploy a build containing `VITE_USE_EMULATORS=true`. Configuration changes require restarting Vite or rebuilding.

## Real Firebase configuration

Copy `artifacts/mindforge-hub/.env.example` to `.env.local` in that same directory. Fill public Firebase web-app configuration from Firebase Project settings → Your apps: API key, auth domain, project ID, bucket, sender ID and app ID. Set `VITE_USE_EMULATORS=false`. Keep `VITE_NOINDEX=true` for previews. Do not copy demo values into a real deployment.

1. In Firebase Authentication → Sign-in method, enable **Google** and set the appropriate project support email.
2. In Authentication → Settings → Authorized domains, add `localhost`, the exact staging/preview hostname and the production hostname you control. New projects may not include localhost automatically. Avoid authorizing arbitrary untrusted preview domains.
3. Keep `VITE_FIREBASE_AUTH_DOMAIN` aligned with the Firebase auth handler. The standard redirect URI is `https://PROJECT_ID.firebaseapp.com/__/auth/handler`; ensure the corresponding Google OAuth client accepts the actual auth-handler URI when using a custom auth domain. Do not place a Google client secret in the frontend.
4. The app uses Google popup sign-in with a redirect fallback for blocked popups. Test this on the actual preview domain and a mobile browser. Redirect flows on non-Firebase hosting may require same-origin auth helper hosting/proxy configuration to avoid third-party storage restrictions. Follow Firebase's redirect guidance instead of assuming a Vercel preview automatically supports this fallback.
5. Create Firestore and deploy the checked-in rules to the chosen **staging** project. For Storage rules that read Firestore, grant the Firebase rules service integration permission when prompted by Firebase. Keep the default deny rules; do not switch to test-mode public access.

Official setup references: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices), [trusted custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).

## Administrator provisioning

The intended owner must sign in first. Verify their Firebase Authentication UID through a trusted channel. Use Application Default Credentials for an authorized Firebase administrator, outside the repository. The CLI is **dry-run by default**, requires a verified Google account, preserves unrelated claims and does not print tokens or secrets.

```powershell
# Local emulator ONLY; omit these variables for a real project.
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'

node tools/platform/provision-admin.mjs --project=demo-mindforge --uid=VERIFIED_UID --role=admin
node tools/platform/provision-admin.mjs --project=demo-mindforge --uid=VERIFIED_UID --role=admin --apply --confirm=demo-mindforge
```

For a real project, use a fresh terminal without emulator variables, authenticate ADC using the business owner's approved process and replace both project arguments with the exact real project ID. A service-account JSON, if used, must remain outside source control and never in `VITE_*` variables. Keep its IAM scope and lifetime limited.

Demote with `--role=customer` and the same explicit apply/confirm flags. The server-owned role record is changed before claims so even a stale admin token loses privileged database access. Both operations revoke refresh tokens; sign out and sign in again. Do not edit roles through browser local storage or a profile field.

## Build and verify

```powershell
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/mindforge-hub typecheck
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/mindforge-hub build
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/mindforge-hub test
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/platform-tools test:rules
```

The rules test command starts and stops its own emulators; stop existing emulators first to avoid occupied ports. Expected-denial logs are intentional security assertions. Browser tests require a running demo website/emulators, Microsoft Edge and Playwright; see `tests/browser.test.mjs` under `tools/platform`. They use synthetic records and block external network requests. Never run them against production.

## Safe deployment and rollback

The root `vercel.json` builds only the website and serves `artifacts/mindforge-hub/dist/public`. It prerenders 12 public routes, serves protected SPA routes with `noindex,nofollow` and `private,no-store`, and returns a true 404 for unknown public URLs. The original static generation pipeline remains in use.

Use a separate Vercel preview and staging Firebase project first. Set public environment values for that environment, `VITE_NOINDEX=true` and `VITE_USE_EMULATORS=false`. Add its hostname to Firebase authorized domains. After preview approval, deploy rules to the explicitly selected project:

```powershell
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/platform-tools exec firebase deploy --only firestore:rules,firestore:indexes,storage --project YOUR_CONFIRMED_PROJECT --config ../../firebase.json
```

This command is documented, **not executed**. Review the migration document before using it. Do not remove rules or reset the database to fix a denied request. Preserve the previous rules and Vercel deployment for rollback; rolling back the frontend alone does not roll back data policies. Test legacy tracking before release.

For production set `VITE_SITE_URL` to the final HTTPS origin and `VITE_NOINDEX=false`. Vercel preview builds force noindex and an empty sitemap. Submit the production sitemap through the owner's Search Console account. Analytics remains disabled unless configured with consent and safe-event settings. This work did not change DNS, deploy to production, access live customer records or submit a sitemap.

## Complete local integration check

After creating demo configuration, stop any separately running Vite/emulator processes to free ports 5173, 8080, 9099 and 9199. The following command starts the demo emulators, launches the local website, runs public/customer/admin browser checks, tests role provisioning and security rules, then shuts down the test services:

```powershell
npm exec --yes --package=pnpm@10.28.2 -- pnpm --filter @workspace/platform-tools exec firebase emulators:exec --project demo-mindforge --only auth,firestore,storage "node tests/integration.mjs" --config ../../firebase.json
```

This test suite resets **only the local demo emulator data** and creates synthetic accounts. Microsoft Edge must be installed; Playwright is included as a development dependency. Do not substitute a real project. Results and screenshots are written to the ignored `qa/` directory.

For real ADC setup, an authorized operator can use `gcloud auth application-default login` with the correct business account and `gcloud auth application-default set-quota-project YOUR_CONFIRMED_PROJECT`. Confirm the account's required Firebase IAM permissions. Keep ADC files outside the repository; the provisioning CLI receives only the project ID and verified UID.

## Vercel output-directory troubleshooting

The website build produces `artifacts/mindforge-hub/dist/public` relative to the repository. The Vercel output directory is relative to the project's selected Root Directory:

| Vercel Root Directory | Output Directory |
| --- | --- |
| Repository root (empty or `.`) | `artifacts/mindforge-hub/dist/public` |
| `artifacts/mindforge-hub` | `dist/public` |

Both configurations use `pnpm install --frozen-lockfile` and `pnpm --filter @workspace/mindforge-hub build`. Select framework preset Other. For the nested root, enable inclusion of source files outside the Root Directory so workspace packages and shared assets remain available. Each location has its own `vercel.json` with the corresponding output path.

If the build finishes with “Generated 12 public pages” but Vercel reports no output directory named `public`, the compile succeeded and Vercel is looking in the wrong place. In Settings > Build and Deployment, match the Root Directory and Output Directory using the table above. Deploy the latest PR commit containing the corrected nested configuration; redeploying an old failed deployment retains its old source configuration. Do not use the source `public` folder as the build output.

## Google signup and the two administrator accounts

Use `/sign-in` to create an account or log in with the same Google button. The homepage, navigation, and footer link to it. Customers go to `/dashboard`; provisioned administrators go to `/admin`. The footer also links directly to the admin portal.

Only `mindforgehub26@gmail.com` and `dayanandmk.dev@gmail.com` are eligible administrators. The UI, Firestore rules, Storage rules, and provisioning CLI enforce this list. Both accounts must have verified Google identities, the signed `admin` custom claim, and a server-owned `access/{uid}` admin record. Email alone does not grant access. Other accounts remain customers even if an old admin claim or record exists.

The Firebase project owner must:
1. Enable Authentication > Sign-in method > Google and choose a support email.
2. Add the actual Vercel website hostname under Authentication > Settings > Authorized domains.
3. Put the real Firebase web configuration from `.env.example` in Vercel for the intended environments, with `VITE_USE_EMULATORS=false`, then redeploy. Never put service-account credentials in Vite variables.
4. Deploy the updated Firestore rules to the confirmed project. On Spark, deploy only `firestore:rules,firestore:indexes`; Storage is optional and requires billing.
5. Have both intended administrators sign in once. Verify each user's email and UID in Firebase Authentication, then run the existing provisioning CLI for each UID using trusted local Admin SDK credentials. Sign out and sign in again afterward.

These steps require access to the owner's Firebase project. Publishing the website does not enable the Google provider, deploy database rules, or provision live accounts automatically.

### Keeping the core platform on Firebase Spark

Firebase Spark currently requires no payment method. Google authentication and Firestore support the enquiry/project/admin workflows within published quotas. Firestore Standard includes 1 GiB storage, 50,000 reads/day, and 20,000 writes/day. Exhausting quotas can interrupt service; this is not an unlimited or lifetime guarantee.

Do not enable paid Cloud Functions, phone authentication, or upgrade to Blaze for this setup. Cloud Storage now requires Blaze; existing legacy payment-proof uploads therefore are not part of the Spark-only setup. The new enquiry/project/milestone dashboards do not require file uploads. Keep existing data intact and use email or WhatsApp for attachments if staying on Spark. Do not downgrade an existing billed project without reviewing its existing services.

Sources: https://firebase.google.com/pricing and https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 (checked October 15, 2026).

## Visitor, customer and administrator navigation

Customers no longer use a dashboard. Ordinary Google sign-in returns to `/`. The public header/menu shows Submit enquiry, My project status and Sign out once signed in. `/account/new`, `/account/enquiries`, `/account/projects` and individual project pages require authentication; they render within the public website, without an admin-style sidebar. A visitor opening a protected action stays on that destination through Google sign-in, then continues there. Optional `next` values on `/sign-in` are restricted to explicit local account routes.

`/admin` and the old `/dashboard` namespace require the two-account admin policy, verified Google identity, signed admin claim and trusted access record. Provisioned admins entering the generic sign-in page go to `/admin`. A non-admin visiting an admin URL receives access denied and a link back to the website. Old customer `/dashboard/...` bookmarks should be replaced with `/account/...` links.

The public Contact page now links to the authenticated enquiry form instead of preparing anonymous WhatsApp enquiry submissions. General public contact links remain available; the website cannot prevent someone from contacting the business independently through email or WhatsApp. Firestore continues enforcing ownership for enquiries, projects, milestones and updates regardless of browser navigation.
