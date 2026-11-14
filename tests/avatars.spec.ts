import { test, expect, type Page } from "@playwright/test";

// Profile pictures: add, see it in the header and preview, remove (with a confirm), quiet fallbacks.
const ID = "11111111-1111-4111-8111-111111111111";
const member = {
  id: ID,
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
// A real 1×1 PNG, so the browser can decode and resize it.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const VERSION = "22222222-2222-4222-8222-222222222222";
// The page may put the API host in front (local development), so match the end of the address.
const PICTURE = new RegExp(`/api/avatars/${ID}/${VERSION}$`);

type State = { version: string | null; uploads: { type: string | null; size: number }[]; removed: number; lookups: string[]; lookupStatus: number };

async function api(page: Page, me: Record<string, unknown>, state: State) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh") return route.fulfill({ json: { user: me } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/updates") return route.fulfill({ json: { updates: [], pinned: [], hasMore: false, signedIn: true } });
    if (path === "/api/avatars/lookup") {
      state.lookups.push(url.searchParams.get("ids") ?? "");
      if (state.lookupStatus !== 200) return route.fulfill({ status: state.lookupStatus, json: { error: "Unavailable" } });
      return route.fulfill({ json: { avatars: state.version ? { [ID]: state.version } : {} } });
    }
    if (path === "/api/avatars/me" && request.method() === "POST") {
      state.uploads.push({ type: request.headers()["content-type"] ?? null, size: request.postDataBuffer()?.length ?? 0 });
      state.version = VERSION;
      return route.fulfill({ status: 201, json: { avatar: VERSION } });
    }
    if (path === "/api/avatars/me/remove") {
      state.removed++;
      state.version = null;
      return route.fulfill({ json: { avatar: null } });
    }
    if (path === `/api/avatars/${ID}/${VERSION}`) return route.fulfill({ body: PNG, contentType: "image/png" });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
}
const fresh = (): State => ({ version: null, uploads: [], removed: 0, lookups: [], lookupStatus: 200 });

test("add a profile picture, see it in the header and preview, then remove it", async ({ page }) => {
  const state = fresh();
  await api(page, member, state);
  await page.goto("/account");
  const preview = page.getByRole("complementary", { name: "Profile preview" });
  const header = page.locator(".gx-account .gx-avatar");
  await expect(header).toHaveText("MU");
  await expect(preview.locator(".pf-avatar")).toHaveText("MU");

  await page.locator('.pf-photo input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(preview.getByRole("status")).toHaveText("Profile picture saved.");
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].type).toBe("image/jpeg"); // squared and converted in the browser
  expect(state.uploads[0].size).toBeGreaterThan(0);
  await expect(header.locator("img")).toHaveAttribute("src", PICTURE);
  await expect(preview.locator(".pf-avatar img")).toHaveAttribute("src", PICTURE);
  await expect(preview.getByRole("button", { name: "Change picture" })).toBeVisible();

  await preview.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await expect(dialog).toContainText("Remove your profile picture?");
  await dialog.getByRole("button", { name: "Remove picture" }).click();
  await expect(preview.getByRole("status")).toHaveText("Profile picture removed.");
  expect(state.removed).toBe(1);
  await expect(header).toHaveText("MU");
  await expect(header.locator("img")).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Add a profile picture" })).toBeVisible();
});

test("an existing picture loads with one lookup; a failed lookup quietly shows initials", async ({ page }) => {
  const state = fresh();
  state.version = VERSION;
  await api(page, member, state);
  await page.goto("/account");
  await expect(page.locator(".gx-account .gx-avatar img")).toHaveAttribute("src", PICTURE);
  expect(state.lookups).toEqual([ID]);

  const down = fresh();
  down.lookupStatus = 503;
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await api(page, member, down);
  await page.reload();
  await expect(page.locator(".gx-account .gx-avatar")).toHaveText("MU");
  await expect(page.getByText(/can't reach Stayblz/i)).toHaveCount(0);
});

test("the locked superadmin profile has no picture controls", async ({ page }) => {
  await api(page, { ...member, role: "superadmin", platformRole: "superadmin" }, fresh());
  await page.goto("/account");
  await expect(page.getByRole("complementary", { name: "Profile preview" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Profile picture" })).toHaveCount(0);
});
