import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow (Racing horses tab, linking, race data, alerts switch),
// not the real backend, FormFav or Vercel.
const ME = "11111111-1111-4111-8111-111111111111";
const OWNED = "66666666-6666-4666-8666-666666666666";
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const row = (name: string, followers: number, extra: Record<string, unknown> = {}) => ({
  name,
  code: "gallops",
  countries: ["us"],
  starts: 3,
  wins: 1,
  places: 2,
  lastStart: { date: day(-5), track: "Parx", slug: "parx", position: 2 },
  nextEntry: { date: day(0), track: "Parx", slug: "parx", country: "us", code: "gallops", timezone: "America/New_York", raceNumber: 4, startTime: null },
  jockey: "J. Acosta",
  trainer: "Bob Smith",
  followers,
  trackingId: null,
  ...extra,
});
const meta = { building: false, updatedAt: new Date().toISOString(), coverage: { from: day(-29), to: day(2) } };
const history = [
  { date: day(0), code: "gallops", timezone: "America/New_York", track: "Parx", slug: "parx", country: "us", raceNumber: 4, raceName: "Allowance", startTime: null, status: "pending", position: null, fieldSize: 4, scratched: false, jockey: "J. Acosta", trainer: "Bob Smith" },
  { date: day(-5), code: "gallops", timezone: "America/New_York", track: "Parx", slug: "parx", country: "us", raceNumber: 2, raceName: "Maiden", startTime: null, status: "final", position: 2, fieldSize: 3, scratched: false, jockey: "K. Lee", trainer: "Bob Smith" },
];

