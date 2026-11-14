import { test, expect } from "@playwright/test";
const user = {
  id: "harness-customer",
  displayName: "Harness Customer",
  role: "member",
};
const sections = {
  racecards: [
    {
      id: "h-entry",
      name: "Evening Trot",
      track: "Harness Test Track",
      date: "2026-11-05",
      category: "harness",
    },
    {
      id: "t-entry",
      name: "Flat Race",
      track: "Flat Test Track",
      date: "2026-11-05",
      category: "thoroughbred",
    },
    {
      id: "unknown",
      name: "Unclassified",
      track: "Unknown Track",
      date: "2026-11-05",
    },
  ],
  horses: [
    {
      id: "h-a",
      name: "Test Pacer A",
      category: "harness",
      starts: 8,
      wins: 1,
      detail: "Published harness record A",
    },
    {
      id: "h-b",
      name: "Test Trotter B",
      category: "harness",
      starts: 4,
      wins: 3,
    },
    {
      id: "t-a",
      name: "Flat Horse",
      category: "thoroughbred",
      starts: 90,
      wins: 40,
    },
  ],
  results: [],
  workouts: [],
  jockeys: [],
  trainers: [],
  stakes: [],
  notes: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/auth/me") return route.fulfill({ json: { user } });
    if (pathname === "/api/workspaces")
      return route.fulfill({ json: { stables: [] } });
    if (pathname === "/api/public/racing-overview")
      return route.fulfill({
        json: { sections, fetchedAt: "2026-11-05T00:00:00Z" },
      });
    return route.fulfill({ status: 503, json: { error: "Not available" } });
  });
});
test("Harness report flows use only harness tracks and connect to the cart preview", async ({
  page,
}) => {
  for (const id of ["harness-racecard", "harness-form"]) {
    await page.goto(`/pps/${id}?date=2026-11-05`);
    await expect(
      page.getByRole("checkbox", { name: "Harness Test Track", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Day pass", exact: false }),
    ).toHaveCount(0);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    await page.getByRole("link", { name: "View cart", exact: true }).click();
    await expect(page.locator(".pp-cart-items")).toContainText(
      "Harness Test Track",
    );
    await page.goto(`/pps/${id}/features`);
    await expect(page.locator(".pp-feature-details")).toContainText(
      "Pace and trot",
    );
    await page
      .getByRole("navigation", { name: "Report pages" })
      .getByRole("link", { name: "Sample layout", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Download unavailable" }),
    ).toBeDisabled();
    await page
      .getByRole("navigation", { name: "Report pages" })
      .getByRole("link", { name: "Reading guide", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Read harness form", exact: true }),
    ).toBeVisible();
  }
  await page.goto("/pps/by-track?type=Harness");
  await expect(
    page.getByRole("heading", { name: "Harness Test Track", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Flat Test Track", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "View PP option", exact: true }).click();
  await expect(page).toHaveURL(/\/pps\/harness-racecard\?/);
});
test("Harness workspace sorts, searches and opens only published harness records", async ({
  page,
}) => {
  await page.goto("/pps/harness-workspace");
  await expect(
    page.locator(".pp-harness-workspace table tbody tr"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Show", exact: true })
    .selectOption("horses");
  await expect(page.locator(".pp-harness-workspace tbody tr")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("wins");
  await expect(
    page.locator(".pp-harness-workspace tbody tr").first(),
  ).toContainText("Test Trotter B");
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("starts");
  await expect(
    page.locator(".pp-harness-workspace tbody tr").first(),
  ).toContainText("Test Pacer A");
  await page
    .getByLabel("Search harness records", { exact: true })
    .fill("Pacer");
  await expect(page.locator(".pp-harness-workspace tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Test Pacer A", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Selected harness record" }),
  ).toContainText("Published harness record A");
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Selected harness record" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open my notes", exact: true }).first(),
  ).toHaveAttribute("href", "/my-racing?tab=notes");
  await page
    .getByLabel("Search harness records", { exact: true })
    .fill("not-there");
  await expect(page.getByRole("status")).toContainText(
    "No matching harness records",
  );
  await page.route("**/api/public/racing-overview", (r) =>
    r.fulfill({ status: 503, json: { error: "Harness source unavailable" } }),
  );
  await page
    .getByRole("button", { name: "Refresh records", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Harness source unavailable",
  );
});
test("all report pages use original product identity while old bookmarks redirect", async ({
  page,
}) => {
  for (const id of [
    "racecard",
    "detailed-racecard",
    "race-day-summary",
    "form-comparison",
    "horse-history",
    "harness-racecard",
    "harness-form",
    "harness-workspace",
  ]) {
    await page.goto(`/pps/${id}/features`);
    await expect(page.locator(".pp-feature-details")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /TrackMaster|Equibase|Daily Racing Form|Beyer|Timeform|equineline/i,
    );
  }
  await page.goto("/pps/premium/free-race?date=2026-11-05");
  await expect(page).toHaveURL(
    /\/pps\/detailed-racecard\/sample\?date=2026-11-05$/,
  );
  await page.goto("/pps/harness-platinum/features");
  await expect(page).toHaveURL(/\/pps\/harness-form\/features$/);
  await page.goto("/pps/daily-racing-form");
  await expect(page).toHaveURL(/\/pps\/race-day-summary$/);
});
test("old supplier cart choices are not relabelled as new products", async ({
  page,
}) => {
  const old = JSON.stringify([
    {
      productId: "premium",
      kind: "card",
      date: "2026-11-05",
      track: "Old Track",
      horseId: "",
      horseName: "",
    },
  ]);
  await page.addInitScript(
    (value) =>
      sessionStorage.setItem("stayblz.cart-preview.harness-customer", value),
    old,
  );
  await page.goto("/pps/cart");
  await expect(page.locator(".pp-cart-items li")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "previous selections were not turned into new products",
  );
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("stayblz.cart-preview.harness-customer"),
    ),
  ).toBe(old);
  await page.goto("/pps/harness-racecard");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await page.reload();
  await expect(page.locator(".pp-cart-items li")).toHaveCount(1);
});
test("signed-out old Harness links keep their new destination after login", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ status: 401, json: { error: "Not signed in" } }),
  );
  await page.route("**/api/auth/login", (r) => r.fulfill({ json: { user } }));
  await page.goto("/pps/harness-pro?list=horses&sort=wins");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("Email", { exact: true })
    .fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    /\/pps\/harness-workspace\?list=horses&sort=wins$/,
  );
  await expect(
    page.locator(".pp-harness-workspace tbody tr").first(),
  ).toContainText("Test Trotter B");
});
test("Harness pages fit phone, tablet and desktop in both themes", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const path of [
      "/pps/harness-racecard",
      "/pps/harness-form/features",
      "/pps/harness-form/sample",
      "/pps/harness-workspace?list=horses",
    ]) {
      await page.goto(path);
      await expect(page.locator(".pps-page h1")).toBeVisible();
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
  }
  await page.goto("/pps/harness-workspace?list=horses");
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page.screenshot({
    path: "test-results/harness-workspace-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 950 });
  await page.goto("/pps/harness-form/features");
  await page.screenshot({
    path: "test-results/harness-form-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("the active Harness destination stays visible inside the sidebar", async ({
  page,
}) => {
  test.skip(true, "PP sidebar menu is hidden for now (SHOW_PP_NAV in src/components/Layout.tsx)");
  await page.goto("/pps/harness-workspace");
  const menu = page.locator(".pp-nav-children");
  const selected = menu.locator('a[href="/pps/harness-workspace"]');
  await expect(selected).toHaveClass(/active/);
  await expect
    .poll(async () => {
      const m = await menu.boundingBox();
      const a = await selected.boundingBox();
      return !!m && !!a && a.y >= m.y && a.y + a.height <= m.y + m.height;
    })
    .toBe(true);
});
