import { test, expect, type Page } from "@playwright/test";

// Fictional fixture data for mocked API responses only.
const member = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "member@example.test",
  displayName: "Member User",
  role: "member",
  platformRole: "member",
  actingRole: null,
  email: "member@example.test",
  emailVerified: true,
  mfa: { enabled: false, verified: false },
  profile: { firstName: "Member", lastName: "User", country: "PH", racingRole: "fan", communityRoles: [], organisation: "", city: "", bio: "" },
  preferences: { marketingOptIn: false, updatesSeenAt: "2099-01-01T00:00:00Z", updatesPopup: false },
};
const admin = { ...member, role: "admin", platformRole: "admin" };
const DATE = "2099-05-01";
const track = { id: "t0000000-0000-4000-8000-000000000001", code: "TP", name: "Test Park", country: "US", region: "", breed: "thoroughbred" };
const person = (id: string, name: string, kind: string) => ({ id, name, kind });
const horse = (id: string, name: string) => ({ id, name, country: "", foaled: null, sex: "", color: "", sire: "Fixture Sire", dam: "Fixture Dam", damSire: "", breeder: "", breed: "thoroughbred" });
const runner = (n: number, name: string, finish: number | null) => ({
  id: `r000000${n}-0000-4000-8000-000000000000`,
  program: String(n),
  post: n,
  horse: horse(`h000000${n}-0000-4000-8000-000000000000`, name),
  jockey: person(`p000000${n}-0000-4000-8000-000000000000`, `Rider ${n}`, "jockey"),
  trainer: person("p0000009-0000-4000-8000-000000000000", "Tess Trainer", "trainer"),
  owner: null,
  weight: 122,
  medication: "L",
  equipment: "",
  morningLine: "5-2",
  scratched: false,
  scratchReason: "",
  ...(finish !== null ? { finish, lengths: finish === 2 ? 1.5 : null, odds: finish === 1 ? 4.2 : 8, earnings: 0, comment: "" } : {}),
});
const race = (number: number, status: "scheduled" | "official") => ({
  id: `a000000${number}-0000-4000-8000-000000000000`,
  number,
  postTime: number === 1 ? "13:00" : "13:30",
  name: number === 2 ? "Fixture Stakes" : "",
  type: number === 2 ? "stakes" : "maiden",
  grade: number === 2 ? 2 : null,
  breed: "thoroughbred",
  distance: "6 f",
  distanceValue: 6,
  distanceUnit: "furlongs",
  surface: "dirt",
  condition: status === "official" ? "fast" : "",
  purse: 50000,
  currency: "USD",
  conditions: "",
  status,
  winningTime: status === "official" ? "1:10.45" : "",
  payouts: status === "official" ? [{ pool: "Win", combination: "1", amount: 10.4 }] : [],
  footnotes: "",
  runnerCount: 2,
  runners: [runner(1, "Alpha Fixture", status === "official" ? 1 : null), runner(2, "Beta Fixture", status === "official" ? 2 : null)],
});
const day = { id: "d0000000-0000-4000-8000-000000000001", date: DATE, status: "published", notes: "", track, races: [race(1, "official"), race(2, "scheduled")] };

