import { test, expect, type Page } from "@playwright/test";

// Stayblz Data = FormFav (Meeting / Stats); the Equibase Races / Horses tabs are hidden.
// Every API is mocked: these tests prove the page flow, not the real backend or FormFav itself.
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const meetingRace = (date: string, number: number, name: string, hour: string, runners: number) => ({
  number,
  name,
  distance: "6f",
  raceClass: "MCL",
  abandoned: false,
  startTime: `${date}T${hour}:00:00Z`,
  timezone: "America/New_York",
  runners,
});
// Plays the server: every day in from…to, chosen codes and countries (zones only change which day a meeting is on).
function meetings(url: URL) {
  const from = url.searchParams.get("from")!;
  const to = url.searchParams.get("to") ?? from;
  const codes = (url.searchParams.get("race_codes") ?? "gallops,harness,greyhounds").split(",");
  const countries = (url.searchParams.get("countries") ?? "us,ca").split(",");
  const out = [];
  for (let date = from; date <= to; date = shift(date, 1)) {
    out.push(
      { date, raceCode: "gallops", timezone: "America/New_York", track: "Woodbine", slug: "woodbine", country: "ca", abandoned: false, races: [meetingRace(date, 1, "Woodbine Maiden", "18", 10)] },
      {
        date,
        raceCode: "gallops",
        timezone: "America/New_York",
        track: "Del Mar",
        slug: "del-mar",
        country: "us",
        abandoned: false,
        races: [meetingRace(date, 1, "Del Mar Allowance", "20", 3), meetingRace(date, 2, "Del Mar Claiming", "21", 9)],
      },
      { date, raceCode: "harness", timezone: "America/New_York", track: "Mohawk", slug: "mohawk", country: "ca", abandoned: false, races: [meetingRace(date, 1, "Mohawk Pace", "23", 8)] },
    );
  }
  return { from, to, partial: false, meetings: out.filter((m) => codes.includes(m.raceCode) && countries.includes(m.country)) };
}

const record = (starts: number, wins: number, winPercent: number, placePercent: number) => ({ starts, wins, places: wins + 1, winPercent, placePercent });
const race = (date: string, withResult: boolean) => ({
  form: {
    date,
    track: "Del Mar",
    raceNumber: 1,
    raceName: "Del Mar Allowance",
    distance: "1260m",
    condition: "Good 4",
    weather: "Fine",
    raceClass: "BM66",
    abandoned: false,
    startTime: `${date}T20:00:00Z`,
    timezone: "America/Los_Angeles",
    prizeMoney: "30000",
    numberOfRunners: 3,
    runners: [
      { number: 1, name: "Jewels Statement", jockey: "Ben Looker", trainer: "Samantha McGuren", weight: 59, claim: null, barrier: 7, age: 6, sex: "Mare", sire: null, dam: null, careerPrizeMoney: null, form: "617X3", last20Starts: null, scratched: false, stats: { overall: record(26, 5, 0.19, 0.5) }, speedMap: null, classProfile: null, badges: [{ label: "First-Up Specialist", sentiment: "+", detail: "40% first-up win rate" }] },
      { number: 3, name: "Bellarata", jockey: "Jett Newman", trainer: "Matthew Dunn", weight: 56, claim: null, barrier: 1, age: 5, sex: "Mare", sire: null, dam: null, careerPrizeMoney: null, form: "2131", last20Starts: null, scratched: false, stats: { overall: record(10, 3, 0.3, 0.7) }, speedMap: null, classProfile: null, badges: [] },
      { number: 2, name: "Gone Missing", jockey: null, trainer: null, weight: null, claim: null, barrier: null, age: null, sex: null, sire: null, dam: null, careerPrizeMoney: null, form: null, last20Starts: null, scratched: true, stats: null, speedMap: null, classProfile: null, badges: [] },
    ],
  },
  predictions: {
    confidence: "medium",
    modelVersion: "2026-11-21",
    predictedAt: `${date}T00:00:00Z`,
    runners: [
      { number: 1, name: "Jewels Statement", winProb: 0.16, placeProb: 0.33, rank: 2 },
      { number: 3, name: "Bellarata", winProb: 0.34, placeProb: 0.61, rank: 1 },
    ],
  },
  results: withResult
    ? {
        status: "final",
        updatedAt: `${date}T04:09:00Z`,
        revised: false,
        placings: [
          { number: 2, name: "Gone Missing", jockey: null, trainer: null, barrier: null, position: null, margin: null, scratched: true, startingPrice: null },
          { number: 1, name: "Jewels Statement", jockey: "Ben Looker", trainer: null, barrier: 7, position: 2, margin: "1.7", scratched: false, startingPrice: 6.5 },
          { number: 3, name: "Bellarata", jockey: "Jett Newman", trainer: null, barrier: 1, position: 1, margin: "0.0", scratched: false, startingPrice: 2.6 },
        ],
      }
    : null,
});

