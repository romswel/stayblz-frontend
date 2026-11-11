import { mockWorkspace } from "./workspace-fixture";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("stayblz.token", "browser-test-token"),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === "/api/auth/me"
        ? {
            user: {
              id: "u1",
              username: "test",
              displayName: "Test User",
              role: "superadmin",
            },
          }
        : {};
    await route.fulfill({ json: data });
  });
});

test("racing pages distinguish an empty result from loading", async ({
  page,
}) => {
  const cases: [string, RegExp][] = [
    ["entries", /No racing published for/],
    ["results", /No racing published for/],
    ["speed-figures", /Speed figures aren't available yet/],
    ["stakes", /No upcoming stakes published/],
    ["statistics", /No official results for these filters yet/],
    ["workouts", /No published workouts for these dates/],
  ];
  // Empty (and even incomplete) replies must show an empty state, never a stuck loader or a crash.
  await page.route("**/api/public/racing/**", (route) => route.fulfill({ json: {} }));
  for (const [path, empty] of cases) {
    await page.goto("/" + path);
    await expect(page.getByRole("heading", { name: empty })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /Loading/ })).toHaveCount(0);
  }
  await page.goto("/betting");
  await expect(
    page.getByText(/No real-money bets can be placed/),
  ).toBeVisible();
});

test("late thread responses cannot replace the latest selected conversation", async ({
  page,
}) => {
  const preview = (id: string) => ({
    id,
    title: "Thread " + id,
    participants: ["Test"],
    lastMessage: "Preview",
    lastMessageAt: "2026-10-31T00:00:00Z",
    unread: 0,
  });
  await page.route("**/api/messages", (route) =>
    route.fulfill({ json: { conversations: [preview("a"), preview("b")] } }),
  );
  await page.route("**/api/messages/*", async (route) => {
    const id = route.request().url().split("/").pop()!;
    if (id === "a") await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      json: {
        conversation: {
          ...preview(id),
          messages: [
            {
              id,
              from: "Test",
              body: "Body " + id,
              sentAt: "2026-10-31T00:00:00Z",
              mine: false,
            },
          ],
        },
      },
    });
  });
  await page.goto("/messages");
  // Open the slow chat, then switch before it answers.
  await page.getByRole("link", { name: /Thread a/ }).click();
  await page.getByRole("link", { name: /Thread b/ }).click();
  await expect(page.getByText("Body b", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText("Body a", { exact: true })).toHaveCount(0);
  await expect(page.locator(".mx-thread-head")).toContainText("Thread b");
  // Empty box: no Send button, just the quick thumbs up.
  await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send a thumbs up" })).toBeVisible();
});

test("watch updates reject duplicate clicks and show failures without losing the list", async ({
  page,
}) => {
  await page.route("**/api/watchlist", (route) =>
    route.fulfill({
      json: {
        stable: [
          {
            id: "horse-test",
            name: "Test Horse",
            watched: false,
            lastActivity: "Test",
            nextAlert: null,
          },
        ],
      },
    }),
  );
  let calls = 0;
  await page.route("**/api/watchlist/toggle", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ status: 500, json: { error: "Test save failure" } });
  });
  await page.goto("/virtual-stable");
  const button = page.getByRole("button", {
    name: "Watch Test Horse",
    exact: true,
  });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText("Test save failure");
  await expect(button).toBeEnabled();
  expect(calls).toBe(1);
});

test("inventory dialog traps keyboard focus and restores its trigger", async ({
  page,
}) => {
  await page.route("**/api/inventory", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "h1",
            saddlecloth: 1,
            silksColor: "#333333",
            coatColor: "#333333",
            maneColor: "#111111",
            blaze: false,
            horseName: "Test Horse",
            breed: "Test",
            age: 4,
            sex: "Mare",
            status: "Active",
            stable: "Test",
            valueUsd: 100,
            acquiredAt: "2026-10-01",
          },
        ],
      },
    }),
  );
  await page.route("**/api/horses/*", (route) =>
    route.fulfill({ status: 404, json: { error: "Not tracked" } }),
  );
  await page.goto("/inventory");
  const trigger = page.getByRole("row", {
    name: "View details for Test Horse",
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("login retains its layout at mobile and desktop widths", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in" } }),
  );
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("failed feed submission keeps the draft and reports the failure", async ({
  page,
}) => {
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: {
        stats: { horses: 0, raceReady: 0, inWork: 0, recovering: 0, unread: 0 },
        engagements: [],
        recentMessages: [],
      },
    }),
  );
  await page.route("**/api/feed", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          json: { error: "Could not save test post" },
        })
      : route.fulfill({ json: { posts: [] } }),
  );
  await page.goto("/workspace");
  const draft = page.getByRole("textbox", { name: "Write a feed post" });
  await draft.fill("Keep this draft");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.locator("#stable-activity").getByRole("alert")).toHaveText(
    "Could not save test post",
  );
  await expect(draft).toHaveValue("Keep this draft");
});

test.beforeEach(async ({ page }) => {
  await mockWorkspace(page);
});
