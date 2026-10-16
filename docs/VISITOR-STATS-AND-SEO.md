# Visitor statistics and search setup

## Enable visitor statistics

1. Review and deploy this branch's Firestore rules to `mindforge-hub` (keep all existing customer/admin rules).
2. In Firebase Authentication > Sign-in method, enable Anonymous alongside Google. Anonymous sessions use a separately named Firebase client; they cannot create customer profiles or access enquiries/projects.
3. Set `VITE_VISITOR_STATS_ENABLED=true` in Vercel for the intended environment and redeploy. Keep it false until the provider and rules are configured.
4. Visit a public page in a fresh browser session without accepting an analytics banner. Sign in as a provisioned admin in a separate browser and view Website visitors on the overview.

Total tracked visits = count of automatically counted anonymous browser-session identities since collection started. Reloads in the same session reuse an identity; separate tabs/devices can count separately. It is not a count of unique people or all historic traffic. Active viewers = sessions with a server-recorded heartbeat in the last two minutes; counts refresh every minute while the admin page is visible. Hidden tabs and private routes stop reporting. No enquiry text, names, emails, URLs, IP addresses or project details are stored in visitor documents. Firebase itself processes connection information under its policies.

Rules restrict each anonymous identity to its own timestamp-only record, validate server timestamps, preserve creation time, throttle writes to at most once per 55 seconds, and reserve all aggregate/list access to approved admins. Admin read failures show Unavailable rather than a misleading zero. These client-reported estimates can include bots and do not provide global anti-abuse protection.

## Free-plan limits and retention

No Cloud Functions or paid Storage is needed for these metrics. Heartbeats use approximately one document read and write per active minute; admin count queries also consume reads. Spark's quotas still apply: roughly 20,000 active visitor-minutes/day would consume the entire 20,000-write daily allowance before business data writes. Monitor usage and leave headroom; turn the flag off and redeploy if approaching limits. Never describe this as unlimited or guaranteed free for life.

Visitor records currently have no automatic deletion. Deleting old records reduces the all-time total. Set a business retention policy before enabling tracking; deletion or anonymized archival should be performed through a trusted operator, not client access. The Privacy page opt-out stops future heartbeats, while existing counts expire from the active window within two minutes.

## Google Search Console: first-time setup

No Search Console property access or actual search metrics were available during this work. Do not infer indexed pages, clicks or queries from website traffic counts.

1. Open https://search.google.com/search-console and choose Add property > URL prefix.
2. Enter `https://mindforge-hub-mindforge-hub.vercel.app/` (or the confirmed canonical production hostname).
3. Choose HTML tag verification. Copy only the content token into Vercel's `VITE_GOOGLE_SITE_VERIFICATION`, then redeploy the production website and click Verify in Search Console.
4. Submit `sitemap.xml` under Sitemaps. Inspect the homepage and Services URL using URL Inspection. Request indexing if appropriate; indexing is not guaranteed or immediate.
5. Review Indexing > Pages for exclusions. Review Performance > Search results for impressions, clicks, CTR, average position and Queries. Compare consistent date ranges, such as the last 28 days against the previous 28 days.
6. Assess enquiries separately: search visibility does not guarantee conversion. Use actual enquiries; do not claim every WhatsApp click became a lead.

## Conversion changes

The homepage explicitly identifies student project guidance, documentation and viva support. Existing indicative PPT and report prices are visible near the main CTA; software projects are quoted after scope review. The main CTA leads to the authenticated enquiry form. General WhatsApp contact remains available. Do not invent testimonials, guarantees, price discounts or lead counts.

## Google Business Profile

Only create a profile if the business meets Google's real in-person customer-contact requirements. An online-only business is generally ineligible. Do not create a fake address or virtual-office listing to gain local rankings. No profile was created or modified.

Sources checked October 15, 2026:
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/firestore/query-data/aggregation-queries
- https://support.google.com/webmasters/answer/7576553
- https://support.google.com/business/answer/3038177

Automatic counts do not load Google Analytics. Earlier analytics opt-outs are preserved; the Privacy page provides a Stop visitor counting control. Browser session identifiers are still used; this is not identifier-free tracking.
