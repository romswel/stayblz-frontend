import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Site-wide UX rules: Back everywhere, confirmations, saved drafts, one Terms & Privacy page,
// sidebar edge, and the installable app (PWA) files.

const member = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "member@example.test",
  displayName: "Member User",
  role: "member",
  platformRole: "member",
  actingRole: null,
  email: "member@example.test",
  emailVerified: true,
  mfa: { enabled: false, verified: false },
  profile: { firstName: "Member", lastName: "User", country: "PH", racingRole: "fan", communityRoles: [], organisation: "", city: "", bio: "" },
  preferences: { marketingOptIn: false, updatesSeenAt: "2026-11-11T00:00:00Z", updatesPopup: true },
};

const post = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "faster-racecards",
  kind: "update",
  title: "Faster racecards",
  summary: "Racecards open quicker.",
  items: [{ tag: "new", text: "A brand-new racecard filter." }],
  version: "0.6",
  audience: "public",
  pinned: false,
  popup: false,
  status: "published",
  publishedAt: "2026-11-10T08:00:00Z",
  authorLabel: "Stayblz team",
  updatedAt: "2026-11-10T08:00:00Z",
  readMinutes: 1,
  hasBody: false,
};

async function api(page: Page, me: Record<string, unknown> | null) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh")
      return me ? route.fulfill({ json: { user: me } }) : route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/public/racing-overview")
      return route.fulfill({ json: { sections: { racecards: [], results: [], workouts: [], horses: [], jockeys: [], trainers: [], stakes: [], notes: [] }, fetchedAt: "2026-11-10T00:00:00Z" } });
    if (path === "/api/updates") return route.fulfill({ json: { updates: [post], pinned: [], hasMore: false, signedIn: !!me } });
    if (path === "/api/updates/faster-racecards") return route.fulfill({ json: { update: { ...post, body: "" }, newer: null, older: null } });
    if (path === "/api/auth/logout") return route.fulfill({ json: { ok: true } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
}

/** Wait for entrance animations (not endless ones) so boxes are measured where they rest. */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

test("sign-up keeps what was typed after a reload, never the password, and can be cleared", async ({ page }) => {
  await api(page, null);
  await page.goto("/signup");
  await page.getByLabel("First name", { exact: true }).fill("Fia");
  await page.getByLabel(/Town or city/).fill("Naas");
  await page.getByLabel("Email address", { exact: true }).fill("fia@example.test");
  await page.getByLabel("Password", { exact: true }).fill("TestOnlyPassword123");
  await page.waitForTimeout(400); // drafts save shortly after typing stops
  await page.reload();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Fia");
  await expect(page.getByLabel(/Town or city/)).toHaveValue("Naas");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("fia@example.test");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("TestOnlyPassword123");
  await expect(page.getByText("We kept the details you typed earlier")).toBeVisible();
  // Moving to log in and back keeps it too.
  await page.getByRole("button", { name: "Log in", exact: true }).first().click();
  await page.getByRole("button", { name: "Sign up", exact: true }).first().click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Fia");
  await page.getByRole("button", { name: "Clear form" }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("");
});

test("sign-up fields line up, even the ones marked Optional", async ({ page }) => {
  await api(page, null);
  await page.goto("/signup");
  await expect(page.getByRole("combobox", { name: "Country", exact: true })).toBeVisible();
  await settle(page);
  // Measured until the entrance animation has finished, so the check isn't timing-dependent.
  await expect
    .poll(async () => {
      const country = await page.getByRole("combobox", { name: "Country", exact: true }).boundingBox();
      const city = await page.getByLabel(/Town or city/).boundingBox();
      return Math.max(Math.abs(country!.y - city!.y), Math.abs(country!.height - city!.height));
    })
    .toBeLessThanOrEqual(1);
});

test("Terms of Use and Privacy Notice open together, in place, and can be agreed to", async ({ page }) => {
  await api(page, null);
  await page.goto("/signup");
  await page.getByLabel("First name", { exact: true }).fill("Fia");
  await page.getByRole("button", { name: "Terms of Use and Privacy Notice" }).click();
  const dialog = page.getByRole("dialog", { name: "Terms of Use and Privacy Notice" });
  await expect(dialog.getByRole("heading", { name: "Terms of Use", exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Privacy Notice", exact: true })).toBeAttached();
  await dialog.getByRole("button", { name: "I agree to both" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /I agree to the Terms of Use/ })).toBeChecked();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Fia");

  await page.goto("/legal");
  await expect(page.getByRole("heading", { name: "Terms of Use & Privacy Notice", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What we collect" })).toBeVisible();
});

test("every page has a Back button that never leaves people stuck", async ({ page }) => {
  await api(page, member);
  // Opened directly (no earlier page in this tab): Back goes up to Updates.
  await page.goto("/updates/faster-racecards");
  await expect(page.getByRole("heading", { name: "Faster racecards", level: 1 })).toBeVisible();
  // Desktop: one Back button above the page (the header arrow is for phones).
  await expect(page.getByRole("button", { name: "Back to Updates" })).toHaveCount(1);
  await page.getByRole("button", { name: "Back to Updates" }).click();
  await expect(page).toHaveURL(/\/updates$/);
  // After moving around, Back returns to the page before.
  await page.getByRole("link", { name: "Faster racecards" }).click();
  await expect(page.getByRole("heading", { name: "Faster racecards", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/updates$/);
  // Phones get the Back arrow in the header, which stays on screen.
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/account/security");
  await expect(page.getByRole("banner").getByRole("button", { name: "Back to My account" })).toBeVisible();
  await page.getByRole("banner").getByRole("button", { name: "Back to My account" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("Back after a redirect stays on Stayblz (goes up, not out of the site)", async ({ page }) => {
  await api(page, member);
  // /bulletin replaces itself with /updates: still the first Stayblz page in this tab.
  await page.goto("/bulletin");
  await expect(page).toHaveURL(/\/updates$/);
  await page.getByRole("button", { name: "Back to Overview" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("with the phone menu open, the log-out question keeps keyboard focus", async ({ page }) => {
  await api(page, member);
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await drawer.getByRole("button", { name: "Log out" }).click();
  const sure = page.getByRole("alertdialog", { name: "Log out of Stayblz?" });
  await expect(sure.getByRole("button", { name: "Stay signed in" })).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=alertdialog]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sure).toHaveCount(0);
  await expect(drawer).toBeVisible();
});

test("public pages have Back too", async ({ page }) => {
  await api(page, null);
  await page.goto("/faq");
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("logging out asks first; Escape or 'Stay signed in' keeps you signed in", async ({ page }) => {
  await api(page, member);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  const sure = page.getByRole("alertdialog", { name: "Log out of Stayblz?" });
  await expect(sure.getByRole("button", { name: "Stay signed in" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sure).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await sure.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("the sidebar collapses from its small button or by clicking its edge", async ({ page }) => {
  await api(page, member);
  await page.goto("/dashboard");
  const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
  const wide = (await sidebar.boundingBox())!.width;
  const edge = page.locator(".ws-edge-line");
  const box = (await edge.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
});

test("Updates settings hold the pop-up choice; there's no separate Manage Updates menu item", async ({ page }) => {
  await api(page, { ...member, role: "admin", platformRole: "admin" });
  await page.goto("/updates");
  const menu = page.getByRole("navigation", { name: "Main" });
  await expect(menu.getByRole("link", { name: "Updates", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: /Manage Updates/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("group", { name: "Updates settings" });
  await expect(settings.getByRole("checkbox", { name: /Pop-up for new posts/ })).toBeChecked();
  await settings.getByRole("link", { name: /Manage posts/ }).click();
  await expect(page).toHaveURL(/\/updates\/manage$/);
});

test("the app can be installed: manifest, icons, service worker and iPhone tags", async ({ page, request }) => {
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain('rel="manifest"');
  expect(html).toContain('rel="apple-touch-icon"');
  expect(html).toContain("viewport-fit=cover");
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
  }
  const worker = readFileSync("public/sw.js", "utf8");
  // Live and private data must never come from the worker's cache.
  expect(worker).toContain('url.pathname.startsWith("/api/")');
  await api(page, null);
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
});

test("new pages and dialogs fit a phone in both themes", async ({ page }) => {
  await api(page, member);
  await page.setViewportSize({ width: 320, height: 700 });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
    for (const path of ["/updates", "/legal"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${theme} ${path}`).toBeLessThanOrEqual(1);
    }
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer.getByRole("button", { name: "Close menu" })).toBeVisible();
    await drawer.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("alertdialog", { name: "Log out of Stayblz?" })).toBeVisible();
    await page.getByRole("button", { name: "Stay signed in" }).click();
  }
});
