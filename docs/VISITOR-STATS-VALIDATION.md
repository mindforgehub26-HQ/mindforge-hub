# Visitor metrics and conversion validation

Checked October 15, 2026.

- TypeScript and production build passed; four SEO tests passed.
- Full emulator integration passed: responsive public/customer/admin workflows, role provisioning and 12 security tests.
- Dedicated visitor browser test passed: no document before opt-in; one timestamp-only document afterward; reload preserves session count; analytics authentication does not sign into the customer app; enquiry still requires Google; withdrawal persists.
- New rules test verifies anonymous owner-only writes, admin-only aggregation, timestamp validation, immutable creation time, throttling and denial of extra fields/deletion.
- Admin screenshot visually reviewed with enabled counters and Search Console link.
- Public production HTTP checks: homepage 200 with no noindex directive; sitemap 200 with 12 URLs; robots allows crawling and references that sitemap. These are crawlability checks, not evidence of Google indexing.

No live visitor tracking or Google Search Console configuration was changed. No actual search metrics were available. Tracking must be explicitly enabled after the provider and rules setup. See VISITOR-STATS-AND-SEO.md for definitions, limits and rollout.
