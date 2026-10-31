# Stayblz project notebook

## Starting point
Fresh planning baseline: 2026-10-31.
We will build step by step. Previous plans and design decisions are not carried forward.
Existing application source remains in place; this setup does not rebuild the application.

## Agreed decisions
- Begin with only essential setup files.
- Decide architecture, data, theme, and UI/UX as the relevant work begins.
- 2026-11-01: User requested a new public landing/login/sign-up design using forest green, warm gold, and cream, with racing summaries inspired by the supplied Equibase content reference. Design and interactions first; auth implementation follows separately.

## Verified implementation
2026-10-31: Audited the current mock app without changing its visual theme.
- Fixed empty racing-list loading states, stale conversation/horse-detail responses, duplicate watch toggles, and modal keyboard focus.
- Message history is read-only until a real send endpoint exists; removed misleading local-only sends.
- Feed failures now preserve drafts and show an error. API errors reject invalid JSON responses.
- Updated vulnerable dependencies; Node >=22.12.0 is required. Preserved the previous browser build targets.
- Validation: six Chromium regression tests with mocked APIs passed; mobile login widths 320/375/768/1440 were checked. Production build and npm audit passed with zero reported vulnerabilities.
- These checks do not verify real database behavior or real-device interaction.

## Lessons
Separate loading from empty data. Ignore late responses after a newer selection. Never imply a successful save without persistence.

2026-11-01: Implemented the public Racing Ledger landing at `/`, `/login`, and `/signup`.
- New horse crest, wordmark, matching favicon, generated racing hero, and quote “Know the horse. Read the race.”
- Account card at upper right on desktop, stacked on mobile. Existing sign-in retained; sign-up is explicitly an unconnected preview. Signed-in visitors can revisit the index and continue to the dashboard.
- Revised after feedback: full-width layout, plain labels, fixed panel/account heights per breakpoint with internal scrolling, and more motion (hero drift, scroll reveals, row/tab/hover/loading animations) with reduced-motion support.
- Removed all hardcoded racing previews, news, horse profiles, dates and statistics from the landing. It uses the backend public overview API, with dynamic track options and derived counts/win percentages. No mock fallback. Empty/error/retry states reserve panel dimensions; foreground refresh preserves loaded data on failure.
- Backend now has a public API reading only published records from `site_racing_records`; its migration is LOCAL ONLY, not applied. No remote schema/data changes. Until that store is created and populated, data remains unavailable/empty. Existing authenticated racing routes still use their old mock data and are outside this landing pass.
- Page-scoped theme preserves the dashboard and existing auth. Asset provenance and prompt are recorded in `docs/landing-design.md`.
- Validation covers 14 mocked-API Chromium tests, 10 stubbed backend tests, TypeScript/Vite builds, and widths 320/375/640/768/1024/1440/1920/2560. No real database, auth, feed, or physical-device verification is claimed.
- Hidden absolute table labels need a positioned scroll container to avoid widening the page on small screens.

## Next agreed step
2026-11-01: User explicitly authorized auditing, fixes, commit/push and production release. Landing/API commits `f27fe15` / `bfe7f77` were pushed and verified on Vercel/backend health; the current admin login was retained during SMTP setup.
- Added explicit login/signup gating with destination continuation, a logo hover Easter egg, and a shared dark stylesheet toggled from the header. Theme preference persists; no animation dependency added.
- Implemented Supabase signup with first/last name, country, racing role, email and strong password confirmation; confirmation/resend/recovery, own-profile editing, HttpOnly cookie sessions through the same-origin proxy, and member published-record views. The server controls permissions, and new members cannot access shared stable tables.
- Fixed late pagination overwriting a different category, malformed full-view response crashes, logout failure reporting, and session-restore races. Production credentials are not saved in localStorage.
- User confirmed SMTP and provider redirect URLs are ready. Next: deploy the reviewed account changes, send the authorized admin invitation, and verify account setup. No personal email/password is recorded in this notebook. No remote schema changes or data deletion occurred.

Public-data table application/content publishing remains separate. Do not claim SMTP inbox delivery, admin activation, or actual production account QA until verified.

## Maintenance
After meaningful work, update only the sections affected.
Record actual checks and their limits. Do not mark proposals as completed work.
Never include secrets, private data, or copied historical plans.
