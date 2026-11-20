import { test, expect, type Page } from "@playwright/test";

// Fictional fixture data for mocked API responses only.
const member = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "admin@example.test",
  displayName: "Admin User",
  role: "admin",
  platformRole: "admin",
  actingRole: null,
  email: "admin@example.test",
  emailVerified: true,
  mfa: { enabled: false, verified: false },
  profile: { firstName: "Admin", lastName: "User", country: "PH", racingRole: "fan", communityRoles: [], organisation: "", city: "", bio: "" },
  preferences: { marketingOptIn: false, updatesSeenAt: "2099-01-01T00:00:00Z", updatesPopup: false },
};
const H = "h0000001-0000-4000-8000-000000000000";
const DAY = "d0000000-0000-4000-8000-000000000001";
const track = { id: "t1", code: "FXD", name: "Fixture Downs", country: "US", region: "", breed: "thoroughbred" };

const job = (done: boolean) => ({
  id: "job1", kind: "days", by: "admin", dates: ["2099-06-08"], startedAt: "2099-06-08T12:00:00Z",
  finishedAt: done ? "2099-06-08T12:00:20Z" : null, done: done ? 2 : 0, total: 2,
  days: done ? [{ date: "2099-06-08", cards: 6, imported: 6, failed: 0, races: 50, runners: 573, officialRaces: 12, published: true }] : [],
  histories: done ? { horses: 100, starts: 1400 } : null, error: null,
});