type Row = Record<string, any>;
async function mockApp(page: Page) {
  const calls = { racing: [] as string[], adds: [] as Row[], alerts: [] as Row[], links: [] as Row[], ownedLinks: [] as Row[], searches: [] as string[] };
  const horses: Row[] = [];
  let n = 0;
  const id = () => `9${String(++n).padStart(7, "0")}-0000-4000-8000-000000000000`;
  const link = (name: string) => ({ name, code: "gallops", runnerId: null, linkedAt: new Date().toISOString(), syncedAt: new Date().toISOString() });
  const owned: Row = {
    id: OWNED, ownerId: ME, name: "Uno", breed: "", sex: "", foaledYear: null, color: "", sire: "", dam: "", status: "racing", trainer: "", location: "",
    description: "", visibility: "inherit", coverImageId: null, stats: { starts: 0, wins: 0, places: 0, shows: 0, earningsCents: 0, lastRace: null },
    mine: true, raceData: null, createdAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-01T12:00:00Z", images: [], records: [],
    owner: { id: ME, name: "Rita Racer", headline: "", isFollowing: false, me: true },
  };

  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = method === "GET" ? null : request.postDataJSON();
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: ME, username: "rita", displayName: "Rita Racer", role: "member" } } });
    if (path === "/api/tv/status") return route.fulfill({ json: { state: "off_air", title: null, startsAt: null } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/community/public-horses/breeds") return route.fulfill({ json: { breeds: [] } });
    if (path === "/api/community/public-horses")
      return route.fulfill({
        json: {
          horses: [{ ...owned, id: "77777777-7777-4777-8777-777777777777", name: "Popular Pony", mine: false, raceData: null, owner: { id: "x", name: "Sam" }, followers: 7 }],
          next: null,
        },
      });
    if (path === `/api/community/horses/${OWNED}`) return route.fulfill({ json: { horse: owned } });
    if (path === `/api/community/horses/${OWNED}/posts`) return route.fulfill({ json: { posts: [], next: null } });
    if (path === `/api/community/horses/${OWNED}/formfav`) {
      calls.ownedLinks.push(body);
      Object.assign(owned, {
        breed: "Thoroughbred", sex: "colt", sire: "Into Mischief", trainer: "Bob Smith", raceData: { ...link(body.name), alertsOn: true },
        records: [{ id: "rec1", raceDate: day(-5), track: "Parx", raceName: "Maiden", distance: "8f (1,609 m)", surface: "", finish: 2, fieldSize: 3, earningsCents: 0, notes: "", fromRaceData: true }],
      });
      return route.fulfill({ json: { horse: owned } });
    }
    if (path === `/api/community/horses/${OWNED}/formfav/alerts`) {
      calls.alerts.push({ owned: true, ...body });
      return route.fulfill({ json: { alertsOn: body.on } });
    }
    if (path === "/api/stayblz-data/formfav/horses") {
      calls.searches.push(url.searchParams.get("q") ?? "");
      return route.fulfill({ json: { ...meta, records: [row("Lucky Star", 3)].filter((r) => r.name.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase())), nextOffset: null, total: 1 } });
    }
    if (path.startsWith("/api/stayblz-data/formfav/")) return route.fulfill({ status: 503, json: { error: "FormFav data isn't available right now." } });

    const m = /^\/api\/my-racing\/virtual(\/.*)?$/.exec(path);
    if (m) {
      const rest = m[1] ?? "";
      if (rest === "" && method === "GET")
        return route.fulfill({
          json: { horses: horses.filter((h) => h.source !== "formfav").map((h) => ({ ...h, counts: { workouts: 0, races: 0, sales: 0, notes: 0 }, lastEntry: null, live: null })), limit: 300 },
        });
      if (rest === "/racing-horses") {
        calls.racing.push(url.search);
        const tracked = (name: string) => horses.find((h) => h.formfav?.name === name)?.id ?? null;
        let records = [row("Lucky Star", 12), row("Other One", 4), row("Aardvark", 0)].map((r) => ({ ...r, trackingId: tracked(r.name) }));
        if (url.searchParams.get("tracking") === "1") records = records.filter((r) => r.trackingId);
        return route.fulfill({ json: { ...meta, records, nextOffset: null, total: records.length } });
      }
      if (rest === "" && method === "POST") {
        calls.adds.push(body);
        const h = {
          id: id(), source: body.source, communityHorseId: null, racingHorseId: null, name: body.formfavName ?? body.name, breed: body.source === "formfav" ? "Thoroughbred" : "",
          sex: "", foaledYear: null, color: "", sire: body.source === "formfav" ? "Into Mischief" : body.sire ?? "", dam: "", trainer: body.source === "formfav" ? "Bob Smith" : "",
          ownerName: "", location: "", notes: "", addedBy: ME, canRemove: true, formfav: body.source === "formfav" ? link(body.formfavName) : null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), alertsOn: true,
        };
        horses.unshift(h);
        return route.fulfill({ status: 201, json: { horse: h } });
      }
      const hr = /^\/([^/]+)(\/alerts|\/formfav)?$/.exec(rest);
      const h = hr && horses.find((x) => x.id === hr[1]);
      if (!h) return route.fulfill({ status: 404, json: { error: "That horse isn't in this Virtual Stayblz." } });
      if (hr![2] === "/alerts") {
        calls.alerts.push(body);
        h.alertsOn = body.on;
        return route.fulfill({ json: { alertsOn: body.on } });
      }
      if (hr![2] === "/formfav") {
        calls.links.push(body);
        Object.assign(h, { formfav: link(body.name), sire: "Into Mischief", trainer: "Bob Smith", breed: "Thoroughbred" });
        return route.fulfill({ json: { horse: h } });
      }
      const entries = h.formfav
        ? [{ id: "e1", kind: "race", entryDate: day(-5), title: "Maiden", track: "Parx", distance: "8f (1,609 m)", surface: "", timeText: "", finish: 2, fieldSize: 3, result: "", hipNumber: "", amountCents: null, notes: "", author: null, fromRaceData: true, canEdit: true, canRemove: false, createdAt: "", updatedAt: "" }]
        : [];
      const raceData = h.formfav
        ? { ...h.formfav, ...meta, available: true, followers: 12, alertsOn: h.alertsOn, horse: { ...row(h.formfav.name, 12), history } }
        : null;
      return route.fulfill({ json: { horse: h, entries, live: null, liveUnavailable: false, raceData } });
    }
    return route.fulfill({ status: 403, json: { error: "Not part of this test" } });
  });
  return { calls, horses };
}

test("Racing horses tab: most followed first with counts; Track keeps it out of the main list; Tracking only", async ({ page }) => {
  const { calls } = await mockApp(page);
  await page.goto("/my-racing?tab=virtual");
  await page.getByRole("tab", { name: "Racing horses" }).click();
  await expect(page).toHaveURL(/vtab=racing/);
  const cards = page.locator(".vs-rcard");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Lucky Star");
  await expect(cards.nth(0)).toContainText("12 following");
  await expect(cards.nth(1)).toContainText("4 following");
  await expect(page.getByText(/Most followed first/)).toBeVisible();
  await expect(page.getByText("FormFav", { exact: true })).toHaveCount(0); // the tab isn't named after the data source

  await cards.nth(0).getByRole("button", { name: "Track Lucky Star" }).click();
  await expect(cards.nth(0).getByText("Tracking")).toBeVisible();
  expect(calls.adds[0]).toEqual({ source: "formfav", formfavName: "Lucky Star", formfavCode: "gallops" });

  await page.getByLabel("Tracking only").check();
  await expect(cards).toHaveCount(1);
  expect(calls.racing.at(-1)).toContain("tracking=1");

  // The main list doesn't fill up with racing horses.
  await page.getByRole("tab", { name: "My tracked horses" }).click();
  await expect(page.getByText("No horses tracked yet")).toBeVisible();
});

