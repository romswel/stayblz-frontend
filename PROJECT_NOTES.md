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

Follow-up account release `0bb6780` was pushed and Vercel reported success. Live Chromium checks verified signup fields, shared theme switching, preserved View All prompts across login/signup, no mobile overflow at 375 px, no browser exceptions, and the same-origin API proxy. Final local checks: 25 browser tests and production build passed; npm audit reported zero vulnerabilities.

The matching backend account release is live. The admin invitation was accepted by the provider and the user confirmed inbox receipt; password setup/email activation is still the user's next step, not yet verified. Do not record personal email/password here. Public-data table application/content publishing remains separate and unapplied; no sample data is shown.

## Maintenance
2026-11-01: User authorized review and production push from the original repositories without backups/worktrees. Reviewed every changed/untracked file, fixed query-only provider callback errors, and added HTTP-date Retry-After handling. Release validation: 33 Chromium tests, TypeScript/Vite build, diff checks, and npm audit (zero vulnerabilities) passed. Credential-pattern scan found no embedded credentials in release files. Production must be checked against the pushed commit/assets; real verified login/logout and completed recovery remain outside the automated evidence.

2026-11-01: Expanded the confirmation/recovery page into a full-width photo/status layout with larger type and controls, animated status icons, mobile stacking, and reduced-motion support. Existing confirmation and password behavior is preserved. All 31 browser tests and the production build passed; inspected desktop/mobile screenshots and checked overflow at widths 320/375/768/1024/1440/2560.
- Removed the obsolete .release/frontend Git worktree after checking it was clean, had no unique commits, and was already an ancestor of main. All current work remains in the original stayblz-frontend repository. Fetch confirmed main matches origin/main; no pull/merge was needed. No commits, pushes, or deployments in this pass.

2026-11-01: Local-only email verification follow-up. The latest user instruction supersedes the earlier SMTP-ready assumption: use the existing Supabase built-in sender for authorized organization testing; no provider configuration or deployment changes.
- Added safe delivery/recipient/rate error handling, Retry-After cooldowns based on elapsed time, and expired provider-link handling with URL cleanup. Email throttling does not disable verified password login, and resend uses the currently entered recipient.
- Validation: all 30 browser tests passed, including mocked signup/resend/recovery/callback cases; TypeScript/Vite production build and diff checks passed.
- A separate authorized real signup was accepted (202); unverified login was denied (403) and private access denied (401). The owner subsequently completed the real email link, and a read-only provider lookup confirmed verification. One real recovery request returned 429 over_email_send_rate_limit with the safe error message; no retries. Live verified password login/logout and completed recovery remain unverified. No admin account password/profile was changed. Changes remain uncommitted and unpushed.

After meaningful work, update only the sections affected.
Record actual checks and their limits. Do not mark proposals as completed work.
Never include secrets, private data, or copied historical plans.
