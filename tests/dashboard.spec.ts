import { mockWorkspace } from "./workspace-fixture";
import { test, expect } from "@playwright/test";

const sections = {
  racecards: [
    {
      id: "r1",
      name: "Autumn Cup",
      track: "Test Park",
      date: "2026-11-03",
      race: "R4",
      time: "14:30",
      distance: "1600m",
      surface: "Turf",
      runners: 8,
    },
    {
      id: "r2",
      name: "Evening Sprint",
      track: "Second Park",
      race: "R6",
      time: "16:00",
      distance: "1200m",
      surface: "Dirt",
      runners: 7,
    },
  ],
  results: [
    {
      id: "result1",
      name: "Published Winner",
      track: "Test Park",
      race: "R2",
      time: "12:00",
      margin: "1 length",
    },
  ],
  workouts: [
    {
      id: "work1",
      name: "Morning Horse",
      track: "Test Park",
      time: "06:00",
      distance: "800m",
    },
  ],
  horses: [
    { id: "h1", name: "Form Leader", starts: 10, wins: 4, figure: 110 },
    { id: "h2", name: "Next Horse", starts: 5, wins: 1, figure: 98 },
  ],
  jockeys: [{ id: "j1", name: "Published Rider", starts: 20, wins: 5 }],
  trainers: [{ id: "t1", name: "Published Trainer", starts: 30, wins: 6 }],
  stakes: [
    {
      id: "s1",
      name: "Autumn Stakes",
      track: "Test Park",
      date: "2026-11-06",
      distance: "1800m",
      surface: "Turf",
    },
  ],
  notes: [
    {
      id: "n1",
      name: "Track notice",
      category: "Race day changes",
      summary: "Published update",
      body: "Complete published notice.",
    },
  ],
};
// ── FormFav US/Canada race data (dashboard overview) and "Your horses" ───────────────────────────────────────────────
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOffset = (n: number) => iso(new Date(Date.now() + n * 86_400_000));
const TODAY = dayOffset(0);
const YESTERDAY = dayOffset(-1);
const LONG_AGO = dayOffset(-9);
const raceRow = (o: Record<string, unknown>) => ({
  date: TODAY,
  code: "gallops",
  timezone: "America/New_York",
  country: "us",
  raceClass: null,
  distance: "1609m",
  startTime: new Date(Date.now() + 3_600_000).toISOString(),
  runners: 8,
  stakes: false,
  ...o,
});
const autumnMile = raceRow({ track: "Woodbine", slug: "woodbine", country: "ca", raceNumber: 5, raceName: "Autumn Mile", raceClass: "Stakes", stakes: true });
const eveningSprint = raceRow({ track: "Aqueduct", slug: "aqueduct", raceNumber: 2, raceName: "Evening Sprint", distance: "1207m" });
const gotham = {
  ...raceRow({ date: YESTERDAY, track: "Aqueduct", slug: "aqueduct", raceNumber: 8, raceName: "Gotham Stakes (G3)", stakes: true }),
  placings: [
    { position: 1, name: "Fast Fox", jockey: "J. Ortiz", trainer: "T. Pletcher" },
    { position: 2, name: "Slow Joe", jockey: "K. Lee", trainer: "B. Cox" },
    { position: 3, name: "Back Marker", jockey: "K. Lee", trainer: "B. Cox" },
  ],
};
const horseRow = (name: string, starts: number, wins: number, form: string) => ({
  name,
  code: "gallops",
  countries: ["us"],
  starts,
  wins,
  places: wins + 1,
  winRate: wins / starts,
  form,
  lastStart: null,
  nextEntry: null,
  jockey: "J. Ortiz",
  trainer: "T. Pletcher",
});
const person = (kind: "jockey" | "trainer", name: string, wins: number) => ({ kind, name, rides: 10, wins, places: wins + 2, winRate: wins / 10, upcoming: 1, tracks: 2, lastRide: YESTERDAY });
const overview = (track: string | null) => {
  const on = (r: { slug: string }) => !track || r.slug === track;
  return {
    today: TODAY,
    building: false,
    updatedAt: new Date().toISOString(),
    coverage: { from: dayOffset(-29), to: dayOffset(2) },
    tracks: [
      { slug: "aqueduct", name: "Aqueduct", country: "us", codes: ["gallops"] },
      { slug: "woodbine", name: "Woodbine", country: "ca", codes: ["gallops"] },
    ],
    counts: { meetingsToday: 2, racesToday: 18, resultsToday: 4, stakesAhead: 1 },
    upcoming: [eveningSprint, autumnMile].filter(on),
    results: [gotham].filter(on),
    stakes: { upcoming: [autumnMile].filter(on), results: [gotham].filter(on) },
    leaders: {
      horses: [horseRow("Fast Fox", 3, 2, "1-1-2"), horseRow("Slow Joe", 3, 1, "2-3-1")],
      jockeys: [person("jockey", "J. Ortiz", 6)],
      trainers: [person("trainer", "T. Pletcher", 5)],
    },
    inForm: [horseRow("Fast Fox", 3, 2, "1-1-2"), horseRow("Slow Joe", 3, 1, "2-3-1"), horseRow("Back Marker", 2, 0, "3-4"), horseRow("Fourth Horse", 4, 0, "3-5-6-2")],
  };
};
const start = (date: string, position: number, slug = "aqueduct", track = "Aqueduct") => ({ date, track, slug, position, raceNumber: 3, code: "gallops", country: "us", timezone: "America/New_York", fieldSize: 9 });
const raceWatch = {
  building: false,
  updatedAt: new Date().toISOString(),
  horses: [
    {
      key: "race:gallops|slow joe",
      name: "Slow Joe",
      linked: true,
      raceData: { name: "Slow Joe", code: "gallops" },
      coverImageId: null,
      lists: [{ kind: "stable", id: "v-team-joe", source: "formfav", stableId: "stable-1", stableName: "Bishop Racing" }],
      race: {
        starts: 3, wins: 1, places: 3, trainer: "B. Cox", jockey: "K. Lee",
        lastStart: start(YESTERDAY, 2),
        nextEntry: { date: TODAY, track: "Woodbine", slug: "woodbine", country: "ca", code: "gallops", timezone: "America/New_York", raceNumber: 5, startTime: autumnMile.startTime },
        recent: [{ date: YESTERDAY, position: 2, track: "Aqueduct", fieldSize: 9 }, { date: LONG_AGO, position: 3, track: "Aqueduct", fieldSize: 8 }],
      },
    },
    {
      key: "race:gallops|fast fox",
      name: "Fast Fox",
      linked: true,
      raceData: { name: "Fast Fox", code: "gallops" },
      coverImageId: null,
      lists: [{ kind: "personal", id: "v-mine-fox", source: "formfav" }],
      race: { starts: 3, wins: 2, places: 3, trainer: "T. Pletcher", jockey: "J. Ortiz", lastStart: start(YESTERDAY, 1), nextEntry: null, recent: [{ date: YESTERDAY, position: 1, track: "Aqueduct", fieldSize: 9 }] },
    },
    {
      key: "race:gallops|back marker",
      name: "Back Marker (mine)",
      linked: true,
      raceData: { name: "Back Marker", code: "gallops" },
      coverImageId: null,
      lists: [{ kind: "owned", id: "owned-back", role: "lead" }],
      race: { starts: 2, wins: 0, places: 1, trainer: "B. Cox", jockey: "K. Lee", lastStart: start(LONG_AGO, 7), nextEntry: null, recent: [{ date: LONG_AGO, position: 7, track: "Aqueduct", fieldSize: 9 }] },
    },
    {
      key: "owned:owned-yearling",
      name: "Yearling",
      linked: false,
      raceData: null,
      coverImageId: null,
      lists: [{ kind: "owned", id: "owned-yearling", role: "lead" }],
      race: null,
    },
  ],
};
const raceDetail = {
  form: { date: TODAY, track: "Woodbine", raceNumber: 5, raceName: "Autumn Mile", distance: "1609m", condition: null, weather: null, raceClass: "Stakes", abandoned: false, startTime: autumnMile.startTime, timezone: "America/New_York", prizeMoney: null, numberOfRunners: 2, runners: [] },
  predictions: null,
  results: null,
};
const overviewRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("stayblz.theme", "light"),
  );
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "member",
            username: "member",
            displayName: "Racing Member",
            role: "member",
          },
        },
      });
    if (path === "/api/stayblz-data/formfav/status") return route.fulfill({ json: { enabled: true } });
    if (path === "/api/stayblz-data/formfav/overview") {
      overviewRequests.push(route.request().url());
      return route.fulfill({ json: overview(new URL(route.request().url()).searchParams.get("track")) });
    }
    if (path === "/api/stayblz-data/formfav/race") return route.fulfill({ json: raceDetail });
    if (path === "/api/my-racing/race-watch") return route.fulfill({ json: raceWatch });
    if (path === "/api/public/racing-overview")
      return route.fulfill({
        json: { sections, fetchedAt: "2026-11-03T06:00:00Z" },
      });
    if (path.startsWith("/api/racing/published/"))
      return route.fulfill({
        json: {
          records:
            sections[path.split("/").pop() as keyof typeof sections] ?? [],
          nextOffset: null,
        },
      });
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
});

