import { test, expect } from "@playwright/test";
const sections = {
  racecards: [
    { id: "card-a", name: "Race A", track: "Test Track A", date: "2026-11-05" },
    { id: "card-b", name: "Race B", track: "Test Track B", date: "2026-11-05" },
    { id: "card-c", name: "Race C", track: "Other Day", date: "2026-11-06" },
  ],
  results: [],
  workouts: [],
  horses: [
    { id: "horse-a", name: "Test Horse" },
    { id: "harness-horse", name: "Test Horse Harness", category: "harness" },
  ],
  jockeys: [],
  trainers: [],
  stakes: [],
  notes: [],
};
const user = {
  id: "product-customer",
  displayName: "Product Customer",
  role: "member",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user } });
    if (path === "/api/workspaces")
      return route.fulfill({ json: { stables: [] } });
    if (path === "/api/public/racing-overview")
      return route.fulfill({
        json: { sections, fetchedAt: "2026-11-05T00:00:00Z" },
      });
    return route.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
});
test("five Thoroughbred reports have separate child pages and direct-entry parent links", async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const id of [
    "detailed-racecard",
    "racecard",
    "horse-history",
    "form-comparison",
    "race-day-summary",
  ]) {
    await page.goto(`/pps/${id}`);
    const nav = page.getByRole("navigation", { name: "Report pages" });
    await nav.getByRole("link", { name: "Features", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/pps/${id}/features$`));
    await expect(
      page.locator(`.pp-nav-children a[href="/pps/${id}"]`),
    ).toHaveClass(/active/);
    await expect(
      page.locator(".pp-feature-details article").first(),
    ).toBeVisible();
    await nav
      .getByRole("link", {
        name: "Sample layout",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Download unavailable" }),
    ).toBeDisabled();
    await expect(page.locator("iframe")).toHaveCount(0);
    await nav.getByRole("link", { name: "Reading guide", exact: true }).click();
    await page.locator(".pp-glossary summary").first().click();
    await expect(page.locator(".pp-glossary details").first()).toHaveAttribute(
      "open",
      "",
    );
    await page.goto("/pps");
    await page.goto(`/pps/${id}/guide`);
    await page.getByRole("link", { name: "Back to previous PP page" }).click();
    await expect(page).toHaveURL(new RegExp(`/pps/${id}$`));
  }
  await page.goto("/pps/racecard/subscriptions");
  await expect(
    page.getByRole("button", { name: "Subscribe unavailable" }),
  ).toBeDisabled();
  await page.goto("/pps/racecard/not-real");
  await expect(
    page.getByRole("heading", { name: "Page not found", exact: true }),
  ).toBeVisible();
});
test("cart preview deduplicates selections, persists per account, and never enables checkout", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await page.goto("/pps/detailed-racecard?date=2026-11-05");
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Test Track A", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Test Track B", exact: true })
    .check();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cart updated");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page
    .getByRole("button", { name: "Shopping cart", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Shopping cart" });
  await expect(modal.locator(".pp-cart-items li")).toHaveCount(2);
  await expect(
    modal.getByRole("button", { name: "Checkout unavailable" }),
  ).toBeDisabled();
  await modal
    .getByRole("button", { name: "Remove Test Track A", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Day pass", exact: false }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await expect(page.locator(".pp-cart-items li")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".pp-cart-items li")).toHaveCount(2);
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { user: { ...user, id: "another-customer" } } }),
  );
  await page.reload();
  await expect(page.locator(".pp-cart-items li")).toHaveCount(0);
  expect(writes).toEqual([]);
});
test("changing race date clears track choices and failed refresh blocks adding stale entries", async ({
  page,
}) => {
  await page.goto("/pps/racecard?date=2026-11-05");
  await page
    .getByRole("checkbox", { name: "Test Track A", exact: true })
    .check();
  await page.getByLabel("Race date", { exact: true }).fill("2026-11-06");
  await expect(
    page.getByRole("checkbox", { name: "Test Track A", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "Other Day", exact: true }).check();
  await page.route("**/api/public/racing-overview", (r) =>
    r.fulfill({ status: 503, json: { error: "Test data unavailable" } }),
  );
  await page
    .getByRole("button", { name: "Refresh tracks", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Test data unavailable");
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeDisabled();
});
test("horse history excludes Harness records and blocks stale cart selections", async ({
  page,
}) => {
  await page.goto("/pps/horse-history");
  await page.getByLabel("Birth year", { exact: true }).fill("2020");
  await page.getByLabel("Dam's name", { exact: true }).fill("Test Dam");
  await page
    .getByRole("button", { name: "Search horses", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("not connected yet");
  await page.getByLabel("Horse name", { exact: true }).fill("Test Horse");
  await page
    .getByRole("button", { name: "Search horses", exact: true })
    .click();
  await expect(page.locator(".pp-horse-results li")).toHaveCount(1);
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({ status: 503, json: { error: "Horse source unavailable" } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText("Horse source unavailable");
  await expect(
    page.getByRole("button", { name: "Add horse to cart", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/public/racing-overview");
  await page
    .getByRole("button", { name: "Retry horse search", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add horse to cart", exact: true })
    .click();
  await page.getByRole("link", { name: "View cart", exact: true }).click();
  await expect(page.locator(".pp-cart-items")).toContainText("Test Horse");
  await page.getByRole("button", { name: "Clear cart", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "Clear your cart?" })
    .getByRole("button", { name: "Clear cart", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your cart is empty.", exact: true }),
  ).toBeVisible();
});
test("invalid stored cart entries are ignored and valid deep product links survive sign-in", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "stayblz.cart-preview.v2.product-customer",
      JSON.stringify([
        { productId: "not-real", kind: "card", date: "broken" },
        null,
      ]),
    ),
  );
  await page.goto("/pps/cart");
  await expect(page.locator(".pp-cart-items li")).toHaveCount(0);
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ status: 401, json: { error: "Not signed in" } }),
  );
  await page.route("**/api/auth/login", (r) => r.fulfill({ json: { user } }));
  await page.goto("/pps/racecard/sample");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("Email", { exact: true })
    .fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/pps\/racecard\/sample$/);
});
test("product forms, features, samples and cart fit mobile and desktop in both themes", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/pps/detailed-racecard",
      "/pps/racecard/features",
      "/pps/horse-history",
      "/pps/form-comparison/sample",
      "/pps/race-day-summary/features",
      "/pps/cart",
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
  await page.goto("/pps/detailed-racecard/features");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "test-results/pp-premium-features-dark.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 950 });
  await page.goto("/pps/racecard");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.screenshot({
    path: "test-results/pp-basic-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("sign-in keeps the selected PP track and date", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in" } }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { user } }),
  );
  await page.goto("/pps/racecard?date=2026-11-05&track=Test%20Track%20A");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("Email", { exact: true })
    .fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    /\/pps\/racecard\?date=2026-11-05&track=Test%20Track%20A$/,
  );
  await expect(
    page.getByRole("checkbox", { name: "Test Track A", exact: true }),
  ).toBeChecked();
});
