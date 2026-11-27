import { test, expect, type Page } from "@playwright/test";

// Older horses and people (not in the last 30 days of US/Canada race data): the Stayblz race history first, then
// FormFav's search. Every API is mocked: these tests prove the page flow, not the real backend or FormFav itself.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const OLD = iso(new Date(Date.now() - 40 * 86_400_000));
const listMeta = { building: false, updatedAt: new Date().toISOString(), coverage: { from: OLD, to: OLD } };
const empty = { ...listMeta, records: [], nextOffset: null, total: 0 };

const kissin = {
  kind: "horse",
  key: "gallops|kissin perfect",
  name: "Kissin Perfect",
  code: "gallops",
  lastDate: "2026-01-12",
  starts: null,
  runnerId: 315182,
  country: "USA",
  sire: "Kiss My Hocks",
  dam: "Perfect Practice",
  source: "formfav",
  countryConfirmed: true,
};
const oldTimer = { kind: "horse", key: "gallops|old timer", name: "Old Timer", code: "gallops", lastDate: OLD, starts: 1, wins: 1, places: 1, source: "history", countryConfirmed: true };
const oldTimerDetail = {
  name: "Old Timer",
  code: "gallops",
  countries: ["us"],
  starts: 0,
  wins: 0,
  places: 0,
  lastStart: { date: OLD, track: "Aqueduct", slug: "aqueduct", position: 1, raceNumber: 7, code: "gallops", country: "us", timezone: "America/New_York", fieldSize: 8 },
  nextEntry: null,
  jockey: "Old Jockey",
  trainer: "Old Trainer",
  history: [{ date: OLD, code: "gallops", timezone: "America/New_York", track: "Aqueduct", slug: "aqueduct", country: "us", raceNumber: 7, raceName: "Old Stakes", startTime: `${OLD}T20:00:00Z`, status: "final", position: 1, fieldSize: 8, scratched: false, jockey: "Old Jockey", trainer: "Old Trainer" }],
  inWindow: false,
  archive: { since: "2026-10-26", starts: 1, wins: 1, places: 1 },
};
const noStats = (name: string, extra: Record<string, unknown>) => ({
  kind: "jockey",
  name,
  raceCode: null,
  totalStarts: null,
  totalWins: null,
  winRate: null,
  placeRate: null,
  ambiguous: false,
  bestCondition: null,
  worstCondition: null,
  tracks: null,
  conditions: null,
  noStats: true,
  ...extra,
});

async function mock(page: Page) {
  const requests: string[] = [];
  const posted: unknown[] = [];
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requests.push(path + url.search);
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: "member", username: "member", displayName: "Racing Member", role: "member" } } });
    const ff = "/api/stayblz-data/formfav";
    if (path === `${ff}/status`) return route.fulfill({ json: { enabled: true } });
    if (path === `${ff}/horses` || path === `${ff}/people`) return route.fulfill({ json: empty });
    if (path === `${ff}/older`) {
      const kind = url.searchParams.get("kind");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const records =
        kind === "horse"
          ? [kissin, oldTimer].filter((h) => h.name.toLowerCase().includes(q))
          : [
              { kind, key: "jesus canales", name: "Jesus Canales", lastDate: null, rides: 6, source: "formfav", countryConfirmed: false },
              { kind, key: "old jockey", name: "Old Jockey", lastDate: OLD, rides: 1, wins: 1, source: "history", countryConfirmed: true },
            ].filter((p) => p.name.toLowerCase().includes(q));
      return route.fulfill({ json: { query: q, records } });
    }
    if (path === `${ff}/horse` && url.searchParams.get("name") === "Old Timer") return route.fulfill({ json: oldTimerDetail });
    if (path === `${ff}/runner/315182`)
      return route.fulfill({
        json: { runner: { name: "Kissin Perfect", country: "USA" }, career: { totalStarts: 9, wins: 2, seconds: 1, thirds: 1, winRate: 0.22, placeRate: 0.44 }, distances: [], conditions: [], venues: [], spells: [], jockeys: [], classProfile: null, runningStyle: null, formTrend: null, trialForm: null, sire: null },
      });
    if (path === `${ff}/jockey/Jesus%20Canales`)
      return url.searchParams.get("older") === "1"
        ? route.fulfill({ json: noStats("Jesus Canales", { countryConfirmed: false, history: null }) })
        : route.fulfill({ status: 404, json: { error: "Not found." } });
    if (path === `${ff}/jockey/Old%20Jockey`)
      return route.fulfill({ json: noStats("Old Jockey", { countryConfirmed: true, history: { name: "Old Jockey", rides: 1, wins: 1, places: 1, tracks: 1, firstRide: OLD, lastRide: OLD } }) });
    if (path === "/api/my-racing/virtual/state") return route.fulfill({ json: { added: false, id: null } });
    if (path === "/api/my-racing/virtual" && route.request().method() === "POST") {
      posted.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { horse: { id: "v-kiss", name: "Kissin Perfect" } } });
    }
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
  return { requests, posted };
}

