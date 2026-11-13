import { mockWorkspace } from "./workspace-fixture";
import { test, expect } from "@playwright/test";

const sections = {
  racecards: [
    {
      id: "r1",
      name: "Autumn Cup",
      track: "Test Park",
      date: "2026-11-03",
      race: "R4",
      time: "14:30",
      distance: "1600m",
      surface: "Turf",
      runners: 8,
    },
    {
      id: "r2",
      name: "Evening Sprint",
      track: "Second Park",
      race: "R6",
      time: "16:00",
      distance: "1200m",
      surface: "Dirt",
      runners: 7,
    },
  ],
  results: [
    {
      id: "result1",
      name: "Published Winner",
      track: "Test Park",
      race: "R2",
      time: "12:00",
      margin: "1 length",
    },
  ],
  workouts: [
    {
      id: "work1",
      name: "Morning Horse",
      track: "Test Park",
      time: "06:00",
      distance: "800m",
    },
  ],
  horses: [
    { id: "h1", name: "Form Leader", starts: 10, wins: 4, figure: 110 },
    { id: "h2", name: "Next Horse", starts: 5, wins: 1, figure: 98 },
  ],
  jockeys: [{ id: "j1", name: "Published Rider", starts: 20, wins: 5 }],
  trainers: [{ id: "t1", name: "Published Trainer", starts: 30, wins: 6 }],
  stakes: [
    {
      id: "s1",
      name: "Autumn Stakes",
      track: "Test Park",
      date: "2026-11-06",
      distance: "1800m",
      surface: "Turf",
    },
  ],
  notes: [
    {
      id: "n1",
      name: "Track notice",
      category: "Race day changes",
      summary: "Published update",
      body: "Complete published notice.",
    },
  ],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("stayblz.theme", "light"),
  );
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "member",
            username: "member",
            displayName: "Racing Member",
            role: "member",
          },
        },
      });
    if (path === "/api/public/racing-overview")
      return route.fulfill({
        json: { sections, fetchedAt: "2026-11-03T06:00:00Z" },
      });
    if (path.startsWith("/api/racing/published/"))
      return route.fulfill({
        json: {
          records:
            sections[path.split("/").pop() as keyof typeof sections] ?? [],
          nextOffset: null,
        },
      });
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
});

test("members get the overview, visible tools, filtered records and useful details", async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/(feed|dashboard|messages|inventory|horses)(\/|$)/.test(
        new URL(r.url()).pathname,
      )
    ) {
      privateRequests.push(r.url());
      expect(r.headers()["x-stayblz-stable"]).toBeUndefined();
    }
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Overview." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Stayblz Chat", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter overview by track" })
    .selectOption("Test Park");
  await expect(page.getByRole("button", { name: /Autumn Cup/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Evening Sprint/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Autumn Cup/ }).click();
  const dialog = page.getByRole("dialog", { name: "Autumn Cup" });
  await expect(dialog).toContainText("1600m");
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Search racing records").fill("Morning Horse");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .locator("#racing-desk")
    .getByRole("button", { name: "Workouts", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Morning Horse/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Stayblz Chat", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Stayblz Chat", exact: true }),
  ).toBeVisible();
  await expect.poll(() => privateRequests.length).toBeGreaterThan(0);
  for (const url of privateRequests)
    expect(new URL(url).pathname).not.toBe("/api/dashboard");
});

test("sidebar leaves out the racing pages and the PP menu", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(
    nav.getByRole("link", { name: "Following & notebook", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Overview",
    "Entries",
    "Results & Charts",
    "Workouts",
    "Speed Figures",
    "Statistics",
    "Stakes Schedule",
    "Past performances (PPs)",
  ])
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  await expect(nav.getByText("Racing", { exact: true })).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "Toggle PP menu" }),
  ).toHaveCount(0);
});

test("sidebar collapse persists, theme works and header actions are honest", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Shopping cart" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "checkout are not available yet",
  );
  await page.keyboard.press("Escape");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share overview" }).click();
  await expect(page.getByText("Overview link copied.")).toBeVisible();
});

test("overview handles unavailable data and preserves the last records after failed refresh", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /Autumn Cup/ })).toBeVisible();
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Records temporarily unavailable." },
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Showing last loaded records.",
  );
  await expect(page.getByRole("button", { name: /Autumn Cup/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Records temporarily unavailable.",
  );
  await expect(
    page.getByRole("heading", { name: "Entries & results", exact: true }),
  ).toBeVisible();
});

test("dashboard works across widths, themes, mobile navigation and reduced motion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 640, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: /Autumn Cup/ }),
    ).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 375) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Navigation" });
      await expect(menu).toBeVisible();
      await menu.locator(".ws-workspace-disclosure > summary").click();
      await menu.getByRole("link", { name: "Inventory", exact: true }).click();
      await expect(menu).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Inventory", exact: true }),
      ).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /Autumn Cup/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
});

test("admin stable summaries use stored records and keep working when one source fails", async ({
  page,
}) => {
  const mockCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/dashboard")
      mockCalls.push(request.url());
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: { id: "admin", displayName: "Stable Admin", role: "superadmin" },
      },
    }),
  );
  await page.route("**/api/inventory", (route) =>
    route.fulfill({ json: { items: [{ id: "stored-horse" }] } }),
  );
  await page.route("**/api/horses", (route) =>
    route.fulfill({
      json: {
        horses: [
          {
            id: "stored-horse",
            name: "Stored Horse",
            status: "Race ready",
            nextRace: "Published engagement",
          },
        ],
      },
    }),
  );
  await page.route("**/api/feed", (route) =>
    route.fulfill({
      json:
        route.request().method() === "POST"
          ? {
              post: {
                id: "p2",
                author: "Stable Admin",
                role: "superadmin",
                body: "Saved update",
                createdAt: "2026-11-03T00:00:00Z",
              },
            }
          : { posts: [] },
    }),
  );
  await page.route("**/api/team-messages", (route) =>
    route.fulfill({ status: 503, json: { error: "Messages unavailable" } }),
  );
  await page.goto("/workspace");
  const stable = page.locator("#stable-activity");
  await expect(stable.getByText("Stored Horse", { exact: true })).toBeVisible();
  await expect(
    stable
      .locator(".ov-stable-stats")
      .getByRole("link", { name: "1 Horses in stable" }),
  ).toBeVisible();
  await expect(
    stable.getByText("Messages could not be loaded.", { exact: true }),
  ).toBeVisible();
  await stable.getByLabel("Write a feed post").fill("Saved update");
  await stable.getByRole("button", { name: "Post", exact: true }).click();
  await expect(stable.getByLabel("Write a feed post")).toHaveValue("");
  await expect(stable.getByText("Saved update", { exact: true })).toBeVisible();
  expect(mockCalls).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-admin.png",
    fullPage: true,
  });
});

test.beforeEach(async ({ page }) => {
  await mockWorkspace(page);
});
