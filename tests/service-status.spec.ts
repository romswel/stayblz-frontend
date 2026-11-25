import { test, expect, type Page } from "@playwright/test";

// Error handling (2026-11-25): the /status page (live check + what each message means), the connection notice
// re-checking by itself and saying "Back online", and plain words for "too many requests".

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

/** `server.up` decides what /api/status, /api/health and everything else answer. */
async function api(page: Page, me: Record<string, unknown> | null, server: { up: boolean; notice?: string | null; database?: string }) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh")
      return me ? route.fulfill({ json: { user: me } }) : route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
    if (path === "/api/status")
      return server.up
        ? route.fulfill({
            json: { ok: true, server: "up", database: server.database ?? "ok", databaseMs: 40, uptimeSeconds: 3600, notice: server.notice ?? null, time: new Date().toISOString() },
          })
        : route.fulfill({ status: 503, contentType: "text/html", body: "<html>Service Suspended</html>" });
    if (path === "/api/health")
      return server.up ? route.fulfill({ json: { ok: true } }) : route.fulfill({ status: 502, contentType: "text/plain", body: "Bad gateway" });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/updates") return route.fulfill({ json: { updates: [], pinned: [], hasMore: false, signedIn: !!me } });
    // Everything else behaves like the real server: answers when up, 503 when down.
    return server.up ? route.fulfill({ json: {} }) : route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
}

test("the status page checks Stayblz live and explains every message", async ({ page }) => {
  await api(page, null, { up: true, notice: "Stayblz moves to its new server on 1 December." });
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Is Stayblz working?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Everything's working" })).toBeVisible();
  await expect(page.getByText("From the Stayblz team:")).toBeVisible();
  await expect(page.getByText("Stayblz moves to its new server on 1 December.")).toBeVisible();
  await expect(page.locator(".svc-rows")).toContainText("Online");
  await expect(page.locator(".svc-rows")).toContainText(/Answering · \d+/);
  await expect(page.locator(".svc-rows")).toContainText("Working");
  for (const words of ["“Can't reach Stayblz”", "“Too many requests in a short time”", "“A newer version of Stayblz is ready”"])
    await expect(page.getByText(words)).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh the app" })).toBeVisible();
});

test("when the server is down the page says so, and says when it's back", async ({ page }) => {
  const server = { up: false };
  await api(page, null, server);
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Stayblz isn't answering" })).toBeVisible();
  await expect(page.locator(".svc-rows")).toContainText("Not answering");
  await expect(page.locator(".svc-rows")).toContainText("Unknown until the server answers");
  server.up = true;
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("heading", { name: "Everything's working" })).toBeVisible();
});

test("the connection notice links to the status page and says Back online by itself", async ({ page }) => {
  const server = { up: false };
  await api(page, member, server);
  await page.goto("/account/preferences");
  await page.route("**/api/auth/preferences", (route) => route.fulfill({ status: 502, contentType: "text/plain", body: "Bad gateway" }));
  // click, not check(): the box rightly snaps back when the save fails.
  await page.getByRole("checkbox", { name: /Email me Stayblz news/ }).click();
  const notice = page.getByRole("status", { name: "Connection status" });
  await expect(notice).toContainText("Can't reach Stayblz");
  await expect(page.getByRole("alert")).toContainText("isn't answering right now");
  await expect(notice.getByRole("link", { name: "What's going on?" })).toHaveAttribute("href", "/status");
  await notice.getByRole("button", { name: "Try now" }).click();
  await expect(notice).toContainText("Can't reach Stayblz");
  // "Back online" is only for outages people could notice (4 s or more), not one-request blips.
  await page.waitForTimeout(4200);
  server.up = true;
  await notice.getByRole("button", { name: "Try now" }).click();
  await expect(notice).toContainText("Back online");
  await expect(notice).toHaveCount(0, { timeout: 8000 });
});

test("too many requests says how long to wait instead of 'try again later'", async ({ page }) => {
  await api(page, member, { up: true });
  await page.goto("/account/preferences");
  await page.route("**/api/auth/preferences", (route) =>
    route.fulfill({ status: 429, headers: { "Retry-After": "30" }, json: { error: "Too many attempts. Please try again later.", retryAfterSeconds: 30 } }),
  );
  // click, not check(): the box rightly snaps back when the save fails.
  await page.getByRole("checkbox", { name: /Email me Stayblz news/ }).click();
  await expect(page.getByRole("alert")).toContainText("Please wait 30 seconds and try again.");
});
