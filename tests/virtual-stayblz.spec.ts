import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend.
const ME = "11111111-1111-4111-8111-111111111111";
const OWNER = "44444444-4444-4444-8444-444444444444";
const STABLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HORSE = "22222222-2222-4222-8222-222222222222";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const communityHorse = {
  id: HORSE,
  ownerId: OWNER,
  name: "Midnight Runner",
  breed: "Thoroughbred",
  sex: "colt",
  foaledYear: 2022,
  color: "Bay",
  sire: "Into Mischief",
  dam: "Starry Night",
  status: "racing",
  trainer: "Bob Baffert",
  location: "Santa Anita",
  description: "",
  coverImageId: null,
  stats: { starts: 6, wins: 3, places: 1, shows: 1, earningsCents: 12500000, lastRace: "2026-10-01" },
  mine: false,
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
};
const horseDetail = {
  ...communityHorse,
  images: [],
  records: [{ id: "r1", raceDate: "2026-10-01", track: "Santa Anita", raceName: "Golden State Juvenile", distance: "7f", surface: "dirt", finish: 1, fieldSize: 9, earningsCents: 6000000, notes: "" }],
  owner: { id: OWNER, name: "Sam Seller", headline: "", isFollowing: false, me: false },
};
const post = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "horse_share",
  body: "Meet our colt",
  result: null,
  visibility: "members",
  createdAt: new Date().toISOString(),
  editedAt: null,
  mine: false,
  author: { id: OWNER, name: "Sam Seller", headline: "" },
  horse: { id: HORSE, name: "Midnight Runner", breed: "Thoroughbred", status: "racing", coverImageId: null, media: [], mediaCount: 0 },
  images: [],
  likes: 0,
  liked: false,
  comments: 0,
};

