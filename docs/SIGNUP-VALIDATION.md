# Google signup and administrator restriction validation

Checked October 15, 2026 using the installed dependency environment with the changed source files copied from this branch.

- TypeScript type check and production build passed; 12 public pages generated.
- Four SEO checks passed, including the newly linked private admin route remaining excluded from the sitemap.
- Full local emulator integration passed: public pages at four widths in both themes, customer signup/session/enquiry/project access, admin enquiry conversion and project/CMS updates, responsive admin navigation, cross-user access denial, and admin CLI dry-run/demotion/promotion.
- All 11 Firebase security tests passed. The new test permits each specified email with verified Google identity plus trusted role and claim; it denies other addresses, lookalike addresses, unverified identities, and password-provider sessions even when the admin claim and role exist.
- Mobile homepage screenshot inspected: signup entry point is visible beneath the primary actions.

Only local demo emulators were used. The two allowed email strings in test fixtures represent synthetic emulator identities; no real Google account was accessed. Live Google OAuth, provider/domain settings, Firebase rule deployment, and administrator provisioning still require the project owner's setup. Existing generated screenshots/logs remain excluded from source control.
