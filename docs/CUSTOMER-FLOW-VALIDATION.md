# Visitor/customer/admin flow validation

October 15, 2026.

Type checking, production build, and all four SEO tests passed. Public pages were checked at 320/390/768/1440 widths in both themes. The updated browser suite verifies that anonymous visitors cannot reach the enquiry form without authentication, sign-in from the enquiry destination returns to that form, generic customer sign-in returns to the homepage, and customers retain access to their own enquiry/project records. Admin CRUD, responsive navigation, and cross-customer record isolation also passed. Customer-page screenshot inspected: public header and account links replace the dashboard sidebar.

Tests use local Firebase emulators and synthetic identities, not live Google OAuth. The two-admin allowlist and existing owner-scoped security rules remain in force. The Firebase project owner must provision the two approved admin identities before they can enter the dashboard.

This follow-up includes PR #2's pending signup/admin restrictions. Deploy the complete follow-up after review; database rules from PR #2 are still required. Existing customer dashboard bookmarks should use the new account routes documented in RUN-AND-DEPLOY.md.
