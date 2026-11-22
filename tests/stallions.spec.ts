import { test, expect, type Page } from "@playwright/test";

// Stayblz Stallions. Every API is mocked: these tests prove the page flows, not the real backend.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONVO = "c0ffee00-0000-4000-8000-000000000001";

const card = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  breed: "thoroughbred",
  foaled: 2017,
  color: "Bay",
  heightIn: 65,
  country: "US",
  sire: "Northern Ledger",
  dam: "Quiet Line",
  damSire: "Big Sire",
  farm: "Hillcrest Farm",
  location: "Versailles, Kentucky",
  region: "US-KY",
  seasonYear: 2026,
  fee: 750000,
  feeCurrency: "USD",
  feeTerms: "live_foal",
  availability: "open",
  methods: ["live_cover"],
  firstSeason: 2022,
  ownerName: "Olive Owner",
  raceRecord: { starts: 12, wins: 5, places: 3, shows: 1, earnings: 85000000, currency: "USD" },
  featured: false,
  saves: 3,
  saved: false,
  mine: false,
  status: "published",
  cover: { id: "p1", kind: "photo", poster: false },
  photoCount: 2,
  videoCount: 0,
  publishedAt: "2026-11-20T12:00:00Z",
  updatedAt: "2026-11-21T12:00:00Z",
  runners: 2,
  ...extra,
});
const profile = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  ...card(id, name),
  registry: "The Jockey Club",
  registration: "TJC123",
  feeNote: "Payable September 1",
  bookingFee: 50000,
  shippingNote: "",
  programs: "",
  pedigree: { s: "Northern Ledger", d: "Quiet Line", ss: "Old Ledger", sd: "Old Mare", ds: "Big Sire", dd: "Line Dam" },
  highlights: ["Won a 9-furlong stakes on dirt"],
  genetics: {},
  fertilityRate: 82,
  fertilityNote: "",
  description: "A sound, kind horse.",
  inquiriesOpen: true,
  racingHorseId: null,
  racing: null,
  hiddenReason: "",
  media: [
    { id: "p1", kind: "photo", width: 1, height: 1, duration: null, poster: false },
    { id: "p2", kind: "photo", width: 1, height: 1, duration: null, poster: false },
  ],
  documents: [{ id: "d1", name: "Contract 2026.pdf", size: 20480 }],
  offspring: {
    named: 2, runners: 2, winners: 1, stakesWinners: 1, gradedWinners: 0, starts: 3, wins: 2, places: 0, shows: 1,
    earnings: [{ currency: "USD", amount: 95000 }], surfaces: [{ surface: "dirt", starts: 3, wins: 2 }],
    winDistance: { average: 8.5, shortest: 8.5, longest: 8.5 }, from: "2026-10-10", to: "2026-10-10",
    top: [{ id: "h1", name: "Ledger Kid", foaled: 2022, sex: "colt", sire: "Ledger Line", dam: "Kid Dam", damSire: "Big Sire", starts: 2, wins: 2, places: 0, shows: 0, stakesWins: 1, lastRun: "2026-10-10" }],
    crosses: [{ damSire: "Big Sire", runners: 1, winners: 1, starts: 2, wins: 2 }],
  },
  owner: null,
  ...extra,
});
const report = {
  stallion: { id: ID_A, name: "Ledger Line", breed: "thoroughbred" },
  mare: { name: "Test Mare", breed: "thoroughbred", pedigree: { s: "Big Sire", d: "Some Dam" } },
  foal: { s: "Ledger Line", d: "Test Mare", ss: "Northern Ledger", sd: "Quiet Line", sds: "Big Sire", ds: "Big Sire", dd: "Some Dam" },
  shared: [{ name: "Big Sire", sire: [3], dam: [2], notation: "3×2", bothSides: true, through: false }],
  inbreeding: { percent: 6.25, named: 7, possible: 46 },
  genetics: [],
  crosses: { exact: { named: 1, runners: 1, winners: 1, stakesWinners: 1, starts: 2, wins: 2, top: [] }, sireLine: null, sireLineName: "Northern Ledger", asDamSire: null, mareSire: "Big Sire" },
  notes: ["Thoroughbred foals are only registered from live cover, so the mare goes to the stallion."],
};

