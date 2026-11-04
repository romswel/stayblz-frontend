import { test, expect } from "@playwright/test";
async function openPPLink(page: import("@playwright/test").Page, name: string) {
  const nav = page.getByRole("navigation", { name: "PP pages" });
  await expect(nav).toBeVisible();
  const target = page.getByText(name, { exact: true });
  const menu = nav.locator("details").filter({ has: target });
  if ((await menu.count()) && (await menu.getAttribute("open")) === null)
    await menu.locator("summary").click();
  return nav.getByRole("link", { name, exact: true });
}
const user = { id: "pp-customer", displayName: "PP Customer", role: "member" };
const sections = {
  racecards: [],
  results: [],
  workouts: [],
  horses: [],
  jockeys: [],
  trainers: [],
  stakes: [],
  notes: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user } });
    if (path === "/api/workspaces")
      return route.fulfill({ json: { stables: [] } });
    if (path === "/api/public/racing-overview")
      return route.fulfill({
        json: { sections, fetchedAt: "2026-11-04T00:00:00Z" },
      });
    return route.fulfill({
      status: 503,
      json: { error: "Service unavailable" },
    });
  });
});

test("PP overview has seven report cards and real detail/compare navigation", async ({
  page,
}) => {
  await page.goto("/pps");
  await expect(
    page.getByRole("heading", { name: "Past Performances", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pp-card")).toHaveCount(7);
  await expect(
    page.getByText("Catalogue preview", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Thoroughbred", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Harness", exact: true }),
  ).toBeVisible();
  await page.locator(".pp-card").first().click();
  await expect(page).toHaveURL(/\/pps\/premium$/);
  await expect(
    page.getByText("No PP files available", { exact: true }),
  ).toBeVisible();
  await (await openPPLink(page, "Compare PPs")).click();
  await page.getByLabel("Race type").selectOption("Harness");
  await expect(page.locator(".pp-table tbody tr")).toHaveCount(3);
  await (await openPPLink(page, "Day pass plans")).click();
  await expect(
    page.getByText("No day pass plans available yet."),
  ).toBeVisible();
  await page.goto("/pps/store");
  await page.getByRole("link", { name: "Browse all PPs", exact: true }).click();
  await expect(page.locator(".pp-card")).toHaveCount(7);
});

test("PP sidebar expands from collapsed desktop and exposes grouped pages", async ({
  page,
}) => {
  await page.goto("/pps");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle PP menu", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Collapse sidebar", exact: true }),
  ).toBeVisible();
  // The first click closes an already open group; reopening must stay usable.
  const toggle = page.getByRole("button", {
    name: "Toggle PP menu",
    exact: true,
  });
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Lifetime PPs", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pps\/lifetime$/);
  await expect(
    page.getByRole("heading", { name: "Lifetime PPs", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Overview", exact: true }),
  ).not.toHaveClass(/active/);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("track browser handles empty, loaded, filtered and unavailable records", async ({
  page,
}) => {
  await page.goto("/pps/by-track");
  await expect(page.getByText("No tracks available yet.")).toBeVisible();
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({
      json: {
        sections: {
          ...sections,
          racecards: [
            {
              id: "r1",
              name: "Race entry",
              track: "Test Track",
              date: "2026-11-04",
            },
          ],
        },
        fetchedAt: "2026-11-04T00:00:00Z",
      },
    }),
  );
  await page
    .getByRole("button", { name: "Refresh tracks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test Track", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Race date").fill("2026-11-04");
  await page.getByLabel("Search tracks").fill("missing");
  await expect(page.getByText("No tracks match your filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Race date")).toHaveValue("");
  await expect(page.getByLabel("Search tracks")).toHaveValue("");
  await page.getByRole("link", { name: "View PP option" }).click();
  await expect(page.getByText("Test Track", { exact: true })).toBeVisible();
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Track service unavailable" },
    }),
  );
  await page.goto("/pps/by-track");
  await expect(page.getByRole("alert")).toContainText(
    "Track service unavailable",
  );
  await expect(
    page.getByText("Tracks could not be loaded. Try Refresh tracks."),
  ).toBeVisible();
});

test("PP pages fit phone/tablet/desktop themes and mobile submenu navigates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 768, 1440, 2560]) {
    await page.setViewportSize({ width, height: 950 });
    for (const path of [
      "/pps",
      "/pps/compare",
      "/pps/premium",
      "/pps/by-track",
      "/pps/day-passes",
    ]) {
      await page.goto(path);
      await expect(page.locator(".pps-page h1")).toBeVisible();
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
        }, theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 950 });
  await page.goto("/pps");
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await dialog
    .getByRole("link", { name: "Basic PP Program", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/pps\/basic$/);
  await page.goto("/pps");
  await page.screenshot({
    path: "test-results/pps-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await expect(page.locator(".ws-main")).toHaveCSS("margin-left", "218px");
  expect(
    await page
      .locator(".pps-page")
      .evaluate((el) => el.getBoundingClientRect().left),
  ).toBeGreaterThanOrEqual(218);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/pps-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "test-results/pps-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("signed-out PP links keep their destination through login", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in" } }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { user } }),
  );
  await page.goto("/pps/harness-pro");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("Email or admin username", { exact: true })
    .fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/pps\/harness-pro$/);
});

