import { test, expect } from "@playwright/test";

// API fixtures are confined to tests. The application has no sample fallback.
const sections = () => ({
  racecards: Array.from({ length: 14 }, (_, i) => ({
    id: `race-${i}`,
    name: `Recorded race ${i + 1}`,
    track: i % 2 ? "Track B" : "Track A",
    time: "14:30",
    race: `R${i + 1}`,
    surface: "Turf",
    distance: "1 mile",
    runners: 8,
  })),
  results: [
    {
      id: "result-1",
      name: "Recorded winner",
      track: "Track B",
      time: "1:36.18",
      race: "R1",
      date: "2026-11-01",
      margin: "1 length",
    },
  ],
  workouts: [
    {
      id: "work-1",
      name: "Recorded workout horse",
      track: "Track B",
      time: "00:48.20",
      distance: "4 furlongs",
    },
  ],
  horses: [
    { id: "horse-1", name: "Recorded leader", starts: 8, wins: 5, figure: 112 },
  ],
  jockeys: [{ id: "jockey-1", name: "Recorded rider", starts: 100, wins: 20 }],
  trainers: [
    { id: "trainer-1", name: "Recorded trainer", starts: 50, wins: 15 },
  ],
  stakes: [
    {
      id: "stake-1",
      name: "Recorded stakes",
      track: "Track A",
      date: "2026-11-14",
      surface: "Turf",
      distance: "1 mile",
    },
  ],
  notes: [
    {
      id: "note-1",
      name: "Published stable update",
      category: "Stable news",
      summary: "An update from the team.",
      body: "Published body returned by the API.",
    },
  ],
});
const overview = () => ({
  sections: sections(),
  fetchedAt: "2026-11-01T10:00:00Z",
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaces", route => route.fulfill({json:{stables:[]}}));
  await page.route("**/api/auth/**", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in." } }),
  );
  await page.route("**/api/racing/published/**", (route) =>
    route.fulfill({ json: { records: [], nextOffset: null } }),
  );
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({ json: overview() }),
  );
});

test("wide layout fills the viewport and every account mode stays within device width", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 640, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Recorded race 1", exact: true }),
    ).toBeVisible();
    const initial = await page.locator("#account").boundingBox();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Sign up", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("Email address")).toBeVisible();
    expect((await page.locator("#account").boundingBox())?.height).toBe(
      initial?.height,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width >= 1440) {
      const main = await page.locator(".ld-main").evaluate((el) => ({
        width: el.clientWidth,
        padding: parseFloat(getComputedStyle(el).paddingLeft),
      }));
      expect(main.width - main.padding * 2).toBeGreaterThan(width * 0.94);
    }
  }
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/landing-wide.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
});

test("table size stays fixed across long, short, filtered and empty views; overflow scrolls inside", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const panel = page.locator("#race-desk .ld-data-panel");
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toBeVisible();
  const before = await panel.boundingBox();
  const region = page.getByRole("region", { name: "Racecards", exact: true });
  expect(await region.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await page.getByLabel("Filter by track").selectOption("Track B");
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toHaveCount(0);
  expect((await panel.boundingBox())?.height).toBe(before?.height);
  await page
    .locator("#race-desk")
    .getByRole("button", { name: "Results", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recorded winner", exact: true }),
  ).toBeVisible();
  expect((await panel.boundingBox())?.height).toBe(before?.height);
  await page
    .locator("#race-desk")
    .getByRole("button", { name: "Workouts", exact: true })
    .click();
  await expect(page.getByText("00:48.20")).toBeVisible();
  expect((await panel.boundingBox())?.height).toBe(before?.height);
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({
      json: { ...overview(), sections: { ...sections(), workouts: [] } },
    }),
  );
  await page.getByRole("button", { name: "Refresh racing data" }).click();
  await expect(page.getByText("No workouts published yet.")).toBeVisible();
  expect((await panel.boundingBox())?.height).toBe(before?.height);
});