test("members get race data, Your horses, filtered tracks and race cards", async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/(feed|dashboard|messages|inventory|horses)(\/|$)/.test(
        new URL(r.url()).pathname,
      )
    ) {
      privateRequests.push(r.url());
      expect(r.headers()["x-stayblz-stable"]).toBeUndefined();
    }
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview." })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "US & Canada race data" }).first()).toBeVisible();
  await expect(page.locator(".gd-stat").filter({ hasText: "Races today" })).toContainText("18");
  await expect(page.locator(".gd-stat").filter({ hasText: "Top jockey" })).toContainText("J. Ortiz");
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Stayblz Chat", exact: true }),
  ).toBeVisible();

  const desk = page.locator("#racing-desk");
  await expect(desk.locator(".gd-feature")).toContainText("Next stakes race");
  await expect(desk.locator(".gd-feature")).toContainText("Autumn Mile");
  await expect(desk.getByRole("button", { name: /Evening Sprint/ })).toBeVisible();
  // The track filter is sent to the server.
  await page.getByRole("combobox", { name: "Filter overview by track" }).selectOption("woodbine");
  await expect(desk.getByRole("button", { name: /Evening Sprint/ })).toHaveCount(0);
  await expect.poll(() => overviewRequests.some((u) => new URL(u).searchParams.get("track") === "woodbine")).toBe(true);
  await desk.getByRole("button", { name: /Autumn Mile/ }).click();
  const dialog = page.getByRole("dialog", { name: "Woodbine race 5" });
  await expect(dialog).toContainText("Autumn Mile");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("combobox", { name: "Filter overview by track" }).selectOption("");

  await desk.getByRole("button", { name: "Results", exact: true }).click();
  await expect(desk.getByRole("button", { name: "Fast Fox", exact: true })).toBeVisible();
  await expect(desk).toContainText("Slow Joe · Back Marker");
  const leaders = page.locator("#leaderboard");
  await leaders.getByRole("button", { name: "Jockeys", exact: true }).click();
  await expect(leaders.getByRole("button", { name: /J\. Ortiz/ })).toBeVisible();
  await expect(page.locator("#in-form .gd-insight").first()).toContainText("Fast Fox");
  await expect(page.locator("#in-form .gd-form-list")).toContainText("Fourth Horse");
  await page.locator("#stakes").getByRole("button", { name: "Results", exact: true }).click();
  await expect(page.locator("#stakes")).toContainText("Gotham Stakes (G3)");

  await page.getByRole("combobox", { name: "Search members, horses and racing records" }).fill("Gotham");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(desk.getByRole("button", { name: /Gotham Stakes/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Stayblz Chat", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Stayblz Chat", exact: true }),
  ).toBeVisible();
  await expect.poll(() => privateRequests.length).toBeGreaterThan(0);
  for (const url of privateRequests)
    expect(new URL(url).pathname).not.toBe("/api/dashboard");
});