async function mockApp(page: Page, { signedIn = true } = {}) {
  const state = { queries: [] as string[], requests: [] as any[], created: [] as any[], patches: [] as any[], saves: [] as any[], views: 0 };
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === "/api/auth/me")
      return signedIn
        ? route.fulfill({ json: { user: { id: "member", username: "member", displayName: "Bree Breeder", role: "member" } } })
        : route.fulfill({ status: 401, json: { error: "Not signed in." } });
    if (path === "/api/tv/status") return route.fulfill({ json: { state: "off_air", title: null, startsAt: null } });
    if (/^\/api\/public\/stallions\/media\//.test(path)) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (path === "/api/public/stallions" && method === "GET") {
      state.queries.push(url.search);
      const breed = url.searchParams.get("breed");
      const all = [card(ID_A, "Ledger Line"), card(ID_B, "Quick Sprinter", { breed: "quarter_horse", fee: null, region: "US-TX", location: "Weatherford, Texas", farm: "", methods: ["cooled"] })];
      const list = all.filter((s) => !breed || s.breed === breed);
      return route.fulfill({
        json: { stallions: list, total: list.length, page: 0, more: false, facets: { total: 2, breeds: [{ value: "thoroughbred", count: 1 }, { value: "quarter_horse", count: 1 }], regions: [{ value: "US-KY", count: 1 }, { value: "US-TX", count: 1 }] } },
      });
    }
    if (path === "/api/public/stallions/compare")
      return route.fulfill({ json: { stallions: [profile(ID_A, "Ledger Line"), profile(ID_B, "Quick Sprinter", { breed: "quarter_horse", fee: null })] } });
    if (path === "/api/public/stallions/lookup") return route.fulfill({ json: { horses: [] } });
    if (path === "/api/public/stallions/pedigree-fill") return route.fulfill({ json: { pedigree: {}, filled: [], sources: [] } });
    if (path === `/api/public/stallions/${ID_A}/mating`) return route.fulfill({ json: { report } });
    if (path === "/api/public/stallions/matches")
      return route.fulfill({ json: { mare: { name: "Test Mare", breed: "thoroughbred", sire: "Big Sire", dam: "Some Dam" }, total: 1, matches: [{ stallion: card(ID_A, "Ledger Line"), inbreeding: 6.25, shared: [{ name: "Big Sire", notation: "3×2" }], sharedCount: 1, genetics: null, cross: { runners: 1, winners: 1, wins: 2 } }] } });
    const one = path.match(/^\/api\/public\/stallions\/([0-9a-f-]{36})$/);
    if (one) {
      if (url.searchParams.get("view") === "1") state.views++;
      if (one[1] === ID_A) return route.fulfill({ json: { stallion: profile(ID_A, "Ledger Line") } });
      if (one[1] === ID_B) return route.fulfill({ json: { stallion: profile(ID_B, "New Star", { mine: true, status: "published", owner: { views30: 9, requests: 1, newRequests: 1 } }) } });
      return route.fulfill({ status: 404, json: { error: "This stallion isn't listed any more." } });
    }
    if (!signedIn) return route.fulfill({ status: 401, json: { error: "Not signed in." } });
    if (path === "/api/stallions/mine") return route.fulfill({ json: { stallions: [], access: { allowed: true }, writer: false } });
    if (path === "/api/stallions/mares") return route.fulfill({ json: { mares: [] } });
    if (path === "/api/stallions/limits") return route.fulfill({ json: { videoBytes: 50 * 1024 * 1024, videoSeconds: 180, photos: 8, videos: 3, documents: 5 } });
    if (path === "/api/billing/overview") return route.fulfill({ json: { catalog: [] } });
    const save = path.match(/^\/api\/stallions\/([^/]+)\/save$/);
    if (save) {
      const body = request.postDataJSON();
      state.saves.push(body);
      return route.fulfill({ json: { saved: body.on, saves: body.on ? 4 : 3 } });
    }
    const ask = path.match(/^\/api\/stallions\/([^/]+)\/request$/);
    if (ask) {
      state.requests.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { conversationId: CONVO, requestId: "r1" } });
    }
    if (path === "/api/stallions" && method === "POST") {
      const body = request.postDataJSON();
      state.created.push(body);
      return route.fulfill({ status: 201, json: { stallion: profile(ID_B, body.name, { mine: true }) } });
    }
    if (path === "/api/stallions/requests")
      return route.fulfill({
        json: {
          requests: [
            { id: "r1", stallionId: ID_A, stallionName: "Ledger Line", senderName: "Bree Breeder", ownerName: "Olive Owner", conversationId: CONVO,
              mare: { name: "My Mare", sire: "Big Sire", dam: "Her Dam", status: "maiden" }, seasonYear: 2026, method: "live_cover",
              message: "Hello, I'd like to book.", status: "new", ownerNote: "", cover: null, createdAt: "2026-11-21T12:00:00Z", updatedAt: "2026-11-21T12:00:00Z" },
          ],
        },
      });
    const patch = path.match(/^\/api\/stallions\/requests\/([^/]+)$/);
    if (patch && method === "PATCH") {
      const body = request.postDataJSON();
      state.patches.push(body);
      return route.fulfill({ json: { request: { id: patch[1], status: body.status ?? "new", ownerNote: body.ownerNote ?? "" } } });
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return state;
}

