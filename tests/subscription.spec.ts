import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend.
async function signedIn(page: Page, theme = "light") {
  await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: { id: "m", username: "m", displayName: "Racing Member", role: "member" } } });
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
}

test("Support menu has Subscription, which opens an honest no-plan page", async ({ page }) => {
  await signedIn(page);
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Subscription", exact: true }).click();
  await expect(page).toHaveURL(/\/subscription$/);
  await expect(page.getByRole("heading", { name: /Subscription/, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No subscription" })).toBeVisible();
  await expect(page.getByText(/nothing is charged/)).toBeVisible();
  await expect(nav.getByRole("link", { name: "Subscription", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "STAYBLZ TV" }).last().click();
  await expect(page).toHaveURL(/\/tv$/);
});

test("signed-out visitors opening /subscription are sent to log in", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { error: "Sign in to continue." } }));
  await page.goto("/subscription");
  await expect(page).toHaveURL(/\/login/);
});

test("phone 320px dark: Subscription fits and is in the phone menu", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page, "dark");
  await page.goto("/subscription");
  await expect(page.getByRole("heading", { name: "No subscription" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Subscription", exact: true }).first()).toBeVisible();
});