// A–Z lists (the server sorts; the fixtures are shuffled on purpose).
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const HORSES = [
  ...Array.from({ length: 42 }, (_, i) => `Runner ${String.fromCharCode(90 - (i % 26))}${i}`),
  "Zephyr",
  "apple Pie",
  "Bold Ruler",
].map((name, i) => ({
  name,
  code: i % 9 === 0 ? "harness" : "gallops",
  countries: [i % 4 === 0 ? "ca" : "us"],
  starts: 3,
  wins: name === "Zephyr" ? 2 : 0,
  places: 1,
  lastStart: { date: shift(today(), -2), track: "Del Mar", slug: "del-mar", position: 2 },
  nextEntry: name === "Zephyr" ? { date: today(), track: "Del Mar", slug: "del-mar", country: "us", code: "gallops", timezone: "America/New_York", raceNumber: 1, startTime: `${today()}T20:00:00Z` } : null,
  jockey: "Joel Rosario",
  trainer: "Bob Baffert",
}));
const SURNAMES = ["Velazquez", "Rosario", "Prat", "Ortiz", "Castellano", "Saez", "Gaffalione", "Geroux", "Hernandez", "Smith", "Alvarado", "Franco", "Lanerie", "Leparoux", "Lezcano", "Rispoli", "Rocco", "Santana", "Torres", "Zayas", "Baird", "Cohen", "Davis", "Elliott", "Fresu"];
const JOCKEY_ROWS = SURNAMES.map((s, i) => ({ kind: "jockey", name: `${String.fromCharCode(65 + (25 - i))}. ${s}`, rides: 10 + i, wins: i, places: i + 2, winRate: i / (10 + i), upcoming: i % 3, tracks: 2, lastRide: shift(today(), -1) }));
const bySurname = (a: { name: string }, b: { name: string }) => collator.compare(a.name.split(" ").at(-1)!, b.name.split(" ").at(-1)!);
const listMeta = { building: false, updatedAt: new Date().toISOString(), coverage: { from: shift(today(), -29), to: shift(today(), 2) } };