test("Your horses: entered first, result colours, New tag, filters and the right links", async ({ page }) => {
  await page.goto("/dashboard");
  const panel = page.locator("#your-horses");
  const rows = panel.locator(".gd-yh-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Slow Joe");
  const joe = rows.filter({ hasText: "Slow Joe" });
  await expect(joe).toHaveAttribute("data-finish", "place");
  await expect(joe.getByText("Entered", { exact: true })).toBeVisible();
  await expect(joe.getByText("New", { exact: true })).toBeVisible();
  await expect(joe).toContainText("Team · Bishop Racing");
  await expect(joe).toContainText("2nd of 9");
  await expect(joe.getByRole("link", { name: "Slow Joe" })).toHaveAttribute("href", "/workspace/virtual?stable=stable-1&horse=v-team-joe&vtab=racing");

  const fox = rows.filter({ hasText: "Fast Fox" });
  await expect(fox).toHaveAttribute("data-finish", "win");
  await expect(fox).toHaveClass(/is-win/);
  await expect(fox).toContainText("Won · 1st of 9");
  await expect(fox.getByText("Entered", { exact: true })).toHaveCount(0);
  await expect(fox.getByRole("link", { name: "Fast Fox" })).toHaveAttribute("href", "/my-racing?tab=virtual&horse=v-mine-fox&vtab=racing");

  const mine = rows.filter({ hasText: "Back Marker (mine)" });
  await expect(mine).toHaveAttribute("data-finish", "out");
  await expect(mine.getByText("New", { exact: true })).toHaveCount(0, { timeout: 1000 });
  await expect(mine.getByRole("link", { name: "Back Marker (mine)" })).toHaveAttribute("href", "/community/horses/owned-back");
  const yearling = rows.filter({ hasText: "Yearling" });
  await expect(yearling).toHaveAttribute("data-finish", "none");
  await expect(yearling.getByRole("link", { name: "Link it" })).toHaveAttribute("href", "/account/horses?edit=owned-yearling");

  // The colour is real: won = green, placed = gold (the theme's accent and warm tokens).
  const border = (loc: typeof rows) => loc.evaluate((el) => getComputedStyle(el).borderLeftColor);
  expect(await border(fox)).not.toBe(await border(joe));
  expect(await border(fox)).not.toBe(await border(mine));

  await panel.getByRole("button", { name: /^Entered/ }).click();
  await expect(rows).toHaveCount(1);
  await panel.getByRole("button", { name: /^My horses/ }).click();
  await expect(rows).toHaveCount(2);
  await panel.getByRole("button", { name: /^Tracked/ }).click();
  await expect(rows).toHaveCount(2);

  await joe.getByRole("button", { name: /Woodbine R5/ }).click();
  await expect(page.getByRole("dialog", { name: "Woodbine race 5" })).toBeVisible();
});