async function api(page: Page, me: Record<string, unknown>, extra?: (path: string, route: import("@playwright/test").Route) => unknown) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const handled = extra?.(path, route);
    if (handled) return handled;
    if (path === "/api/auth/me" || path === "/api/auth/refresh") return route.fulfill({ json: { user: me } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/updates") return route.fulfill({ json: { updates: [], pinned: [], hasMore: false } });
    if (path === "/api/public/racing/calendar") return route.fulfill({ json: { days: [{ date: DATE, tracks: 1, races: 2, official: 1 }] } });
    if (path === "/api/public/racing/days")
      return route.fulfill({
        json: {
          days:
            url.searchParams.get("date") === DATE
              ? [{ id: day.id, date: DATE, notes: "", track, races: 2, official: 1, stakes: 1, firstPost: "13:00", raceList: day.races.map(({ runners: _r, ...r }) => ({ ...r, winner: r.status === "official" ? { horse: "Alpha Fixture", horseId: "h0000001-0000-4000-8000-000000000000", odds: 4.2 } : null })) }]
              : [],
        },
      });
    if (path === `/api/public/racing/days/${day.id}`) return route.fulfill({ json: { day } });
    if (path === `/api/public/racing/races/${day.races[0].id}`)
      return route.fulfill({ json: { race: day.races[0], day: { id: day.id, date: DATE }, track, previous: null, next: { id: day.races[1].id, number: 2 } } });
    if (path === "/api/public/racing/horses/h0000001-0000-4000-8000-000000000000")
      return route.fulfill({
        json: {
          horse: horse("h0000001-0000-4000-8000-000000000000", "Alpha Fixture"),
          stats: { starts: 1, wins: 1, places: 0, shows: 0, earnings: 30000 },
          starts: [{ runnerId: "x", raceId: day.races[0].id, dayId: day.id, date: DATE, track: "Test Park", trackCode: "TP", race: 1, raceName: "", type: "maiden", grade: null, status: "official", distance: "6 f", surface: "dirt", horse: { id: "h0000001-0000-4000-8000-000000000000", name: "Alpha Fixture" }, jockey: person("p0000001-0000-4000-8000-000000000000", "Rider 1", "jockey"), trainer: null, owner: null, program: "1", scratched: false, finish: 1, lengths: null, odds: 4.2, earnings: 30000, field: 2 }],
          workouts: [],
        },
      });
    if (path.startsWith("/api/public/racing/")) return route.fulfill({ status: 404, json: { error: "That isn't published on Stayblz." } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
}

test("entries list cards by date and lead to the card, race chart and horse page", async ({ page }) => {
  await api(page, member);
  await page.goto(`/entries?date=2099-04-30`);
  await expect(page.getByRole("heading", { name: /No racing published/ })).toBeVisible();
  await page.getByRole("button", { name: /Saturday|Friday|May 1|1 May/ }).last().click();
  await expect(page).toHaveURL(new RegExp(`date=${DATE}`));
  await expect(page.getByRole("link", { name: "Test Park" })).toBeVisible();
  await expect(page.getByText("1st Alpha Fixture")).toBeVisible();
  await expect(page.locator(".rc-badge", { hasText: "Stakes" })).toBeVisible();
  await page.getByRole("link", { name: "Full card" }).click();
  await expect(page.getByRole("heading", { name: "Test Park", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Race 2 · Fixture Stakes" })).toBeVisible();
  await page.getByRole("button", { name: "R1 (official)" }).click();
  await expect(page.getByRole("cell", { name: "1st" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "4.2-1" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Win 1 10.40/ })).toBeVisible();
  await page.getByRole("link", { name: "Alpha Fixture" }).first().click();
  await expect(page.getByRole("heading", { name: "Alpha Fixture", level: 1 })).toBeVisible();
  await expect(page.getByText("Fixture Sire")).toBeVisible();
  await expect(page.getByRole("term").filter({ hasText: "Win rate" })).toBeVisible();
});

test("results only list official races; unpublished pages say so plainly", async ({ page }) => {
  await api(page, member);
  await page.goto(`/results?date=${DATE}`);
  await expect(page.getByText("1st Alpha Fixture")).toBeVisible();
  await expect(page.getByText("Fixture Stakes")).toHaveCount(0);
  await page.goto("/racing/horses/00000000-0000-4000-8000-00000000dead");
  await expect(page.getByRole("heading", { name: "That horse isn't on Stayblz yet" })).toBeVisible();
  await page.goto("/speed-figures");
  await expect(page.getByRole("heading", { name: "Speed figures aren't available yet" })).toBeVisible();
});

test("racing pages fit a phone in both themes", async ({ page }) => {
  await api(page, member);
  await page.setViewportSize({ width: 320, height: 760 });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
    for (const path of [`/entries?date=${DATE}`, `/racing/days/${day.id}`, `/racing/races/${day.races[0].id}`, "/statistics", "/stakes", "/workouts"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${theme} ${path}`).toBeLessThanOrEqual(1);
    }
  }
});

test("only admins see the publishing tool; admins import, publish and enter results", async ({ page }) => {
  await api(page, member);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Publish racing" })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  let draft = { ...day, status: "draft", races: [] as ReturnType<typeof race>[] };
  const sent: Record<string, unknown> = {};
  await api(page, admin, (path, route) => {
    const method = route.request().method();
    if (path === "/api/admin/racing/tracks") return route.fulfill({ json: { tracks: [track] } });
    if (path === "/api/admin/racing/days" && method === "GET") return route.fulfill({ json: { days: [] } });
    if (path === "/api/admin/racing/days" && method === "POST") {
      sent.day = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { day: draft } });
    }
    if (path === `/api/admin/racing/days/${day.id}` && method === "GET") return route.fulfill({ json: { day: draft } });
    if (path === `/api/admin/racing/days/${day.id}/import`) {
      sent.import = route.request().postDataJSON();
      draft = { ...draft, races: [race(1, "scheduled")] };
      return route.fulfill({ json: { day: draft, summary: { runners: 2, racesCreated: 1, horsesCreated: 2, peopleCreated: 3 } } });
    }
    if (path === `/api/admin/racing/days/${day.id}/publish`) {
      draft = { ...draft, status: "published" };
      return route.fulfill({ json: { day: draft } });
    }
    if (path === `/api/admin/racing/races/${day.races[0].id}/results`) {
      sent.results = route.request().postDataJSON();
      draft = { ...draft, races: [race(1, "official")] };
      return route.fulfill({ json: { day: draft } });
    }
    return undefined;
  });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Publish racing" }).click();
  await expect(page.getByRole("heading", { name: "Publish racing", level: 1 })).toBeVisible();
  await page.getByRole("combobox", { name: "Track" }).selectOption({ label: "Test Park (TP)" });
  await page.getByLabel("Date", { exact: true }).fill(DATE);
  await page.getByRole("button", { name: "Create and open" }).click();
  expect(sent.day).toEqual({ trackId: track.id, date: DATE });
  await expect(page.getByRole("heading", { name: /Test Park/, level: 1 })).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  await page.getByLabel("Or paste rows").fill(
    'Race,Pgm,Horse Name,Jockey,Trainer,ML,Notes\n1,1,Alpha Fixture,Rider 1,Tess Trainer,5-2,ignored\n1,2,"Beta, Fixture",Rider 2,Tess Trainer,3-1,',
  );
  await expect(page.getByText(/2 runners ready · ignoring column: Notes/)).toBeVisible();
  await page.getByRole("button", { name: "Import 2 runners" }).click();
  await expect(page.getByText("Imported 2 runners: 1 new races, 2 new horses, 3 new people.")).toBeVisible();
  await expect(page.getByRole("form", { name: "Add a race" }).getByLabel("Race number")).toHaveValue("2");
  expect(sent.import).toEqual({
    rows: [
      { race: "1", program: "1", horse: "Alpha Fixture", jockey: "Rider 1", trainer: "Tess Trainer", ml: "5-2" },
      { race: "1", program: "2", horse: "Beta, Fixture", jockey: "Rider 2", trainer: "Tess Trainer", ml: "3-1" },
    ],
  });

  await page.getByRole("button", { name: "Publish race day" }).click();
  // Publishing makes the card public, so it asks first.
  await page
    .getByRole("alertdialog", { name: "Publish this race day?" })
    .getByRole("button", { name: "Publish race day" })
    .click();
  await expect(page.getByText("Published. The card is live on Entries.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View public card" })).toBeVisible();

  await page.getByRole("button", { name: "Results" }).click();
  await page.getByLabel("Finish for Alpha Fixture").fill("1");
  await page.getByLabel("Finish for Beta Fixture").fill("2");
  await page.getByLabel("Odds for Alpha Fixture").fill("4.2");
  await page.getByLabel("Amount 1").fill("10.40");
  await page.getByLabel("Combination 1").fill("1");
  await page.getByRole("button", { name: "Save results" }).click();
  await expect(page.getByText("Results saved. The race is official.")).toBeVisible();
  expect(sent.results).toMatchObject({
    status: "official",
    payouts: [{ pool: "Win", combination: "1", amount: "10.40" }],
    runners: [
      { id: "r0000001-0000-4000-8000-000000000000", finish: "1", odds: "4.2" },
      { id: "r0000002-0000-4000-8000-000000000000", finish: "2" },
    ],
  });
});
