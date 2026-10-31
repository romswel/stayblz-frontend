# Landing release

This release includes the full-width landing, consistent panel sizes, public-data API client, login/sign-up handoff messages, logo hover animation, and persistent shared theme stylesheet. Header-logo activation toggles the theme; reduced-motion settings are respected. No animation framework is added.

The initial landing deployment retained the current admin login while SMTP was pending. The follow-up account release adds Supabase verified signup, profile persistence, confirmation/recovery, and same-origin HttpOnly sessions after the user confirmed SMTP and redirect configuration. The admin is migrated by invitation without deleting stable records; its username remains `superadmin`. The invitation requires email verification and a strong password before stable access is enabled.

Production API traffic uses the Vercel same-origin proxy to the existing backend. The public overview reads only explicitly published database records, never sample arrays or private stable data. The prepared database migration is not applied; missing records produce an honest empty/unavailable state.

Validation: TypeScript/Vite build, Chromium interaction/regression tests, dependency audits, and desktop/mobile layouts. Production validation is recorded separately after deployment; local tests do not prove email delivery or database setup.
