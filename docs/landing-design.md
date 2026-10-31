# Stayblz landing design

2026-11-01. Local design implementation; no publication or backend auth changes.

## Identity and direction

STAYBLZ — The Racing Ledger. Quote: “Know the horse. Read the race.”
New vector horse crest and wordmark, with a matching SVG favicon. Forest #142820, gold #C5A468, and paper #F4F0E6 come from the supplied palette. Serif editorial headlines, compact sans-serif data, restrained borders, and natural racing imagery make this an independent composition rather than a recreation of Equibase.

The public index, login, and sign-up share one page. Desktop has racing content on the left and the account card at upper right; narrow screens stack them. Header contains branding and account controls. Restored users see their name and a dashboard continuation. Protected views still require the existing session.

The racing desk supports cards/results/workouts and track filtering; leaderboard supports horses/jockeys/trainers. Published news expands in place. Full views focus the account card and preserve that destination through successful login.

Revised after user feedback: use the full viewport with fluid side gutters and remove promotional descriptions. Tables, side panels, and account cards have consistent heights within each breakpoint. Long records scroll inside panels; short/empty lists do not stretch their rows or collapse the panel. Switching account mode scrolls inside its card. Foreground refresh preserves records and table position if a request fails.

All racing records, horse summaries, statistics, tracks, stakes dates, and news now come from `GET /api/public/racing-overview`. The frontend sample file and arbitrary sample horse portrait were removed. Counts and win percentages derive from API records. The API reads explicitly published records from a dedicated Supabase table, never the existing backend mock arrays or private stable tables. Missing or unavailable data has an empty/error state, with no fixture fallback. It refreshes every minute while visible and when returning to the tab, with a manual retry.

The new database schema is prepared locally in the backend's `migrations/202611010001_site_racing_records.sql`; it has NOT been applied remotely. Your own public records still need to be stored/published after that setup. No live database/feed verification is claimed.

Motion includes a slow hero drift, scroll reveals, staggered table rows, tab indicators, loading/refresh feedback, and hover arrows. Reduced-motion users get static content.

Registration fields are a design preview with submission disabled, pending the next auth phase. Existing sign-in calls are preserved. Page-scoped styles preserve the authenticated app theme.

## Assets

- `src/components/Brand.tsx`: reusable, code-native SVG horse crest.
- `public/favicon.svg`: matching mark.
- `public/images/racing-editorial.jpg`: new generated hero, converted to JPEG for delivery (approximately 280 KB).

Hero created with the built-in imagegen tool. Final prompt:

> Use case: photorealistic-natural. Asset type: wide editorial horse racing photograph for the Stayblz racing overview website hero. Primary request: a believable candid sports photograph of a dark bay thoroughbred and jockey in muted forest-green silks galloping on a dirt racetrack in late afternoon. Landscape composition 3:2, full horse and rider framed in right two thirds, rail running horizontally in background, softly blurred dark trees and distant grandstand. Warm natural sunlight catching dust at hooves, deep forest shadows, subdued honey gold highlights. Realistic equine anatomy, documentary sports photography, natural imperfect dirt texture, 135mm lens and fast shutter, sophisticated understated equestrian magazine atmosphere. No text, no lettering, no logo, no watermarks, no graphic design. Not fantasy, not excessive sparks, not dramatic glowing CGI. This is illustrative racing photography rather than a named real horse or real event.

## Verification

- TypeScript and Vite production build.
- Chromium regression suite, including 8 landing interaction tests (14 tests total).
- Layout at 320/375/640/768/1024/1440/1920/2560 px in login and sign-up modes; page itself does not scroll horizontally, while data tables have their own labeled, keyboard-focusable scrollers.
- Screenshots inspected on desktop and mobile. Reduced-motion support disables entrance animations.
- Mocked API/session tests cover dynamic server records, derived counts, stable panel dimensions, filtering, empty/error/retry states, restored users, invalid login, destination continuation, and registration never posting credentials. Test fixture records only exist in tests.

These checks do not verify production authentication, account creation, a real racing feed, or physical devices. Those remain separate work.