test("published data drives standings, news, track options and calendar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jockeys", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Recorded rider", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("20%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trainers", exact: true }).click();
  await expect(page.getByText("30%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read more", exact: true }).click();
  await expect(
    page.getByText("Published body returned by the API."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByText("Published body returned by the API."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Recorded stakes/ }),
  ).toBeVisible();
  await page
    .locator("#stakes-diary")
    .getByRole("button", { name: "Results", exact: true })
    .click();
  await expect(
    page
      .locator("#stakes-diary")
      .getByRole("button", { name: /Recorded winner/ }),
  ).toBeVisible();
});

test("failed refresh preserves loaded records; retry uses new database response with no old samples", async ({
  page,
}) => {
  await page.goto("/");
  const recordRegion = page.getByRole("region", {
    name: "Racecards",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toBeVisible();
  await recordRegion.evaluate((el) => {
    el.scrollTop = 180;
  });
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toBeVisible();
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Racing data is unavailable." },
    }),
  );
  await page.getByRole("button", { name: "Refresh racing data" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Showing the last loaded records.",
  );
  expect(await recordRegion.evaluate((el) => el.scrollTop)).toBe(180);
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toBeVisible();
  const next = overview();
  next.sections.racecards = [
    {
      ...next.sections.racecards[0],
      name: "Newly published race",
      track: "New track",
    },
  ];
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({ json: next }),
  );
  await page.getByRole("button", { name: "Refresh racing data" }).click();
  await expect(
    page.getByRole("button", { name: "Newly published race", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Recorded race 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByLabel("Filter by track")
      .getByRole("option", { name: "New track", exact: true }),
  ).toHaveCount(1);
});

test("empty and unavailable responses reserve panel space and never display fictional records", async ({
  page,
}) => {
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Racing data is unavailable." },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Racing data is unavailable.",
  );
  await expect(page.getByText("Records unavailable.")).toHaveCount(5);
  await expect(
    page.getByText(/Copper Almanac|Oakridge|Autumn Mile/),
  ).toHaveCount(0);
  const empty = overview();
  Object.values(empty.sections).forEach((rows) => rows.splice(0));
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({ json: empty }),
  );
  await page.getByRole("button", { name: "Refresh racing data" }).click();
  await expect(page.getByText("No racecards published yet.")).toBeVisible();
  await expect(page.getByText("No updates published yet.")).toBeVisible();
});

test("full view focuses account, handles failed login and continues to requested view", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/racing/entries", (route) =>
    route.fulfill({ json: { entries: [] } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "View Recorded race 1 racecard", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Your Stayblz account" }),
  ).toBeFocused();
  await expect(page.locator(".ld-auth-intent")).toHaveText(
    "Log in or sign up to view full racecards.",
  );
  await page
    .getByLabel("Email or admin username", { exact: true })
    .fill("rider");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: { error: "Invalid credentials" } }),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
  await expect(
    page.getByLabel("Email or admin username", { exact: true }),
  ).toHaveValue("rider");
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      json: {
        token: "test-token",
        user: {
          id: "u1",
          username: "rider",
          displayName: "Test Rider",
          role: "user",
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/entries$/);
});

test("returning user keeps index access", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("stayblz.token", "test-token"),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "u1",
          username: "rider",
          displayName: "Test Rider",
          role: "user",
        },
      },
    }),
  );
  for (const path of ["/", "/login", "/signup"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toContainText("Test Rider");
    await expect(
      page.getByRole("link", { name: /Continue to dashboard/ }).first(),
    ).toBeVisible();
  }
});

test("motion reveals sections on scroll and reduced-motion disables animation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#leaderboard").scrollIntoViewIfNeeded();
  await expect(page.locator("#leaderboard")).toHaveClass(/ld-visible/);
  expect(
    await page
      .locator(".ld-hero > img")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("ld-photo-drift");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".ld-hero > img")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
