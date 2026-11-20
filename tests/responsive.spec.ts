import { expect, test } from "@playwright/test";
import { mockWorkspace } from "./workspace-fixture";

// Site-wide layout check (2026-11-20, boss's "works on every phone and computer"): the main signed-in pages, from a
// 320 px phone to a 2560 px screen, never scroll sideways, and on phones the bottom tab bar stays pinned to the
// bottom of the screen after scrolling (it once floated mid-page on iPhone). Pages with data have their own specs.

const me = { id: "11111111-1111-4111-8111-111111111111", username: "me@example.test", displayName: "Rae Rider", role: "member", email: "me@example.test" };
const ROUTES = [
  "/dashboard",
  "/community",
  "/marketplace",
  "/tv",
  "/account/horses",
  "/my-racing",
  "/messages",
  "/account",
  "/account/notifications",
  "/updates",
  "/subscription",
  "/results",
  "/statistics",
  "/stables",
];
const WIDTHS = [320, 390, 1024, 2560];

for (const width of WIDTHS) {
  test(`no sideways scrolling at ${width}px${width < 900 ? "; the tab bar stays at the bottom" : ""}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mockWorkspace(page);
    await page.addInitScript(() => localStorage.setItem("stayblz.token", "browser-test-token"));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/me") return route.fulfill({ json: { user: me } });
      if (path.startsWith("/api/workspaces")) return route.fallback();
      return route.fulfill({ json: {} });
    });
    await page.setViewportSize({ width, height: width < 900 ? 820 : 900 });
    for (const path of ROUTES) {
      await page.goto(path);
      await expect(page.locator(".gx-header")).toBeVisible();
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} at ${width}px scrolls sideways`).toBeLessThanOrEqual(1);
      if (width < 900) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(120);
        const gap = await page.locator(".gx-tabbar").evaluate((el) => Math.round(window.innerHeight - el.getBoundingClientRect().bottom));
        expect(gap, `${path}: tab bar should sit at the bottom of the screen`).toBeGreaterThanOrEqual(8);
        expect(gap, `${path}: tab bar should sit at the bottom of the screen`).toBeLessThanOrEqual(14);
      }
    }
  });
}