test("Horses: an older FormFav horse shows its profile and career, and can be tracked by its runner id", async ({ page }) => {
  const { requests, posted } = await mock(page);
  await page.goto("/stayblz-data?tab=horses");
  await page.getByLabel("Search horses").fill("kissin");
  const older = page.getByRole("region", { name: "Older horses" });
  await expect(older.getByRole("button", { name: /Kissin Perfect/ })).toBeVisible();
  await expect(older).toContainText("FormFav profile");
  await expect(older).toContainText("Kiss My Hocks – Perfect Practice");
  await expect(page.getByText("Older horses are listed below.")).toBeVisible();
  expect(requests.some((r) => r.startsWith("/api/stayblz-data/formfav/older?kind=horse&q=kissin&codes=gallops%2Charness"))).toBe(true);

  await older.getByRole("button", { name: /Kissin Perfect/ }).click();
  const dialog = page.getByRole("dialog", { name: "Kissin Perfect" });
  await expect(dialog.getByRole("heading", { name: "Kissin Perfect", level: 2 })).toBeVisible();
  await expect(dialog).toContainText("Last raced");
  await expect(dialog).toContainText("By Kiss My Hocks out of Perfect Practice");
  await expect(dialog.getByText("9 starts", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Track in Virtual Stayblz" }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText("Added ✓")).toBeVisible();
  expect(posted).toEqual([{ source: "formfav", formfavName: "Kissin Perfect", formfavCode: "gallops", formfavRunnerId: 315182 }]);
});

test("Horses: a horse from the Stayblz history opens with its stored runs", async ({ page }) => {
  const { requests } = await mock(page);
  await page.goto("/stayblz-data?tab=horses");
  await page.getByLabel("Search horses").fill("old t");
  const older = page.getByRole("region", { name: "Older horses" });
  await expect(older).toContainText("Stayblz history");
  await older.getByRole("button", { name: /Old Timer/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Old Timer", level: 2 }).first()).toBeVisible();
  expect(requests.some((r) => r.startsWith("/api/stayblz-data/formfav/horse?") && new URLSearchParams(r.split("?")[1]).get("name") === "Old Timer")).toBe(true);
  await expect(dialog).toContainText("Not raced in the US or Canada in the last 30 days");
  await expect(dialog).toContainText("Stayblz history since");
  await expect(dialog.getByRole("row").nth(1)).toContainText("1st");
});

test("Stats: older jockeys, one only FormFav knows (country not confirmed, no stats) and one from the history", async ({ page }) => {
  const { requests } = await mock(page);
  await page.goto("/stayblz-data?tab=stats");
  await page.getByLabel("Search jockeys").fill("canales");
  const older = page.getByRole("region", { name: "Older jockeys and drivers" });
  await expect(older).toContainText("country not confirmed");
  await older.getByRole("button", { name: /Jesus Canales/ }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText("FormFav doesn't confirm where this person rides")).toBeVisible();
  await expect(dialog.getByText("FormFav has no career stats for this person.")).toBeVisible();
  expect(requests).toContain("/api/stayblz-data/formfav/jockey/Jesus%20Canales?older=1");
  await page.keyboard.press("Escape");

  await page.getByLabel("Search jockeys").fill("old j");
  await older.getByRole("button", { name: /Old Jockey/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Stayblz history (US & Canada)" })).toBeVisible();
  await expect(dialog.getByText("FormFav doesn't confirm where this person rides")).toHaveCount(0);
  expect(requests).toContain("/api/stayblz-data/formfav/jockey/Old%20Jockey");
});

test("older results fit a phone and a desktop in both themes", async ({ page }) => {
  await mock(page);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/stayblz-data?tab=horses");
    await page.getByLabel("Search horses").fill("i");
    await page.getByLabel("Search horses").fill("ti");
    await page.getByLabel("Search horses").fill("tim");
    await expect(page.getByRole("region", { name: "Older horses" }).getByRole("button", { name: /Old Timer/ })).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${theme}`).toBe(true);
      if (width !== 320) await page.screenshot({ path: `test-results/stayblz-data-older-${width}-${theme}.png`, fullPage: true });
    }
  }
});
