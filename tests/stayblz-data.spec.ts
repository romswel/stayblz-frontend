import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow and paging, not the real backend or its data file.
const TRACKS = [
  { code: "CD", name: "Churchill Downs" },
  { code: "PRX", name: "Parx Racing" },
];
const races = Array.from({ length: 45 }, (_, i) => {
  const t = TRACKS[i % 2];
  return {
    race_id: `${t.code}-2026-11-18-R${i + 1}`,
    race_date: "2026-11-18",
    track_code: t.code,
    track_name: t.name,
    race_number: i + 1,
    race_name: i === 0 ? "Golden Mile Stakes" : "Claiming",
    race_type: "Claiming",
    distance: "Six Furlongs",
    surface: "Dirt",
    purse_usd: 25000,
    post_time: "1:00 PM",
    track_condition: null,
    entries_count: 2,
    race_cancelled: false,
    results_available: i === 0,
    winner_horse: i === 0 ? "Horse 1" : null,
    winner_jockey: i === 0 ? "J Rider" : null,
    winning_time: null,
  };
});
const horses = Array.from({ length: 45 }, (_, i) => ({
  horse_refno: String(1000 + i),
  horse_name: `Horse ${i + 1}`,
  starts: 3,
  wins: 1,
  best_speed_figure: 80 + i,
  last_start: { race_date: "2026-10-30", track_code: "CD", track_name: "Churchill Downs", finish_position: 2, speed_figure: 77 },
  workouts: 1,
  entered_race_ids: [races[i % races.length].race_id],
}));

async function mockData(page: Page) {
  const requests: string[] = [];
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: { id: "member", username: "member", displayName: "Racing Member", role: "member" } } });
    if (!path.startsWith("/api/stayblz-data")) return route.fulfill({ status: 403, json: { error: "Private workspace" } });
    requests.push(path + url.search);
    if (path === "/api/stayblz-data/meta")
      return route.fulfill({
        json: { race_date: "2026-11-18", source: "Equibase", races: 45, horses: 45, tracks: TRACKS.map((t) => ({ ...t, races: 22 })) },
      });
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const track = url.searchParams.get("track");
    const q = url.searchParams.get("q")?.toLowerCase();
    const pageOf = <T,>(rows: T[]) => ({
      records: rows.slice(offset, offset + limit),
      nextOffset: offset + limit < rows.length ? offset + limit : null,
      total: rows.length,
    });
    if (path === "/api/stayblz-data/races")
      return route.fulfill({ json: pageOf(races.filter((r) => (!track || r.track_code === track) && (!q || r.race_name.toLowerCase().includes(q)))) });
    if (path === "/api/stayblz-data/horses")
      return route.fulfill({ json: pageOf(horses.filter((h) => !q || h.horse_name.toLowerCase().includes(q))) });
    if (path === "/api/stayblz-data/races/CD-2026-11-18-R1")
      return route.fulfill({
        json: {
          ...races[0],
          age_sex_restriction: null,
          winner_trainer: "T Trainer",
          entries_detail: [
            { program_number: "1", post_position: "1", horse_name: "Horse 1", horse_refno: "1000", age_sex: "3/C", medication: null, claim_price_usd: null, jockey: "J Rider", trainer: "T Trainer", weight_lbs: 120, ml_odds: "2/1", live_odds: null, is_scratched: false, finish_position: 1 },
            { program_number: "2", post_position: "2", horse_name: "Horse 2", horse_refno: "1001", age_sex: "3/C", medication: null, claim_price_usd: null, jockey: "K Rider", trainer: "U Trainer", weight_lbs: 120, ml_odds: "5/1", live_odds: null, is_scratched: false, finish_position: 2 },
          ],
          payouts_by_horse: [{ finish_position: 1, program_number: "1", horse_name: "Horse 1", win_payout: 6.2, place_payout: 3.4, show_payout: 2.6 }],
          exotic_payouts_by_type: { exacta: { payoff: 21.4, raw_label: "$2 Exacta", winning_numbers: "1-2" } },
          entry_url: null,
          result_url: "https://www.equibase.com/",
        },
      });
    if (path === "/api/stayblz-data/horses/1000")
      return route.fulfill({
        json: {
          horse_refno: "1000",
          horse_name: "Horse 1",
          entered_race_ids: ["CD-2026-11-18-R1"],
          past_starts: [{ race_id: "CD-2026-10-30-R4", track_code: "CD", track_name: "Churchill Downs", race_date: "2026-10-30", race_number: 4, race_type: "Claiming", breed: "TB", finish_position: 2, speed_figure: 77 }],
          workouts: [],
          profile_url: null,
        },
      });
    return route.fulfill({ status: 404, json: { error: "Not found." } });
  });
  return requests;
}

test("Stayblz Data is in the Explore menu and pages races as you scroll", async ({ page }) => {
  const requests = await mockData(page);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Stayblz Data" }).first().click();
  await expect(page).toHaveURL(/\/stayblz-data$/);
  await expect(page.getByRole("heading", { name: /Stayblz Data/ })).toBeVisible();
  await expect(page.getByText("Showing 20 of 45 races")).toBeVisible();
  // Only the first page is fetched until the end of the list is near.
  expect(requests.some((r) => r.includes("offset=20"))).toBe(false);

  await page.getByRole("button", { name: "Load more races" }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Showing 40 of 45 races")).toBeVisible();
  await page.getByRole("button", { name: "Load more races" }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Showing 45 of 45 races")).toBeVisible();
  await expect(page.getByRole("button", { name: /Load more/ })).toHaveCount(0);
});

test("track filter and search reset the list, and details open", async ({ page }) => {
  const requests = await mockData(page);
  await page.goto("/stayblz-data");
  await expect(page.getByText("Showing 20 of 45 races")).toBeVisible();
  await page.getByRole("combobox", { name: "Track", exact: true }).selectOption("CD");
  await expect(page.getByText("Showing 20 of 23 races")).toBeVisible();
  expect(requests.some((r) => r.includes("track=CD") && r.includes("offset=0"))).toBe(true);

  await page.getByLabel("Search races").fill("golden");
  await expect(page.getByText("Showing 1 of 1 races")).toBeVisible();
  await page.getByRole("button", { name: /Golden Mile Stakes/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Golden Mile Stakes" })).toBeVisible();
  await expect(dialog.getByText("$2 Exacta")).toBeVisible();

  // From a race to one of its horses.
  await dialog.getByRole("button", { name: "Horse 1" }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Horse 1" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Past starts")).toBeVisible();
});

test("horses tab pages too and fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await mockData(page);
  await page.goto("/stayblz-data?tab=horses");
  await expect(page.getByText("Showing 20 of 45 horses")).toBeVisible();
  await page.getByRole("button", { name: "Load more horses" }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Showing 40 of 45 horses")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a failed load offers a retry", async ({ page }) => {
  await mockData(page);
  await page.route("**/api/stayblz-data/races?*", (route) => route.fulfill({ status: 503, json: { error: "Stayblz data is unavailable." } }));
  await page.goto("/stayblz-data");
  await expect(page.getByRole("alert")).toContainText("Stayblz data is unavailable.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