test("Entries & results shows 10 rows and See all opens the meetings for those days", async ({ page }) => {
  const many = Array.from({ length: 15 }, (_, i) =>
    raceRow({ track: "Aqueduct", slug: "aqueduct", raceNumber: i + 1, raceName: `Race Name ${i + 1}`, startTime: new Date(Date.now() + (i + 1) * 600_000).toISOString() }),
  );
  const results = Array.from({ length: 12 }, (_, i) => ({ ...gotham, raceNumber: i + 1, raceName: `Result Race ${i + 1}` }));
  await page.route("**/api/stayblz-data/formfav/overview*", (route) =>
    route.fulfill({ json: { ...overview(null), upcoming: many, results, stakes: { upcoming: many.map((r) => ({ ...r, stakes: true })), results } } }),
  );
  await page.goto("/dashboard");
  const desk = page.locator("#racing-desk");
  await expect(desk.locator("tbody tr")).toHaveCount(10);
  await expect(desk.getByRole("button", { name: /Race Name 10\b/ })).toBeVisible();
  await expect(desk.getByRole("button", { name: /Race Name 11\b/ })).toHaveCount(0);
  await expect(desk.locator(".gd-table-foot")).toContainText("Showing 10 next races");
  const all = desk.getByRole("link", { name: "See all entries" });
  await expect(all).toHaveAttribute("href", `/stayblz-data?from=${TODAY}&to=${dayOffset(2)}`);
  await expect(desk.getByRole("link", { name: "See all: Entries & results" })).toHaveAttribute("href", `/stayblz-data?from=${TODAY}&to=${dayOffset(2)}`);

  const stakes = page.locator("#stakes");
  await expect(stakes.locator("tbody tr")).toHaveCount(10);
  await expect(stakes.locator(".gd-table-foot")).toContainText("Showing 10 next stakes races");
  await expect(stakes.getByRole("link", { name: "See all stakes", exact: true })).toHaveAttribute("href", `/stayblz-data?from=${TODAY}&to=${dayOffset(2)}`);
  await stakes.getByRole("button", { name: "Results", exact: true }).click();
  await expect(stakes.locator("tbody tr")).toHaveCount(10);
  await expect(stakes.getByRole("link", { name: "See all stakes results" })).toHaveAttribute("href", `/stayblz-data?from=${dayOffset(-6)}&to=${TODAY}`);

  await desk.getByRole("button", { name: "Results", exact: true }).click();
  await expect(desk.locator("tbody tr")).toHaveCount(10);
  const allResults = desk.getByRole("link", { name: "See all results" });
  await expect(allResults).toHaveAttribute("href", `/stayblz-data?from=${dayOffset(-6)}&to=${TODAY}`);
  await allResults.click();
  await expect(page).toHaveURL(new RegExp(`/stayblz-data\\?from=${dayOffset(-6)}&to=${TODAY}$`));
});