async function mockFormFav(page: Page, opts: { enabled?: boolean; meetingsStatus?: number; withResult?: boolean; partial?: boolean } = {}) {
  const requests: string[] = [];
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: { id: "member", username: "member", displayName: "Racing Member", role: "member" } } });
    if (!path.startsWith("/api/stayblz-data/formfav")) {
      if (path.startsWith("/api/stayblz-data")) requests.push("EQUIBASE " + path);
      return route.fulfill({ status: 403, json: { error: "Private workspace" } });
    }
    requests.push(path + url.search);
    const date = url.searchParams.get("date") ?? today();
    if (path.endsWith("/status")) return route.fulfill({ json: { enabled: opts.enabled ?? true } });
    if (path.endsWith("/meetings"))
      return opts.meetingsStatus
        ? route.fulfill({ status: opts.meetingsStatus, json: { error: "FormFav data isn't available right now." } })
        : route.fulfill({ json: { ...meetings(url), partial: opts.partial ?? false } });
    if (path.endsWith("/race")) return route.fulfill({ json: race(date, opts.withResult ?? true) });
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const codes = (url.searchParams.get("codes") ?? "gallops,harness").split(",");
    const countries = (url.searchParams.get("countries") ?? "us,ca").split(",");
    const pageOf = <T,>(rows: T[]) => ({ ...listMeta, records: rows.slice(offset, offset + limit), nextOffset: offset + limit < rows.length ? offset + limit : null, total: rows.length });
    if (path.endsWith("/horses"))
      return route.fulfill({
        json: pageOf(
          HORSES.filter((h) => codes.includes(h.code) && h.countries.some((c) => countries.includes(c)) && h.name.toLowerCase().includes(q)).sort((a, b) =>
            collator.compare(a.name, b.name),
          ),
        ),
      });
    if (path.endsWith("/horse")) {
      const h = HORSES.find((x) => x.name === url.searchParams.get("name"));
      if (!h) return route.fulfill({ status: 404, json: { error: "Not found." } });
      const start = (date: string, status: string, position: number | null) => ({ date, code: "gallops", timezone: "America/New_York", track: "Del Mar", slug: "del-mar", country: "us", raceNumber: 1, raceName: "Del Mar Allowance", startTime: `${date}T20:00:00Z`, status, position, scratched: false, jockey: "Joel Rosario", trainer: "Bob Baffert" });
      return route.fulfill({ json: { ...h, history: [start(today(), "pending", null), start(shift(today(), -2), "final", 1), { ...start(shift(today(), -9), "final", null), scratched: true }] } });
    }
    if (path.endsWith("/people")) {
      const kind = url.searchParams.get("kind");
      const rows = kind === "trainer" ? [{ ...JOCKEY_ROWS[0], kind: "trainer", name: "Bob Baffert" }] : JOCKEY_ROWS.filter((p) => p.name.toLowerCase().includes(q)).sort(bySurname);
      return route.fulfill({ json: pageOf(rows) });
    }
    if (path.endsWith("/search")) {
      const sq = url.searchParams.get("q") ?? "";
      if (url.searchParams.get("kind") === "runner")
        return route.fulfill({ json: { query: sq, results: sq === "Zephyr" ? [{ id: 77, name: "Zephyr", country: "USA", totalStarts: 12, lastRaceDate: shift(today(), -2), sire: "Into Mischief", dam: "Breeze" }] : [] } });
      return route.fulfill({ json: { query: sq, results: [] } });
    }
    if (path.endsWith("/runner/77"))
      return route.fulfill({
        json: { runner: { name: "Zephyr", country: "USA", age: 4, sex: "gelding", sire: "Into Mischief", dam: "Breeze" }, career: { totalStarts: 12, wins: 4, seconds: 2, thirds: 1, winRate: 0.33, placeRate: 0.58 }, distances: [], conditions: [], venues: [], spells: [], jockeys: [], classProfile: null, runningStyle: null, formTrend: null, trialForm: null, sire: null },
      });
    if (path.endsWith("/jockey/James%20McDonald") || path.endsWith("/jockey/Ben%20Looker") || /\/jockey\/[A-Z]\.%20/.test(path))
      return route.fulfill({
        json: {
          kind: "jockey",
          name: decodeURIComponent(path.split("/").pop()!),
          raceCode: "R",
          totalStarts: 2645,
          totalWins: 645,
          winRate: 0.2439,
          placeRate: 0.52,
          ambiguous: false,
          bestCondition: "Heavy",
          worstCondition: "Good",
          tracks: [{ venue: "Randwick", totalStarts: 428, wins: 111, winRate: 0.259, placeRate: 0.544 }],
          conditions: [],
        },
      });
    if (path.endsWith("/track-bias/del-mar"))
      return route.fulfill({
        json: {
          venue: "Del Mar",
          raceCode: "R",
          totalRaces: 385,
          expectedWinRate: 0.1223,
          strongestBarrier: 6,
          weakestBarrier: 9,
          biasStrength: "none",
          barriers: [{ barrierNumber: 1, totalStarts: 341, wins: 52, winRate: 0.1525, placeRate: 0.4223, advantage: 0.0302 }],
          distances: [],
        },
      });
    return route.fulfill({ status: 404, json: { error: "Not found." } });
  });
  return requests;
}

const ALL = "race_codes=gallops%2Charness%2Cgreyhounds&timezones=America%2FNew_York%2CAmerica%2FLos_Angeles&countries=us%2Cca";