type Row = Record<string, any>;
/** A small in-memory Virtual Stayblz per list, so adds, entries and removals behave like the server. */
async function mockApp(page: Page, { stable = true } = {}) {
  const lists: Record<string, { horses: Row[]; entries: Row[] }> = { personal: { horses: [], entries: [] }, stable: { horses: [], entries: [] } };
  const calls = { adds: [] as { list: string; body: Row; stableHeader: string | undefined }[], stableHeaders: new Set<string>(), publicQueries: [] as string[] };
  let n = 0;
  const id = () => `9${String(++n).padStart(7, "0")}-0000-4000-8000-000000000000`;
  const view = (list: string, h: Row) => ({
    ...h,
    counts: {
      workouts: lists[list].entries.filter((e) => e.horseId === h.id && e.kind === "workout").length,
      races: lists[list].entries.filter((e) => e.horseId === h.id && e.kind === "race").length,
      sales: lists[list].entries.filter((e) => e.horseId === h.id && e.kind === "sale").length,
      notes: lists[list].entries.filter((e) => e.horseId === h.id && e.kind === "note").length,
    },
    lastEntry: null,
    live: null,
  });

  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: ME, username: "rita", displayName: "Rita Racer", role: "member" } } });
    if (path === "/api/tv/status") return route.fulfill({ json: { state: "off_air", title: null, startsAt: null } });
    if (path === "/api/workspaces")
      return route.fulfill({ json: { stables: stable ? [{ id: STABLE, name: "Bishop Racing", role: "member" }] : [] } });
    if (path === "/api/community/me")
      return route.fulfill({ json: { settings: { headline: "", inventoryVisibility: "members", showEarnings: true, listed: true }, person: null } });
    if (path === "/api/community/people") return route.fulfill({ json: { people: [], page: 1, hasNext: false } });
    if (path === "/api/community/feed") return route.fulfill({ json: { posts: [post], next: null } });
    if (path === "/api/community/feed/new") return route.fulfill({ json: { count: 0 } });
    if (path === `/api/community/horses/${HORSE}`) return route.fulfill({ json: { horse: horseDetail } });
    if (path === "/api/community/public-horses/breeds") return route.fulfill({ json: { breeds: ["Thoroughbred", "Quarter Horse"] } });
    if (path === "/api/community/public-horses") {
      calls.publicQueries.push(url.search);
      const p = url.searchParams;
      const all = [
        { ...communityHorse, owner: { id: OWNER, name: "Sam Seller" } },
        { ...communityHorse, id: "55555555-5555-4555-8555-555555555555", name: "Dusty Quarter", breed: "Quarter Horse", sex: "mare", status: "for_sale", foaledYear: 2019,
          stats: { starts: 0, wins: 0, places: 0, shows: 0, earningsCents: null, lastRace: null }, owner: { id: OWNER, name: "Sam Seller" } },
      ];
      const horses = all.filter(
        (h) =>
          h.name.toLowerCase().includes((p.get("q") ?? "").toLowerCase()) &&
          (!p.get("breed") || h.breed === p.get("breed")) &&
          (!p.get("status") || h.status === p.get("status")) &&
          (!p.get("raced") || h.stats.starts > 0),
      );
      return route.fulfill({ json: { horses, next: null } });
    }
    if (path.startsWith("/api/community/media/")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });

    const m = /^\/api\/(my-racing|workspace)\/virtual(\/.*)?$/.exec(path);
    if (m) {
      const list = m[1] === "my-racing" ? "personal" : "stable";
      const header = request.headers()["x-stayblz-stable"];
      if (list === "stable") {
        if (header !== STABLE) return route.fulfill({ status: 403, json: { error: "Choose a stable you belong to." } });
        calls.stableHeaders.add(header);
      }
      const L = lists[list];
      const rest = m[2] ?? "";
      const body = method === "GET" ? null : request.postDataJSON();
      if (rest === "" && method === "GET") return route.fulfill({ json: { horses: L.horses.map((h) => view(list, h)), limit: 300 } });
      if (rest === "/state") {
        const found = L.horses.find((h) => h.communityHorseId === url.searchParams.get("communityHorseId"));
        return route.fulfill({ json: { added: !!found, id: found?.id ?? null } });
      }
      if (rest === "" && method === "POST") {
        calls.adds.push({ list, body, stableHeader: header });
        if (body.source === "community" && L.horses.some((h) => h.communityHorseId === body.communityHorseId))
          return route.fulfill({ status: 409, json: { error: "That horse is already in this Virtual Stayblz.", code: "already_added" } });
        const base =
          body.source === "community"
            ? { name: communityHorse.name, breed: communityHorse.breed, sire: communityHorse.sire, dam: communityHorse.dam, ownerName: "Sam Seller", communityHorseId: HORSE }
            : { name: body.name, breed: body.breed ?? "", sire: body.sire ?? "", dam: body.dam ?? "", ownerName: body.ownerName ?? "", communityHorseId: null };
        const h = {
          id: id(), source: body.source, racingHorseId: null, sex: "", foaledYear: null, color: "", trainer: "", location: "", notes: "",
          addedBy: ME, addedByName: "Rita Racer", canRemove: true, createdAt: "2026-11-20T10:00:00Z", updatedAt: "2026-11-20T10:00:00Z", ...base,
        };
        L.horses.unshift(h);
        return route.fulfill({ status: 201, json: { horse: h } });
      }
      const entryRoute = /^\/entries\/([^/]+)(\/remove)?$/.exec(rest);
      if (entryRoute) {
        const e = L.entries.find((x) => x.id === entryRoute[1]);
        if (!e) return route.fulfill({ status: 404, json: { error: "That entry isn't in this Virtual Stayblz." } });
        if (entryRoute[2]) {
          L.entries = L.entries.filter((x) => x.id !== e.id);
          return route.fulfill({ json: { ok: true } });
        }
        Object.assign(e, body);
        return route.fulfill({ json: { entry: e } });
      }
      const horseRoute = /^\/([^/]+)(\/entries|\/remove)?$/.exec(rest);
      const h = horseRoute && L.horses.find((x) => x.id === horseRoute[1]);
      if (!h) return route.fulfill({ status: 404, json: { error: "That horse isn't in this Virtual Stayblz." } });
      if (horseRoute![2] === "/remove") {
        L.horses = L.horses.filter((x) => x.id !== h.id);
        return route.fulfill({ json: { ok: true } });
      }
      if (horseRoute![2] === "/entries") {
        const entry = {
          id: id(), horseId: h.id, title: "", track: "", distance: "", surface: "", timeText: "", finish: null, fieldSize: null, result: "",
          hipNumber: "", amountCents: null, notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          ...body,
          author: { id: ME, name: "Rita Racer" },
          canEdit: true,
        };
        L.entries.unshift(entry);
        return route.fulfill({ status: 201, json: { entry } });
      }
      if (method === "PATCH") {
        Object.assign(h, body);
        return route.fulfill({ json: { horse: h } });
      }
      const live = h.communityHorseId ? { community: horseDetail } : null;
      return route.fulfill({
        json: { horse: h, entries: L.entries.filter((e) => e.horseId === h.id), live, liveUnavailable: h.source !== "manual" && !live },
      });
    }
    return route.fulfill({ status: 403, json: { error: "Not part of this test" } });
  });
  return { lists, calls };
}