test("Stallions is in the sidebar and the directory shows stallions with fee, breeding and region", async ({ page }) => {
  await mockApp(page);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Stallions", exact: true }).first().click();
  await expect(page).toHaveURL(/\/stallions$/);
  await expect(page.getByRole("heading", { name: "Stallions", level: 1 })).toBeVisible();
  const first = page.locator(".st-card").filter({ hasText: "Ledger Line" });
  await expect(first).toContainText("$7,500");
  await expect(first).toContainText("by Northern Ledger out of Quiet Line");
  await expect(first).toContainText("Taking bookings");
  await expect(page.locator(".st-card").filter({ hasText: "Quick Sprinter" })).toContainText("Private fee");
  await expect(page.getByRole("navigation", { name: "Stayblz Stallions" }).getByRole("link", { name: "My stallions" })).toBeVisible();
  // What isn't finished says so.
  await expect(page.getByRole("note").filter({ hasText: "Under work" })).toContainText("until US results arrive");
});

test("filters live in the address and reach the API; Save updates the count", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/stallions");
  await page.getByLabel("Breed").selectOption("quarter_horse");
  await expect(page).toHaveURL(/breed=quarter_horse/);
  await expect(page.locator(".st-card")).toHaveCount(1);
  expect(state.queries.some((q) => q.includes("breed=quarter_horse"))).toBe(true);
  await expect(page.getByRole("button", { name: /Remove filter Quarter Horse/ })).toBeVisible();
  await page.getByRole("button", { name: /Remove filter Quarter Horse/ }).click();
  await expect(page.locator(".st-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Save Ledger Line" }).click();
  await expect(page.getByRole("button", { name: "Remove Ledger Line from saved" })).toContainText("4");
  expect(state.saves).toEqual([{ on: true }]);
});

test("pick two stallions to compare them side by side", async ({ page }) => {
  await mockApp(page);
  await page.goto("/stallions");
  await page.locator(".st-card").filter({ hasText: "Ledger Line" }).getByLabel("Compare").check();
  await expect(page.getByRole("region", { name: "Compare stallions" })).toContainText("1 of 3");
  await page.locator(".st-card").filter({ hasText: "Quick Sprinter" }).getByLabel("Compare").check();
  await page.getByRole("region", { name: "Compare stallions" }).getByRole("button", { name: "Compare" }).click();
  await expect(page).toHaveURL(/\/stallions\/compare\?ids=/);
  const table = page.locator(".st-compare");
  await expect(table).toContainText("Ledger Line");
  await expect(table).toContainText("Quick Sprinter");
  await expect(table.getByRole("row", { name: /Fee/ }).first()).toContainText("$7,500");
  await expect(table).toContainText("Offspring in Stayblz racing data");
});