test("FormFav tab lists US and Canada meetings, filters them and opens a race with form, predictions and result", async ({ page }) => {
  const requests = await mockFormFav(page);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Stayblz Data" }).first().click();
  await expect(page).toHaveURL(/\/stayblz-data$/);
  await expect(page.getByText("Racing in the United States and Canada")).toBeVisible();
  // Meeting is the first tab; the Equibase Races / Horses tabs are gone and never asked for.
  const tabs = page.getByRole("navigation", { name: "Stayblz Data sections" }).getByRole("button");
  await expect(tabs).toHaveText(["Meeting", "Horses", "Stats"]);
  await expect(page.getByRole("button", { name: "Meeting", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "3 meetings" })).toBeVisible();
  // Default: today only, every code, both zones, both countries.
  expect(requests).toContain(`/api/stayblz-data/formfav/meetings?from=${today()}&to=${today()}&${ALL}`);
  for (const name of ["Thoroughbreds", "Harness", "Greyhounds", "New York", "Los Angeles", "United States", "Canada"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Country" }).getByRole("button")).toHaveCount(2);
  await expect(page.getByRole("group", { name: "Day by" }).getByRole("button")).toHaveCount(2);

  // The track filter works on the loaded list without asking again.
  await page.getByLabel("Filter tracks").fill("moh");
  await expect(page.getByText("Woodbine", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Mohawk", { exact: true })).toBeVisible();
  await page.getByLabel("Filter tracks").fill("");

  // Canada off → United States only; the last country can't be switched off.
  await page.getByRole("button", { name: "Canada", exact: true }).click();
  await expect(page).toHaveURL(/country=us(&|$)/);
  await expect(page.getByRole("status").filter({ hasText: "1 meeting" })).toBeVisible();
  await page.getByRole("button", { name: "United States", exact: true }).click();
  await expect(page.getByRole("button", { name: "United States", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Canada", exact: true }).click();
  await expect(page).not.toHaveURL(/country=/);

  // Del Mar race 1.
  await page.getByRole("button", { name: /Del Mar/ }).click();
  await page.getByRole("button", { name: /R1 Del Mar Allowance/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Del Mar Allowance" })).toBeVisible();
  expect(
    requests.some(
      (r) => r.startsWith("/api/stayblz-data/formfav/race?") && r.includes("track=del-mar") && r.includes("race=1") && r.includes("country=us") && r.includes("timezone=America%2FNew_York"),
    ),
  ).toBe(true);
  await expect(dialog.getByText("Jewels Statement")).toBeVisible();
  await expect(dialog.getByText("First-Up Specialist")).toBeVisible();
  await expect(dialog.getByRole("row", { name: /Gone Missing/ })).toHaveClass(/is-scratched/);

  await dialog.getByRole("button", { name: "Predictions" }).click();
  await expect(dialog.getByText("Medium confidence", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("row").nth(1)).toContainText("Bellarata");
  await expect(dialog.getByRole("row").nth(1)).toContainText("34%");

  await dialog.getByRole("button", { name: "Result" }).click();
  await expect(dialog.getByText("Final result")).toBeVisible();
  await expect(dialog.getByRole("row").nth(1)).toContainText("Bellarata");
  await expect(dialog.getByRole("row").nth(1)).toContainText("$2.60");
  await expect(dialog.getByRole("row").last()).toContainText("SCR");

  expect(requests.filter((r) => r.startsWith("EQUIBASE"))).toEqual([]);

  // A jockey's name opens their stats.
  await dialog.getByRole("button", { name: "Ben Looker" }).click();
  await expect(page.getByRole("dialog").getByText("2,645 starts", { exact: false })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("FormFav codes and time zones: one, two or all", async ({ page }) => {
  const requests = await mockFormFav(page);
  await page.goto("/stayblz-data");
  await expect(page.getByRole("status").filter({ hasText: "3 meetings" })).toBeVisible();
  await page.getByRole("button", { name: "Greyhounds", exact: true }).click();
  await expect(page).toHaveURL(/codes=gallops%2Charness|codes=gallops,harness/);
  await expect.poll(() => requests.at(-1)).toContain("race_codes=gallops%2Charness&");
  await page.getByRole("button", { name: "Thoroughbreds", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 meeting" })).toBeVisible();
  await expect(page.getByText("Mohawk", { exact: true })).toBeVisible();
  await expect(page.getByText("1 race · Harness")).toBeVisible();
  // Harness is the only one left: it stays on.
  await page.getByRole("button", { name: "Harness", exact: true }).click();
  await expect(page.getByRole("button", { name: "Harness", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Los Angeles", exact: true }).click();
  await expect(page).toHaveURL(/tz=ny/);
  await expect.poll(() => requests.at(-1)).toContain("timezones=America%2FNew_York&");
  await page.getByRole("button", { name: "New York", exact: true }).click();
  await expect(page.getByRole("button", { name: "New York", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Los Angeles", exact: true }).click();
  await expect(page).not.toHaveURL(/tz=/);
});

test("FormFav day range: several days or a single day", async ({ page }) => {
  const requests = await mockFormFav(page);
  const from = shift(today(), -2);
  await page.goto(`/stayblz-data?from=${from}&to=${today()}`);
  await expect(page.getByRole("status").filter({ hasText: "9 meetings" })).toBeVisible();
  expect(requests).toContain(`/api/stayblz-data/formfav/meetings?from=${from}&to=${today()}&${ALL}`);
  await expect(page.getByRole("textbox", { name: "To", exact: true })).toHaveAttribute("min", from);
  await expect(page.getByRole("textbox", { name: "To", exact: true })).toHaveAttribute("max", [shift(today(), 7), shift(from, 6)].sort()[0]);

  await page.getByRole("button", { name: "Single day" }).click();
  await expect(page.getByRole("status").filter({ hasText: "3 meetings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Single day" })).toHaveCount(0);
  await expect.poll(() => requests.at(-1)).toBe(`/api/stayblz-data/formfav/meetings?from=${from}&to=${from}&${ALL}`);

  // A range longer than 7 days from the address falls back to a single day.
  await page.goto(`/stayblz-data?from=${shift(today(), -20)}&to=${today()}`);
  await expect.poll(() => requests.at(-1)).toBe(`/api/stayblz-data/formfav/meetings?from=${shift(today(), -20)}&to=${shift(today(), -20)}&${ALL}`);
});

test("FormFav race without a result yet says so; track bias opens", async ({ page }) => {
  await mockFormFav(page, { withResult: false });
  await page.goto("/stayblz-data");
  await page.getByRole("button", { name: /Del Mar/ }).click();
  await page.getByRole("button", { name: /R1 Del Mar Allowance/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Result" }).click();
  await expect(dialog.getByText("No result yet.")).toBeVisible();
  await dialog.getByRole("button", { name: "Track bias" }).click();
  await expect(page.getByRole("dialog").getByText("Strongest barrier 6", { exact: false })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("+3.0 pts")).toBeVisible();
});

test("Horses and Stats tabs, and older links", async ({ page }) => {
  await mockFormFav(page);
  await page.goto("/stayblz-data");
  await page.getByRole("button", { name: "Horses", exact: true }).click();
  await expect(page).toHaveURL(/tab=horses/);
  await expect(page.getByRole("status").filter({ hasText: "Showing 20 of 45 horses" })).toBeVisible();
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page).toHaveURL(/tab=stats/);
  await expect(page.getByRole("status").filter({ hasText: "Showing 20 of 25 jockeys" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Horses", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Links from before: the Equibase races tab and the old FormFav tab land on Meeting; ff=stats on Stats.
  for (const old of ["?tab=races", "?tab=formfav"]) {
    await page.goto("/stayblz-data" + old);
    await expect(page.getByRole("button", { name: "Meeting", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await page.goto("/stayblz-data?tab=formfav&ff=stats");
  await expect(page.getByRole("button", { name: "Stats", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Horses: every horse A–Z, 20 per scroll, with search and filters", async ({ page }) => {
  const requests = await mockFormFav(page);
  await page.goto("/stayblz-data?tab=horses");
  await expect(page.getByRole("status").filter({ hasText: "Showing 20 of 45 horses" })).toBeVisible();
  expect(requests).toContain("/api/stayblz-data/formfav/horses?offset=0&limit=20&codes=gallops%2Charness&countries=us%2Cca");
  await expect(page.getByText(/Horses from US and Canada race cards/)).toBeVisible();
  const names = await page.locator(".sd-ff-row .sd-title").allTextContents();
  expect(names).toEqual([...HORSES.map((h) => h.name)].sort(collator.compare).slice(0, 20));
  expect(names[0]).toBe("apple Pie");
  // Only the first page until the end of the list comes near.
  expect(requests.some((r) => r.includes("/horses?offset=20"))).toBe(false);
  await page.getByRole("button", { name: "Load more horses" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("status").filter({ hasText: "Showing 40 of 45 horses" })).toBeVisible();
  await page.getByRole("button", { name: "Load more horses" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("status").filter({ hasText: "Showing 45 of 45 horses" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Load more/ })).toHaveCount(0);

  await page.getByLabel("Search horses").fill("zeph");
  await expect(page.getByRole("status").filter({ hasText: "Showing 1 of 1 horses" })).toBeVisible();
  await expect(page.getByText("Entered: Del Mar R1", { exact: false })).toBeVisible();
  await page.getByLabel("Search horses").fill("");
  await page.getByRole("button", { name: "Harness", exact: true }).click();
  await expect(page).toHaveURL(/hcodes=gallops/);
  await expect.poll(() => requests.at(-1)).toContain("codes=gallops&countries=us%2Cca");
  await page.getByRole("button", { name: "United States", exact: true }).click();
  await expect.poll(() => requests.at(-1)).toContain("codes=gallops&countries=ca");
});

test("A horse: starts, entries and FormFav career; its race opens", async ({ page }) => {
  const requests = await mockFormFav(page);
  await page.goto("/stayblz-data?tab=horses");
  await page.getByLabel("Search horses").fill("zephyr");
  await page.getByRole("button", { name: /Zephyr/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Zephyr", level: 2 }).first()).toBeVisible();
  expect(requests).toContain("/api/stayblz-data/formfav/horse?name=Zephyr&code=gallops");
  await expect(dialog.getByRole("row").nth(1)).toContainText("Entered");
  await expect(dialog.getByRole("row").nth(2)).toContainText("1st");
  await expect(dialog.getByRole("row").nth(3)).toHaveClass(/is-scratched/);
  // Career from FormFav, found by name.
  await expect(dialog.getByText("12 starts", { exact: false })).toBeVisible();
  expect(requests.some((r) => r.startsWith("/api/stayblz-data/formfav/search?kind=runner&q=Zephyr"))).toBe(true);
  // A race from the list opens the race.
  await dialog.getByRole("row").nth(2).getByRole("button").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Del Mar Allowance" })).toBeVisible();
});

test("Stats: jockeys A–Z by surname, 20 per scroll; trainers; a jockey opens", async ({ page }) => {
  const requests = await mockFormFav(page);
  await page.goto("/stayblz-data?tab=stats");
  await expect(page.getByRole("status").filter({ hasText: "Showing 20 of 25 jockeys" })).toBeVisible();
  const names = await page.locator(".sd-ff-row .sd-title").allTextContents();
  expect(names).toEqual([...JOCKEY_ROWS].sort(bySurname).slice(0, 20).map((p) => p.name));
  expect(names[0]).toMatch(/Alvarado$/);
  expect(requests).toContain("/api/stayblz-data/formfav/people?kind=jockey&offset=0&limit=20&codes=gallops%2Charness&countries=us%2Cca");
  await page.getByRole("button", { name: "Load more jockeys" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("status").filter({ hasText: "Showing 25 of 25 jockeys" })).toBeVisible();

  await page.getByLabel("Search jockeys").fill("rosario");
  await expect(page.getByRole("status").filter({ hasText: "Showing 1 of 1 jockeys" })).toBeVisible();
  await page.getByRole("button", { name: /Rosario/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("US & Canada, last 30 days")).toBeVisible();
  await expect(dialog.getByText("2,645 starts", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Trainers", exact: true }).click();
  await expect(page).toHaveURL(/kind=trainer/);
  await expect(page.getByRole("status").filter({ hasText: "Showing 1 of 1 trainers" })).toBeVisible();
  await expect(page.getByText("Bob Baffert")).toBeVisible();
});

test("FormFav errors and a missing key show friendly messages", async ({ page }) => {
  await mockFormFav(page, { meetingsStatus: 503 });
  await page.goto("/stayblz-data");
  await expect(page.getByRole("alert")).toContainText("Try again");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockFormFav(page, { partial: true });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("may be incomplete");
  await expect(page.getByRole("status").filter({ hasText: "3 meetings" })).toBeVisible();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockFormFav(page, { enabled: false });
  await page.reload();
  await expect(page.getByText("FormFav data isn't available right now")).toBeVisible();
});

test("FormFav tab fits a phone screen", async ({ page }) => {
  await mockFormFav(page);
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto("/stayblz-data");
  await page.getByRole("button", { name: /Del Mar/ }).click();
  await expect(page.getByRole("button", { name: /R1 Del Mar Allowance/ })).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0)
    console.log(await page.evaluate(() => [...document.querySelectorAll(".sd *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 8).map((e) => e.className + " " + Math.round(e.getBoundingClientRect().right))));
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: /R1 Del Mar Allowance/ }).click();
  await expect(page.getByRole("dialog").getByText("Jewels Statement")).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const tab of ["horses", "stats"]) {
    await page.goto("/stayblz-data?tab=" + tab);
    await expect(page.getByRole("status").filter({ hasText: "Showing 20" })).toBeVisible();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
  }
});
