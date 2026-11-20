import { test, expect } from "@playwright/test";

// The signed-out front door is a log in / sign up page and nothing else (boss + senior dev, 2026-11-19).
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { error: "Not signed in." } }));
});

test("the front door is only log in / sign up: no marketing sections, no racing data requests", async ({ page }) => {
  const racing: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(public|racing|updates)/.test(r.url())) racing.push(r.url());
  });
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Log in" })).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.locator("h2")).toHaveCount(0);
  expect(racing).toEqual([]);
  // Tabs switch the address, so Back and links work.
  await page.getByRole("tab", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Create your account", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  // A few quiet links stay at the bottom.
  for (const name of ["Terms & Privacy", "Help", "Updates"])
    await expect(page.getByRole("navigation", { name: "More from Stayblz" }).getByRole("link", { name })).toBeVisible();
});

test("every screen fits from small phones to wide screens, in both themes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.route("**/api/auth/forgot-password", (route) => route.fulfill({ status: 202, json: { ok: true } }));
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
    for (const width of [320, 375, 768, 1024, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/login", "/signup"]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const card = await page.locator(".au-card").boundingBox();
        expect(card!.x).toBeGreaterThanOrEqual(0);
        expect(card!.x + card!.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        // The photo panel is for wide screens only.
        await expect(page.locator(".au-visual")).toBeVisible({ visible: width > 880 });
      }
      await page.getByRole("tab", { name: "Log in" }).click();
      await page.getByRole("button", { name: "Forgot password?" }).click();
      await page.getByLabel("Email address", { exact: true }).fill("member@gmail.com");
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open Gmail" })).toHaveAttribute("href", /mail\.google\.com/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("signed-in visitors skip the log in pages and go straight into Stayblz", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("stayblz.token", "test-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: { id: "u1", username: "rider", displayName: "Test Rider", role: "user" } } }),
  );
  await page.route("**/api/workspaces", (route) => route.fulfill({ json: { stables: [] } }));
  for (const path of ["/", "/login", "/signup"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("region", { name: "Your Stayblz account" })).toHaveCount(0);
  }
  // Public pages still offer the way back in.
  await page.goto("/faq");
  await expect(page.getByRole("banner").getByRole("link", { name: /Continue to dashboard/ })).toBeVisible();
});

test("reduced motion turns off the card's entrance and the tab slide", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  expect(await page.locator(".au-split").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  expect(await page.locator(".au-tabs-pill").evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
});

test("Get the app shows directions for this device, and for iPhone explains notifications need the Home Screen", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const [ua, expected] of [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "install icon"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "Add to Home Screen"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", "Install app"],
  ] as const) {
    const context = await browser.newContext({ userAgent: ua, baseURL: "http://127.0.0.1:5178", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { error: "Not signed in." } }));
    await page.goto("/login");
    await page.getByRole("button", { name: "Get the app" }).click();
    const guide = page.getByRole("dialog", { name: "Get the Stayblz app" });
    await expect(guide).toBeVisible();
    await expect(guide.locator(".ig-steps")).toContainText(expected);
    if (ua.includes("iPhone")) await expect(guide).toContainText("notifications only work in the Stayblz app");
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
    await context.close();
  }
});