test("a stallion's page: fee, pedigree, offspring from racing data; a breeding request goes to chat", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto(`/stallions/${ID_A}`);
  await expect(page.getByRole("heading", { name: "Ledger Line", level: 1 })).toBeVisible();
  await expect(page.locator(".st-fee-card")).toContainText("$7,500");
  await expect(page.locator(".st-fee-card")).toContainText("Live foal (stands and nurses)");
  await expect(page.getByRole("figure", { name: "Ledger Line's pedigree" })).toContainText("Old Ledger");
  await expect(page.locator(".st-offspring")).toContainText("Ledger Kid");
  await expect(page.locator(".st-offspring")).toContainText("Stakes winners");
  await expect(page.getByText("From the owner").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Contract 2026.pdf" })).toHaveAttribute("href", /\/api\/public\/stallions\/media\/d1$/);
  expect(state.views).toBe(1);

  await page.locator(".st-fee-card").getByRole("button", { name: "Ask about a breeding" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask about breeding to Ledger Line" });
  await dialog.getByLabel("Mare's name").fill("My Mare");
  await dialog.getByLabel("Her sire").fill("Big Sire");
  await dialog.getByLabel("Her status").selectOption("maiden");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("dialog", { name: "Request sent" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the chat" })).toHaveAttribute("href", `/messages/${CONVO}`);
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0].mare).toMatchObject({ name: "My Mare", status: "maiden", pedigree: { s: "Big Sire" } });
  expect(state.requests[0].message).toContain("Ledger Line");
  expect(state.requests[0].method).toBe("live_cover");
});

test("the photo viewer always has a way out: Close, Escape and the Back button", async ({ page }) => {
  await mockApp(page);
  await page.goto(`/stallions/${ID_A}`);
  await page.getByRole("button", { name: /Open photo 1 of 2 full screen/ }).click();
  const viewer = page.getByRole("dialog", { name: /Ledger Line: photo 1 of 2/ });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Close" })).toBeVisible();
  await viewer.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog", { name: /photo 2 of 2/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /full screen/ }).click();
  await expect(page.getByRole("dialog", { name: /Ledger Line: photo/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/stallions/${ID_A}$`));
  await page.getByRole("button", { name: /full screen/ }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/stallions/${ID_A}$`));
});

test("signed out: stallion pages are public (to share them); asking and listing need an account", async ({ page }) => {
  await mockApp(page, { signedIn: false });
  await page.goto(`/stallions/${ID_A}`);
  await expect(page.getByRole("heading", { name: "Ledger Line", level: 1 })).toBeVisible();
  await expect(page.locator(".st-fee-card").getByRole("link", { name: "Log in to ask about a breeding" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Stayblz Stallions" }).getByRole("link", { name: "My stallions" })).toHaveCount(0);
  await page.goto("/stallions");
  await expect(page.locator(".st-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Log in to save Ledger Line" })).toBeVisible();
  await page.goto("/stallions/manage");
  await expect(page).toHaveURL(/\/login$/);
});

test("the mating check: a typed-in mare against one stallion, and against every stallion", async ({ page }) => {
  await mockApp(page);
  await page.goto(`/stallions/mating?stallion=${ID_A}`);
  await expect(page.locator(".st-picked")).toContainText("Ledger Line");
  await page.getByLabel("Mare's name").fill("Test Mare");
  await page.getByLabel("Her sire").fill("Big Sire");
  await page.getByRole("button", { name: "Check this mating" }).click();
  const results = page.getByRole("region", { name: "Mating check results" });
  await expect(results).toContainText("6.3%");
  await expect(results.locator(".st-shared")).toContainText("Big Sire");
  await expect(results.locator(".st-shared")).toContainText("3×2");
  await expect(results).toContainText("Ledger Line out of mares by Big Sire");

  await page.locator(".st-picked").getByRole("button", { name: "Check every stallion instead" }).click();
  await page.getByRole("button", { name: "Check her against every stallion" }).click();
  const list = page.getByRole("region", { name: "Every stallion for this mare" });
  await expect(list).toContainText("Ledger Line");
  await expect(list).toContainText("Big Sire 3×2");
});

test("listing a stallion: the form sends whole-amount fees, live cover for Thoroughbreds, and the owner's confirmation", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/stallions/manage/new");
  await expect(page.getByRole("heading", { name: "List a stallion" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("New Star");
  await page.getByLabel("Town and state").fill("Ocala, Florida");
  await page.getByLabel("Region (for search)").selectOption("US-FL");
  await page.locator("#st-fee").fill("5000");
  await page.getByLabel("Sire", { exact: true }).fill("Big Sire");
  await page.getByLabel("Dam", { exact: true }).fill("Star Dam");
  await expect(page.getByLabel("Cooled shipped semen")).toBeDisabled();
  await expect(page.locator(".st-soon-line")).toContainText("coming soon");
  await expect(page.getByRole("button", { name: "Write a draft for me" })).toHaveCount(0);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("alert")).toContainText("Tick the box");
  await page.getByLabel(/I own or manage this stallion/).check();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(new RegExp(`/stallions/${ID_B}$`));
  expect(state.created).toHaveLength(1);
  expect(state.created[0]).toMatchObject({ name: "New Star", fee: 5000, region: "US-FL", methods: ["live_cover"], confirm: true, publish: true, pedigree: { s: "Big Sire", d: "Star Dam" } });
});

test("the requests board: the owner sees the mare and sets a status", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/stallions/requests");
  const row = page.locator(".st-request").first();
  await expect(row).toContainText("From Bree Breeder");
  await expect(row).toContainText("My Mare");
  await expect(row).toContainText("by Big Sire out of Her Dam");
  await expect(row.getByRole("link", { name: "Open the chat" })).toHaveAttribute("href", `/messages/${CONVO}`);
  await row.getByLabel("Status").selectOption("booked");
  await expect(row.locator(".st-request-head .st-tag")).toHaveText("Booked");
  expect(state.patches).toEqual([{ status: "booked" }]);
});

test("phones: the directory, a stallion page and the mating check fit 375px without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await mockApp(page);
  for (const path of ["/stallions", `/stallions/${ID_A}`, "/stallions/mating"]) {
    await page.goto(path);
    await expect(page.locator(".st-page").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