test("My racing → Virtual Stayblz: add a horse by hand, log a sales entry, then remove it", async ({ page }) => {
  const { calls } = await mockApp(page);
  await page.goto("/my-racing");
  await page.getByRole("button", { name: /Virtual Stayblz/ }).click();
  await expect(page).toHaveURL(/tab=virtual/);
  await expect(page.getByText("Private to your account")).toBeVisible();
  await expect(page.getByText("No horses tracked yet")).toBeVisible();

  await page.getByRole("button", { name: "+ Add horse" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a horse to Virtual Stayblz" });
  await dialog.getByRole("tab", { name: "Enter by hand" }).click();
  await dialog.getByLabel("Name *").fill("Sale Prospect");
  await dialog.getByLabel("Sire").fill("Gun Runner");
  await dialog.getByRole("button", { name: "Add horse" }).click();
  await expect(dialog).toBeHidden();
  expect(calls.adds[0]).toMatchObject({ list: "personal", body: { source: "manual", name: "Sale Prospect", sire: "Gun Runner" } });
  expect(calls.adds[0].stableHeader).toBeUndefined();

  // The new horse opens; log a sales entry from its Sales entries tab.
  await expect(page.getByRole("heading", { name: "Sale Prospect" })).toBeVisible();
  await expect(page).toHaveURL(/horse=/);
  await page.getByRole("button", { name: "Sales entries" }).click();
  await page.getByRole("button", { name: "+ Log sales entry" }).click();
  const entry = page.getByRole("dialog", { name: /sales entry for Sale Prospect/ });
  await entry.getByLabel("Sale / auction *").fill("Keeneland September");
  await entry.getByLabel("Hip number").fill("1234");
  await entry.getByLabel("Status").selectOption("sold");
  await entry.getByLabel("Price ($)").fill("450000");
  await entry.getByRole("button", { name: "Save" }).click();
  await expect(entry).toBeHidden();
  await expect(page.getByText("Keeneland September · Hip 1234 · Sold · $450,000")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sales entries/ }).locator(".vs-count")).toHaveText("1");

  await page.getByRole("button", { name: /Remove Keeneland September/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No sales entries logged yet.")).toBeVisible();

  // Back to the list: the horse is there.
  await page.getByRole("button", { name: "← All tracked horses" }).click();
  await expect(page.getByRole("button", { name: /Sale Prospect/ })).toBeVisible();
});

test("Stable workspace → Virtual Stayblz is shared: calls carry the stable header and entries show who logged them", async ({ page }) => {
  const { calls } = await mockApp(page);
  await page.goto("/workspace/virtual");
  await expect(page.getByRole("heading", { name: "Virtual Stayblz." })).toBeVisible();
  await expect(page.getByText("Shared with Bishop Racing")).toBeVisible();
  await expect(page.getByRole("link", { name: "Virtual Stayblz" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "+ Add horse" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a horse to Virtual Stayblz" });
  await dialog.getByLabel("Search horses shared by Stayblz members").fill("midnight");
  await expect(dialog.getByText("Dusty Quarter")).toBeHidden();
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog).toBeHidden();
  expect(calls.adds[0]).toMatchObject({ list: "stable", stableHeader: STABLE, body: { source: "community", communityHorseId: HORSE } });

  // Live data from the owner's profile, plus the team's own log.
  await expect(page.getByRole("heading", { name: "Midnight Runner" })).toBeVisible();
  await expect(page.getByText("On Stayblz")).toBeVisible();
  await page.getByRole("button", { name: "Workouts" }).click();
  await page.getByRole("button", { name: "+ Log workout" }).click();
  const entry = page.getByRole("dialog", { name: /workout for Midnight Runner/ });
  await entry.getByLabel("Track").fill("Santa Anita");
  await entry.getByLabel("Distance").fill("5f");
  await entry.getByLabel("Time").fill(":59.80");
  await entry.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Santa Anita · 5f · :59.80")).toBeVisible();
  await expect(page.getByText("Logged by Rita Racer")).toBeVisible();
  await page.getByRole("button", { name: "Races" }).click();
  await expect(page.getByText("Golden State Juvenile")).toBeVisible();
  expect([...calls.stableHeaders]).toEqual([STABLE]);
});

test("Feeds: a shared horse's viewer adds it to my list and to the team list", async ({ page }) => {
  const { calls } = await mockApp(page);
  await page.goto("/community");
  const share = page.getByRole("region", { name: "Shared horse: Midnight Runner" });
  await share.getByRole("button", { name: "Midnight Runner", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Midnight Runner: photos and details" });
  await viewer.getByRole("button", { name: "Track in Virtual Stayblz" }).click();
  const panel = viewer.getByRole("group", { name: "Track Midnight Runner in Virtual Stayblz" });
  await expect(panel.getByText("My Virtual Stayblz")).toBeVisible();
  await expect(panel.getByText("Team · Bishop Racing")).toBeVisible();

  const rows = panel.locator(".vs-add-row");
  await rows.nth(0).getByRole("button", { name: "Add" }).click();
  await expect(rows.nth(0).getByText("Added ✓")).toBeVisible();
  await expect(rows.nth(0).getByRole("link", { name: "Open" })).toHaveAttribute("href", /\/my-racing\?tab=virtual&horse=/);
  await rows.nth(1).getByRole("button", { name: "Add" }).click();
  await expect(rows.nth(1).getByText("Added ✓")).toBeVisible();
  await expect(rows.nth(1).getByRole("link", { name: "Open" })).toHaveAttribute("href", /\/workspace\/virtual\?horse=/);

  expect(calls.adds.map((a) => [a.list, a.body, a.stableHeader])).toEqual([
    ["personal", { source: "community", communityHorseId: HORSE }, undefined],
    ["stable", { source: "community", communityHorseId: HORSE }, STABLE],
  ]);
});

test("Public horses tab: a list searched by name and filtered; track without a stable offers only the private list", async ({ page }) => {
  const { calls } = await mockApp(page, { stable: false });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/my-racing?tab=virtual");
  await page.getByRole("tab", { name: "Public horses" }).click();
  await expect(page).toHaveURL(/vtab=public/);
  const list = page.getByRole("table", { name: "Public horses" });
  await expect(list.getByRole("row")).toHaveCount(3); // header + 2 horses
  await expect(list.getByRole("columnheader", { name: "Breed" })).toBeVisible();

  // Filters go to the server.
  await page.getByRole("combobox", { name: "Breed" }).selectOption("Quarter Horse");
  await expect(list.getByRole("row")).toHaveCount(2);
  await expect(list.getByText("Dusty Quarter")).toBeVisible();
  await expect(page.getByText("1 horse match.")).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("racing");
  await expect(page.getByText("No public horses match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(list.getByRole("row")).toHaveCount(3);
  await page.getByLabel("Has raced").check();
  await expect(list.getByRole("row")).toHaveCount(2);
  await expect(list.getByText("Midnight Runner")).toBeVisible();
  expect(calls.publicQueries.some((q) => q.includes("breed=Quarter+Horse") && q.includes("status=racing"))).toBe(true);
  expect(calls.publicQueries.at(-1)).toContain("raced=1");

  // Search by name.
  await page.getByLabel("Has raced").uncheck();
  await page.getByPlaceholder("Search horses by name").fill("nothing");
  await expect(page.getByText("No public horses match these filters")).toBeVisible();
  await page.getByPlaceholder("Search horses by name").fill("midnight");
  const row = list.locator('[data-horse="Midnight Runner"]');
  await expect(row.getByText("Sam Seller")).toBeVisible();
  await row.getByRole("button", { name: "Track in Virtual Stayblz" }).click();
  await expect(row.getByText("Team ·")).toHaveCount(0);
  await expect(row.getByText("Join or create a stable to share horses with your team.")).toBeVisible();
  await row.getByRole("button", { name: "Add" }).click();
  await expect(row.getByText("Added ✓")).toBeVisible();

  await page.getByRole("tab", { name: "My tracked horses" }).click();
  await expect(page.getByRole("button", { name: /Midnight Runner/ })).toBeVisible();
});

for (const theme of ["light", "dark"] as const)
  test(`Virtual Stayblz fits a 320px screen without sideways scrolling (${theme})`, async ({ page }) => {
    await mockApp(page);
    await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/workspace/virtual");
    await page.getByRole("button", { name: "+ Add horse" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a horse to Virtual Stayblz" });
    await dialog.getByRole("tab", { name: "Enter by hand" }).click();
    await dialog.getByLabel("Name *").fill("A Very Long Horse Name Indeed");
    await dialog.getByRole("button", { name: "Add horse" }).click();
    await expect(page.getByRole("heading", { name: "A Very Long Horse Name Indeed" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("tab", { name: "Public horses" }).click();
    await expect(page.locator(".vs-prow[data-horse]")).toHaveCount(2);
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("combobox", { name: "Breed" })).toBeVisible();
    await page.locator('.vs-prow[data-horse="Midnight Runner"]').getByRole("button", { name: "Track in Virtual Stayblz" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