test("Your horses shows an empty state with where to start, and its own error", async ({ page }) => {
  await page.route("**/api/my-racing/race-watch", (route) => route.fulfill({ json: { horses: [], building: false, updatedAt: null } }));
  await page.goto("/dashboard");
  const panel = page.locator("#your-horses");
  await expect(panel.getByRole("link", { name: "Find racing horses" })).toHaveAttribute("href", "/my-racing?tab=virtual&vtab=racing");
  await page.route("**/api/my-racing/race-watch", (route) => route.fulfill({ status: 503, json: { error: "Your racing notebook is temporarily unavailable. Please try again." } }));
  await page.reload();
  await expect(panel.locator(".gd-empty")).toContainText("temporarily unavailable");
  await expect(page.locator("#racing-desk").getByRole("button", { name: /Evening Sprint/ })).toBeVisible();
});

test("sidebar leaves out the racing pages and the PP menu", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(
    nav.getByRole("link", { name: "Following & notebook", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Overview",
    "Entries",
    "Results & Charts",
    "Workouts",
    "Speed Figures",
    "Statistics",
    "Stakes Schedule",
    "Past performances (PPs)",
  ])
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  await expect(nav.getByText("Racing", { exact: true })).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "Toggle PP menu" }),
  ).toHaveCount(0);
});

test("sidebar collapse persists, theme works and header actions are honest", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Shopping cart" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "checkout are not available yet",
  );
  await page.keyboard.press("Escape");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share overview" }).click();
  await expect(page.getByText("Overview link copied.")).toBeVisible();
});

