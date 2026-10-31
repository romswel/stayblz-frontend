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
Release this mock-stage bug-fix pass, then choose the next feature with the user.

## Maintenance
After meaningful work, update only the sections affected.
Record actual checks and their limits. Do not mark proposals as completed work.
Never include secrets, private data, or copied historical plans.
