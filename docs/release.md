# Landing release

This release includes the full-width landing, consistent panel sizes, public-data API client, login/sign-up handoff messages, logo hover animation, and persistent shared theme stylesheet. Header-logo activation toggles the theme; reduced-motion settings are respected. No animation framework is added.

The current admin sign-in behavior remains in production. The new verified-account implementation is a separate local change and is not activated in this release. Signup remains visibly unavailable until custom SMTP, provider redirects, and the admin invitation are configured. Publishing this landing does not migrate, delete, reset, or expose existing stable records.

Production API traffic uses the Vercel same-origin proxy to the existing backend. The public overview reads only explicitly published database records, never sample arrays or private stable data. The prepared database migration is not applied; missing records produce an honest empty/unavailable state.

Validation: TypeScript/Vite build, Chromium interaction/regression tests, dependency audits, and desktop/mobile layouts. Production validation is recorded separately after deployment; local tests do not prove email delivery or database setup.