test("a tracked racing horse: race data, followers, own alerts switch, race-data log rows can't be removed", async ({ page }) => {
  const { calls } = await mockApp(page);
  await page.goto("/my-racing?tab=virtual&vtab=racing");
  await page.locator(".vs-rcard").first().getByRole("button", { name: "Track Lucky Star" }).click();
  await page.locator(".vs-rcard").first().getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Lucky Star" })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Racing horses" })).toBeVisible();
  const panel = page.getByRole("region", { name: "Race data" });
  await expect(panel.getByText("12 following on Stayblz")).toBeVisible();
  await expect(panel.getByText("Parx R4", { exact: false })).toBeVisible();
  const alerts = panel.getByLabel(/Alert me when Lucky Star is entered/);
  await expect(alerts).toBeChecked();
  await alerts.click(); // flips once the server has saved it
  await expect(page.getByText("Race alerts off for you.")).toBeVisible();
  await expect(alerts).not.toBeChecked();
  expect(calls.alerts.at(-1)).toEqual({ on: false });

  await page.getByRole("button", { name: /^Races/ }).click();
  const log = page.locator(".vs-entry").filter({ hasText: "Maiden" });
  await expect(log.getByText("Race data")).toBeVisible();
  await expect(log.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await expect(log.getByRole("button", { name: /^Edit/ })).toBeVisible();

  await page.getByRole("button", { name: "← Racing horses" }).click();
  await expect(page.locator(".vs-rcard")).toHaveCount(3);
});

test("a horse typed in by hand links to a racing horse; linked details are locked in the editor", async ({ page }) => {
  const { calls, horses } = await mockApp(page);
  horses.push({
    id: "80000000-0000-4000-8000-000000000001", source: "manual", communityHorseId: null, racingHorseId: null, name: "My Star", breed: "", sex: "", foaledYear: null,
    color: "", sire: "Guess", dam: "", trainer: "", ownerName: "", location: "", notes: "", addedBy: ME, canRemove: true, formfav: null, alertsOn: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await page.goto("/my-racing?tab=virtual&horse=80000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Link to a racing horse" }).click();
  const dialog = page.getByRole("dialog", { name: "Link My Star to a racing horse" });
  await dialog.getByLabel("Racing horse's name").fill("lucky");
  await dialog.getByRole("button", { name: "Link to Lucky Star" }).click();
  await expect(dialog).toBeHidden();
  expect(calls.links[0]).toEqual({ name: "Lucky Star", code: "gallops" });
  expect(calls.searches).toContain("lucky");
  await expect(page.getByText("Linked: Lucky Star")).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlink race data" })).toBeVisible();

  await page.getByRole("button", { name: "Edit details" }).click();
  const edit = page.getByRole("dialog", { name: "Edit My Star" });
  await expect(edit.getByText(/come from race data while the horse is linked/)).toBeVisible();
  await expect(edit.getByLabel("Sire")).toBeDisabled();
  await expect(edit.getByLabel("Trainer")).toBeDisabled();
  await expect(edit.getByLabel("Colour")).toBeEnabled();
});

test("owned horse profile: link to race data, race-data records tagged, owner's alerts switch; Public horses show followers", async ({ page }) => {
  const { calls } = await mockApp(page);
  await page.goto(`/community/horses/${OWNED}`);
  const card = page.getByRole("region", { name: "Race data" });
  await card.getByRole("button", { name: "Link to a racing horse" }).click();
  const dialog = page.getByRole("dialog", { name: "Link Uno to a racing horse" });
  await dialog.getByLabel("Racing horse's name").fill("Lucky Star");
  await dialog.getByRole("button", { name: "Link to Lucky Star" }).click();
  await expect(dialog).toBeHidden();
  expect(calls.ownedLinks[0]).toEqual({ name: "Lucky Star", code: "gallops" });
  await expect(card.locator("p", { hasText: /^Linked to Lucky Star · Thoroughbreds$/ })).toBeVisible();
  await expect(page.locator("table").getByText("Race data")).toBeVisible();
  await card.getByLabel(/Alert me when it's entered/).click();
  await expect(card.getByText("Race alerts off.")).toBeVisible();
  await expect(card.getByLabel(/Alert me when it's entered/)).not.toBeChecked();
  expect(calls.alerts.at(-1)).toEqual({ owned: true, on: false });

  await page.goto("/my-racing?tab=virtual&vtab=public");
  await expect(page.getByText("7 following")).toBeVisible();
});

test("Racing horses fits a 375 px phone without sideways scrolling", async ({ page }) => {
  await mockApp(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/my-racing?tab=virtual&vtab=racing");
  await expect(page.locator(".vs-rcard")).toHaveCount(3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