test("PP label navigates separately from its arrow and top links work on every page", async ({
  page,
}) => {
  await page.goto("/entries");
  const sidebar = page.getByRole("navigation", { name: "Main" });
  const toggle = sidebar.getByRole("button", { name: "Toggle PP menu" });
  await toggle.click();
  await expect(page).toHaveURL(/\/entries$/);
  await sidebar
    .getByRole("link", { name: "Past performances (PPs)", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pps$/);
  await (await openPPLink(page, "Compare PPs")).click();
  await page
    .locator(".pp-table")
    .getByRole("link", { name: "View details", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/pps\/premium$/);
  await page.getByRole("link", { name: "Back to previous PP page" }).click();
  await expect(page).toHaveURL(/\/pps\/compare$/);
  await (await openPPLink(page, "Harness Pro")).click();
  await expect(page).toHaveURL(/\/pps\/harness-pro$/);
  await expect(await openPPLink(page, "Store")).toBeVisible();
  await page.goto("/pps/basic");
  await page.getByRole("link", { name: "Back to previous PP page" }).click();
  await expect(page).toHaveURL(/\/pps$/);
  await page.getByRole("link", { name: "Back to racing overview" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("top PP navigation mirrors every sidebar destination and marks the current report", async ({
  page,
}) => {
  await page.goto("/pps");
  const top = page.getByRole("navigation", { name: "PP pages" });
  const sidebar = page.locator(".pp-nav-children");
  const destinations = (links: import("@playwright/test").Locator) =>
    links.evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("href")).sort(),
    );
  expect(await destinations(top.locator("a"))).toEqual(
    await destinations(sidebar.getByRole("link")),
  );
  for (const link of [
    "Lifetime PPs",
    "Daily Racing Form",
    "Harness Platinum",
    "Basic PPs",
  ]) {
    await (await openPPLink(page, link)).click();
    await expect(
      top.locator("a").filter({ has: page.getByText(link, { exact: true }) }),
    ).toHaveAttribute("aria-current", "page");
    await expect(top.locator('[aria-current="page"]')).toHaveCount(1);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/pps/lifetime");
  const active = await openPPLink(page, "Lifetime PPs");
  await expect(active).toBeInViewport();
  await active.focus();
  await expect(active).toBeFocused();
});

test("PP report search and race-type filters update the catalogue", async ({
  page,
}) => {
  await page.goto("/pps");
  await page.getByRole("button", { name: "Harness", exact: true }).click();
  await expect(page.locator(".pp-card")).toHaveCount(3);
  await page.getByLabel("Search PP reports").fill("platinum");
  await expect(page.locator(".pp-card")).toHaveCount(1);
  await page.locator(".pp-card").click();
  await page.getByRole("link", { name: "Back to previous PP page" }).click();
  await expect(page.getByLabel("Search PP reports")).toHaveValue("platinum");
  await expect(page.locator(".pp-card")).toHaveCount(1);
  await page.getByLabel("Search PP reports").fill("no-such-report");
  await expect(page.getByText("No matching reports.")).toBeVisible();
  await page.getByRole("button", { name: "Clear report filters" }).click();
  await expect(page.locator(".pp-card")).toHaveCount(7);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".pp-route-content")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("PP dropdowns close on navigation, outside click and Escape with keyboard focus", async ({
  page,
}) => {
  await page.goto("/pps/premium");
  const nav = page.getByRole("navigation", { name: "PP pages" });
  const menu = nav.locator("details").first();
  const trigger = menu.locator("summary");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await nav.locator("summary").nth(1).click();
  await expect(nav.locator("details[open]")).toHaveCount(1);
  await page.locator("h1").click();
  await expect(nav.locator("details[open]")).toHaveCount(0);
  await (await openPPLink(page, "Lifetime PPs")).click();
  await expect(nav.locator("details[open]")).toHaveCount(0);
  await expect(nav.locator("summary.is-current")).toContainText("Thoroughbred");
});

test("PP dropdown panels stay within phone and desktop layouts", async ({
  page,
}) => {
  await page.goto("/pps/premium");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      await openPPLink(page, "Lifetime PPs");
      const panel = page.locator(".pp-page-menu[open] .pp-page-menu-panel");
      const rect = await panel.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `test-results/pp-menu-${width}-${theme}.png`,
        animations: "disabled",
      });
      await page.locator("h1").click();
    }
  }
});

test("Thoroughbred navigation contains only the five supplied report pages", async ({
  page,
}) => {
  await page.goto("/pps");
  const links = page.locator(".pp-nav-children a");
  for (const name of ["TrackMaster EquiGraphix", "TrackMaster Plus Pro"]) {
    await expect(links.filter({ hasText: name })).toHaveCount(0);
    await expect(
      page.locator(".pp-card").filter({ hasText: name }),
    ).toHaveCount(0);
  }
  const group = page
    .getByRole("navigation", { name: "PP pages" })
    .locator("details")
    .first();
  await group.locator("summary").click();
  await expect(group.getByRole("link")).toHaveCount(5);
  for (const path of ["/pps/equigraphix", "/pps/plus-pro"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Report not found", exact: true }),
    ).toBeVisible();
  }
});
