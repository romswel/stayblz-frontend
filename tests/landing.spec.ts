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
  // The home page lists the newest Updates; tests never reach a real backend for them.
  await page.route("**/api/updates?*", (route) =>
    route.fulfill({ json: { updates: [], pinned: [], hasMore: false } }),
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
      page.locator(".lg-hero h1"),
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
    // The card keeps one size in every mode.
    expect((await page.locator("#account").boundingBox())?.height).toBe(
      initial?.height,
    );
    // Sign-up page 1 is only name, email and password, then Continue.
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Country", exact: true })).toHaveCount(0);
    if (width >= 1024) {
      // Desktop: page 1 fits in the card without scrolling.
      expect(
        await page.locator(".ld-auth-body").evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
    }
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
    page.locator(".lg-hero h1"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
});

test("the account card is hidden on the index and opens over the photo from Log in / Sign up", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const account = page.getByRole("region", { name: "Your Stayblz account" });
  await expect(page.locator(".ld-closing")).toHaveCount(0);
  await expect(account).toBeHidden();
  const copyBefore = await page.locator(".lg-copy").boundingBox();
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(account).toBeVisible();
  await expect(account).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Log in to Stayblz", exact: true }),
  ).toBeVisible();
  // Glass hero: the words on the left, the account card over the photo on the right.
  const hero = (await page.locator(".lg-hero").boundingBox())!;
  const card = (await account.boundingBox())!;
  const copyAfter = (await page.locator(".lg-copy").boundingBox())!;
  expect(card.x).toBeGreaterThan(hero.x + hero.width / 2);
  expect(card.y).toBeGreaterThanOrEqual(hero.y);
  expect(copyAfter.x + copyAfter.width).toBeLessThanOrEqual(card.x);
  // The words don't move when the card opens; the photo behind the card blurs.
  expect(Math.round(copyAfter.x)).toBe(Math.round(copyBefore!.x));
  expect(await page.locator(".lg-photo img").evaluate((el) => getComputedStyle(el).filter)).toContain("blur");
  // "New here? Sign up" is on the "Forgot password?" line, at the right.
  const forgot = (await account.getByRole("button", { name: "Forgot password?" }).boundingBox())!;
  const newHere = (await account.locator(".ld-auth-switch").boundingBox())!;
  expect(Math.abs(forgot.y + forgot.height / 2 - (newHere.y + newHere.height / 2))).toBeLessThanOrEqual(2);
  expect(newHere.x).toBeGreaterThan(forgot.x + forgot.width);
  expect(card.x + card.width - (newHere.x + newHere.width)).toBeLessThanOrEqual(24);
  await page.getByRole("button", { name: "Close account panel" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(account).toBeHidden();
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("button", { name: "Sign up", exact: true })
    .click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("First name", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(account).toBeHidden();
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
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
    page.getByLabel("Email", { exact: true }),
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
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("signed-in visitors skip the welcome and log in pages and go straight into Stayblz", async ({ page }) => {
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
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("region", { name: "Your Stayblz account" })).toHaveCount(0);
  }
  // Public pages still offer the way back in.
  await page.goto("/faq");
  await expect(page.getByRole("banner").getByRole("link", { name: /Continue to dashboard/ })).toBeVisible();
});

test("the home page explains what's inside and shows the newest Updates", async ({ page }) => {
  await page.route("**/api/updates?limit=3", (route) =>
    route.fulfill({
      json: {
        updates: [
          { id: "00000000-0000-4000-8000-000000000001", slug: "faster-racecards", kind: "update", title: "Faster racecards", summary: "Racecards open faster.", items: [], version: "0.16", audience: "public", pinned: false, popup: false, status: "published", publishedAt: "2026-11-17T08:00:00Z", authorLabel: "Stayblz team", updatedAt: "2026-11-17T08:00:00Z", readMinutes: 1, hasBody: false },
        ],
        pinned: [],
        hasMore: false,
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const inside = page.getByRole("region", { name: "One account for your racing" });
  await expect(inside.getByRole("heading", { name: "Stayblz Chat" })).toBeVisible();
  await expect(inside.getByRole("heading", { name: "Stayblz Paddock" })).toBeVisible();
  await expect(page.getByRole("region", { name: "What's new on Stayblz" }).getByRole("link", { name: /Faster racecards/ })).toHaveAttribute("href", "/updates/faster-racecards");
  await inside.getByRole("button", { name: "Create a free account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("motion reveals sections on scroll and reduced-motion disables animation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".ld-public-footer-top").scrollIntoViewIfNeeded();
  await expect(page.locator(".ld-public-footer-top")).toHaveClass(/ld-visible/);
  expect(
    await page
      .locator(".lg-photo img")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("lg-photo-drift");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".lg-photo img")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("footer Explore links sit in three columns and two rows without a Racing overview link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(nav.getByRole("link", { name: "Racing overview" })).toHaveCount(0);
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(6);
  const boxes = await Promise.all(
    (await links.all()).map(async (l) => (await l.boundingBox())!),
  );
  // Three columns, two rows, filled column by column:
  // FAQ / Updates · Terms / Privacy · Log in / Create an account.
  expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(2);
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(3);
  for (let i = 0; i < boxes.length; i += 2)
    expect(Math.abs(boxes[i].x - boxes[i + 1].x)).toBeLessThanOrEqual(1);
  // No sideways scrolling on a narrow phone.
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  // Explore sits at the right edge, mirroring the logo on the left.
  const footer = (await page.locator(".ld-public-footer-top").boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(footer.x + footer.width - (navBox.x + navBox.width)).toBeLessThanOrEqual(1);
  expect(navBox.height).toBeLessThan(100);
});

test("on load the hero fills the screen, so footer text only shows after scrolling", async ({
  page,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1920, 1080],
    [375, 812],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".lg-hero h1")).toBeVisible();
    const footerText = (await page.locator(".ld-public-footer-top").boundingBox())!;
    expect(footerText.y).toBeGreaterThanOrEqual(height);
  }
});