test("race data: unavailable, still building, and keeps the last data after a failed refresh", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const desk = page.locator("#racing-desk");
  await expect(desk.getByRole("button", { name: /Evening Sprint/ })).toBeVisible();
  await page.route("**/api/stayblz-data/formfav/overview*", (route) =>
    route.fulfill({ status: 503, json: { error: "FormFav data isn't available right now." } }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".gd-toolbar .gd-status")).toContainText("Showing the last race data loaded.");
  await expect(desk.getByRole("button", { name: /Evening Sprint/ })).toBeVisible();
  await page.reload();
  await expect(page.locator(".gd-toolbar .gd-status")).toContainText("FormFav data isn't available right now.");
  await expect(desk).toContainText("Race data is unavailable");

  await page.route("**/api/stayblz-data/formfav/overview*", (route) =>
    route.fulfill({ json: { ...overview(null), building: true, upcoming: [], results: [] } }),
  );
  await page.reload();
  await expect(page.locator(".gd-toolbar")).toContainText("loading on the server for the first time");

  await page.route("**/api/stayblz-data/formfav/status", (route) => route.fulfill({ json: { enabled: false } }));
  await page.reload();
  await expect(page.locator(".gd-toolbar")).toContainText("Race data isn't available right now.");
  await expect(page.getByRole("heading", { name: "Entries & results", exact: true })).toBeVisible();
});

test("dashboard works across widths, themes, mobile navigation and reduced motion", async ({
  page,
}) => {
  // Eight full page loads on the dev server: more than the default 30 s budget.
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 640, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.locator("#your-horses .gd-yh-row").first()).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 375) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Navigation" });
      await expect(menu).toBeVisible();
      await menu.locator(".gx-workspace > summary").click();
      await menu.getByRole("link", { name: "Inventory", exact: true }).click();
      await expect(menu).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Inventory", exact: true }),
      ).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/dashboard");
  await expect(page.locator("#your-horses .gd-yh-row").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/dashboard");
  await expect(page.locator("#your-horses .gd-yh-row").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
});

test("admin stable summaries use stored records and keep working when one source fails", async ({
  page,
}) => {
  const mockCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/dashboard")
      mockCalls.push(request.url());
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: { id: "admin", displayName: "Stable Admin", role: "superadmin" },
      },
    }),
  );
  await page.route("**/api/inventory", (route) =>
    route.fulfill({ json: { items: [{ id: "stored-horse" }] } }),
  );
  await page.route("**/api/horses", (route) =>
    route.fulfill({
      json: {
        horses: [
          {
            id: "stored-horse",
            name: "Stored Horse",
            status: "Race ready",
            nextRace: "Published engagement",
          },
        ],
      },
    }),
  );
  await page.route("**/api/feed", (route) =>
    route.fulfill({
      json:
        route.request().method() === "POST"
          ? {
              post: {
                id: "p2",
                author: "Stable Admin",
                role: "superadmin",
                body: "Saved update",
                createdAt: "2026-11-03T00:00:00Z",
              },
            }
          : { posts: [] },
    }),
  );
  await page.route("**/api/team-messages", (route) =>
    route.fulfill({ status: 503, json: { error: "Messages unavailable" } }),
  );
  await page.goto("/workspace");
  const stable = page.locator("#stable-activity");
  await expect(stable.getByText("Stored Horse", { exact: true })).toBeVisible();
  await expect(
    stable
      .locator(".ov-stable-stats")
      .getByRole("link", { name: "1 Horses in stable" }),
  ).toBeVisible();
  await expect(
    stable.getByText("Messages could not be loaded.", { exact: true }),
  ).toBeVisible();
  await stable.getByLabel("Write a feed post").fill("Saved update");
  await stable.getByRole("button", { name: "Post", exact: true }).click();
  await expect(stable.getByLabel("Write a feed post")).toHaveValue("");
  await expect(stable.getByText("Saved update", { exact: true })).toBeVisible();
  expect(mockCalls).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-admin.png",
    fullPage: true,
  });
});

test.beforeEach(async ({ page }) => {
  await mockWorkspace(page);
});