async function mock(page: Page, { licensed = false, configured = true } = {}) {
  const imports: unknown[] = [];
  const pulls: unknown[] = [];
  let polls = 0;
  await page.route("**/api/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh") return route.fulfill({ json: { user: member } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/admin/racing/tracks") return route.fulfill({ json: { tracks: [track] } });
    if (path === "/api/admin/racing/feed")
      return route.fulfill({
        json: {
          licensed,
          licences: { equibase: licensed, theracingapi: true },
          provider: { name: "The Racing API", configured, connected: configured, northAmerica: false, error: null, checkedAt: "2099-06-08T11:00:00Z" },
          schedule: { on: configured, everyMinutes: 20 },
          // After a pull starts, the first poll sees it running and the next one sees it finished.
          pull: pulls.length ? (polls++ < 1 ? { running: job(false), recent: [] } : { running: null, recent: [job(true)] }) : { running: null, recent: [] },
          today: "2099-06-08",
          recent: imports.length
            ? [{ id: "run1", source: "equibase", track: "FXD", date: "2099-06-08", dayId: DAY, at: "2099-06-08T12:00:00Z", by: "Admin User", summary: { races: 2, runners: 4, published: false } }]
            : [],
        },
      });
    if (path === "/api/admin/racing/feed/pull") {
      pulls.push(req.postDataJSON());
      return route.fulfill({ status: 202, json: { job: job(false) } });
    }
    if (path === "/api/admin/racing/feed/import") {
      imports.push(req.postDataJSON());
      return route.fulfill({
        json: {
          format: "collected-equibase",
          published: false,
          results: [
            { ok: true, track: "FXD", date: "2099-06-08", races: 2, runners: 4, officialRaces: 1, history: 12, workouts: 3, skipped: 1, published: false, dayId: DAY },
            { ok: false, track: "BAD", date: "2099-06-08", error: "This card couldn't be saved; nothing from it was changed." },
          ],
        },
      });
    }
    if (path === `/api/public/racing/horses/${H}`)
      return route.fulfill({
        json: {
          horse: { id: H, name: "Alpha Fixture", country: "", foaled: 2095, sex: "gelding", color: "", sire: "", dam: "", damSire: "", breeder: "", breed: "thoroughbred" },
          stats: { starts: 0, wins: 0, places: 0, shows: 0, earnings: 0 },
          starts: [],
          workouts: [{ id: "w1", date: "2099-06-01", track: "Fixture Downs", distance: "4 f", surface: "dirt", time: "48.20", rank: 3, rankOf: 20, note: "B", horse: { id: H, name: "Alpha Fixture" } }],
          history: [
            { date: "2099-05-01", trackCode: "OLD", track: "Old Park", race: 3, type: "Maiden Claiming", breed: "thoroughbred", finish: 1, source: "equibase" },
            { date: "2099-04-01", trackCode: "OLD", track: "Old Park", race: 5, type: "Claiming", breed: "thoroughbred", finish: 4, source: "equibase" },
          ],
        },
      });
    if (path === `/api/public/racing/days/${DAY}`)
      return route.fulfill({ json: { day: { id: DAY, date: "2099-06-08", status: "published", notes: "", source: "equibase", track, races: [] } } });
    if (path === "/api/my-racing/follows/state") return route.fulfill({ json: { state: { horse: false, family: false, person: false, relatives: 0, total: 0 } } });
    if (path.startsWith("/api/public/racing/")) return route.fulfill({ status: 404, json: { error: "Not published." } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
  return Object.assign(imports, { pulls });
}

test("admins see the feed status honestly and import a collected file as drafts", async ({ page }) => {
  const imports = await mock(page);
  await page.goto("/admin/racing?tab=feed");
  await expect(page.getByRole("heading", { name: "Data feed", level: 2 })).toBeVisible();
  await expect(page.getByText(/the racing data login\s+we have is for The Racing API/)).toBeVisible();
  await expect(page.getByText("Not confirmed")).toBeVisible();
  await expect(page.getByLabel("Publish after import")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import as drafts" })).toBeDisabled();

  await page.getByLabel(/Racing data file/).setInputFiles({
    name: "collected.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ races: [{ race_id: "FXD-2099-06-08-R1", entries_detail: [] }] })),
  });
  await page.getByRole("button", { name: "Import as drafts" }).click();
  await expect(page.getByText("1 of 2 cards imported")).toBeVisible();
  await expect(page.getByText(/2 races, 4 runners \(1 with results\), 12 earlier starts, 3 workouts, 1 skipped · draft/)).toBeVisible();
  await expect(page.getByText("This card couldn't be saved; nothing from it was changed.")).toBeVisible();
  expect(imports).toHaveLength(1);
  expect((imports[0] as { publish: boolean }).publish).toBe(false);
  await expect(page.getByRole("cell", { name: "Equibase" })).toBeVisible();
});

test("bad files are refused before anything is sent", async ({ page }) => {
  const imports = await mock(page);
  await page.goto("/admin/racing?tab=feed");
  await page.getByLabel(/Racing data file/).setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{not json") });
  await page.getByRole("button", { name: "Import as drafts" }).click();
  await expect(page.getByRole("alert")).toHaveText("That file isn't valid JSON.");
  expect(imports).toHaveLength(0);
});

test("with the licence confirmed, publishing on import asks first", async ({ page }) => {
  const imports = await mock(page, { licensed: true });
  await page.goto("/admin/racing?tab=feed");
  await expect(page.getByText("Confirmed")).toBeVisible();
  await page.getByLabel("Publish after import").check();
  await page.getByLabel(/Racing data file/).setInputFiles({ name: "c.json", mimeType: "application/json", buffer: Buffer.from('{"cards":[]}') });
  await page.getByRole("button", { name: "Import and publish" }).click();
  await expect(page.getByText("Import and publish?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(imports).toHaveLength(0);
});

test("The Racing API: status is honest, and Pull now asks first, then follows the pull to the end", async ({ page }) => {
  const calls = await mock(page);
  await page.goto("/admin/racing?tab=feed");
  await expect(page.getByRole("heading", { name: "The Racing API", level: 2 })).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByText(/Not on this plan\. US and Canadian racing needs the provider's North America add-on/)).toBeVisible();
  await expect(page.getByText(/every 20 minutes while the server is awake/)).toBeVisible();
  await page.getByLabel("Days back").selectOption("7");
  await page.getByRole("button", { name: "Pull now" }).click();
  await expect(page.getByText("Pull and publish?")).toBeVisible();
  await page.getByRole("button", { name: "Pull and publish" }).click();
  expect(calls.pulls).toEqual([{ date: "2099-06-08", days: 7, histories: 100 }]);
  await expect(page.getByText(/6 of 6 tracks, 50 races, 573 runners, 12 results · published/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Earlier starts: 1400 for 100 horses")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pull now" })).toBeEnabled();
});

test("without the login on the server, there's nothing to pull", async ({ page }) => {
  await mock(page, { configured: false });
  await page.goto("/admin/racing?tab=feed");
  await expect(page.getByText("Not set up")).toBeVisible();
  await expect(page.getByText(/Add RACING_API_USERNAME and RACING_API_PASSWORD/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pull now" })).toHaveCount(0);
});

test("horse pages list earlier starts from the provider, and feed cards credit their source", async ({ page }) => {
  await mock(page);
  await page.goto(`/racing/horses/${H}`);
  await expect(page.getByRole("heading", { name: "Earlier starts" })).toBeVisible();
  await expect(page.getByText("2 starts · 1 win · from Equibase.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Maiden Claiming" })).toBeVisible();
  await expect(page.getByText(/speed/i)).toHaveCount(0);
  await page.goto(`/racing/days/${DAY}`);
  await expect(page.getByText("Data: Equibase")).toBeVisible();
});
