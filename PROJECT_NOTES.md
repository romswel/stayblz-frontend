# Stayblz project notebook

## Starting point
Fresh planning baseline: 2026-10-31.
We will build step by step. Previous plans and design decisions are not carried forward.
Existing application source remains in place; this setup does not rebuild the application.

## Agreed decisions
- Begin with only essential setup files.
- Decide architecture, data, theme, and UI/UX as the relevant work begins.

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

## Next agreed step
2026-11-01: User authorized the landing release. Added full-width layout, stable panel heights, published-data previews without fixtures, account handoff prompts, a logo hover animation, and a shared dark stylesheet toggled by the header logo. Production calls use the same-origin Vercel API proxy.
- Release checks: production build and 15 mocked-API Chromium tests passed; widths 320 through 2560 px and theme persistence were checked.
- Existing production admin login is retained. Verified signup/profile/password-reset code is prepared separately and will not replace production auth until SMTP, redirects, and admin setup are ready. Registration stays visibly unavailable in this release.
- Public-data storage SQL is a local draft, not applied. Unavailable/empty data does not use sample rows. No private rows were changed or exposed.

Finish SMTP/redirect configuration and the reviewed admin invitation before activating verified accounts. User explicitly authorized commit/push/deployment for this release; no force pushes or remote data deletion.

## Maintenance
After meaningful work, update only the sections affected.
Record actual checks and their limits. Do not mark proposals as completed work.
Never include secrets, private data, or copied historical plans.
