import { test, expect, type Page } from "@playwright/test";

const base = {
  id: "33333333-3333-4333-8333-333333333333",
  username: "owner@example.test",
  displayName: "Sam Super",
  email: "owner@example.test",
  emailVerified: true,
  accountStatus: "active",
  mfa: { enabled: false, verified: false },
  profile: { firstName: "Sam", lastName: "Super", country: "GB", racingRole: "owner" },
};
const superadmin = { ...base, role: "superadmin", platformRole: "superadmin", actingRole: null };
const qr =
  "data:image/svg+xml;base64," +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').toString("base64");

/** Signed-in page with every unrelated API quietly empty. `me` is the session user. */
async function signedIn(page: Page, me: Record<string, unknown>) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { user: me } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/admin/stables") return route.fulfill({ json: { stables: [] } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
}

test("with 2-step login on, nothing opens until the code is accepted", async ({ page }) => {
  await signedIn(page, { ...superadmin, mfa: { enabled: true, verified: false }, mfaPending: true });
  const codes: string[] = [];
  await page.route("**/api/auth/mfa/verify", (route) => {
    const { code } = route.request().postDataJSON();
    codes.push(code);
    return code === "123456"
      ? route.fulfill({ json: { user: { ...superadmin, mfa: { enabled: true, verified: true } } } })
      : route.fulfill({ status: 400, json: { code: "mfa_invalid", error: "That code did not match." } });
  });
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "2-step login", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  const field = page.getByLabel("6-digit code");
  await field.fill("12ab34");
  await expect(field).toHaveValue("1234");
  await field.fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("did not match");
  await field.fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  expect(codes).toEqual(["000000", "123456"]);
});

test("staff can view the site as a customer and switch back", async ({ page }) => {
  await signedIn(page, superadmin);
  const requested: string[] = [];
  await page.route("**/api/auth/view-as", (route) => {
    const { role } = route.request().postDataJSON();
    requested.push(role);
    return route.fulfill({
      json: { user: { ...superadmin, role, actingRole: role === "superadmin" ? null : role } },
    });
  });
  await page.goto("/account");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Administration" })).toBeVisible();
  await expect(page.getByText("Superadmin account", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Customer" }).click();
  await expect(page.getByText(/You're viewing Stayblz as/)).toBeVisible();
  await expect(nav.getByRole("link", { name: "Administration" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Superadmin" }).click();
  await expect(page.getByText(/You're viewing Stayblz as/)).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Administration" })).toBeVisible();
  expect(requested).toEqual(["member", "superadmin"]);
});

test("customers see no View as choice and set up 2-step login with a QR code", async ({ page }) => {
  const customer = { ...base, role: "member", platformRole: "member", actingRole: null };
  await signedIn(page, customer);
  await page.route("**/api/auth/mfa/enroll", (route) =>
    route.fulfill({ status: 201, json: { factorId: "factor-1", qrCode: qr, secret: "ABCDEF123456" } }),
  );
  let verified: unknown;
  await page.route("**/api/auth/mfa/verify", (route) => {
    verified = route.request().postDataJSON();
    return route.fulfill({ json: { user: { ...customer, mfa: { enabled: true, verified: true } } } });
  });
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "View as" })).toHaveCount(0);
  const section = page.getByRole("region", { name: /2-step login/ });
  await expect(section.getByText("Off", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Set up 2-step login" }).click();
  await expect(section.getByRole("img", { name: /QR code/ })).toBeVisible();
  await expect(section.getByText("ABCDEF123456")).toBeVisible();
  await section.getByLabel("6-digit code").fill("654321");
  await section.getByRole("button", { name: "Turn on" }).click();
  await expect(section.getByText("On", { exact: true })).toBeVisible();
  expect(verified).toEqual({ code: "654321", factorId: "factor-1" });
});

test("superadmins moderate accounts but cannot suspend themselves", async ({ page }) => {
  await signedIn(page, superadmin);
  let status = "active";
  let sent: unknown;
  await page.route("**/api/admin/accounts", (route) =>
    route.fulfill({
      json: {
        accounts: [
          { id: superadmin.id, email: superadmin.email, name: "Sam Super", role: "superadmin", status: "active", statusReason: "", createdAt: "2026-11-01T00:00:00Z", mfaEnabled: true },
          { id: "11111111-1111-4111-8111-111111111111", email: "casey@example.test", name: "Casey Buyer", role: "member", status, statusReason: status === "suspended" ? "Spam" : "", createdAt: "2026-11-02T00:00:00Z", mfaEnabled: false },
        ],
      },
    }),
  );
  await page.route("**/api/admin/events", (route) =>
    route.fulfill({
      json: { events: [{ id: "1", accountId: superadmin.id, actorId: superadmin.id, event: "auth.signed_in", detail: {}, createdAt: "2026-11-09T00:00:00Z" }] },
    }),
  );
  await page.route("**/api/admin/accounts/*/status", (route) => {
    sent = route.request().postDataJSON();
    status = "suspended";
    return route.fulfill({ json: { account: { status } } });
  });
  page.on("dialog", (dialog) => void dialog.accept("Spam"));
  await page.goto("/administration");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend owner@example.test" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Signed in" })).toBeVisible();
  await page.getByRole("button", { name: "Suspend casey@example.test" }).click();
  await expect(page.getByRole("button", { name: "Restore casey@example.test" })).toBeVisible();
  expect(sent).toEqual({ status: "suspended", reason: "Spam" });
});

test("admins get the stable directory but not account moderation", async ({ page }) => {
  await signedIn(page, { ...base, role: "admin", platformRole: "admin", actingRole: null });
  let accountsRequested = false;
  await page.route("**/api/admin/accounts", (route) => {
    accountsRequested = true;
    return route.fulfill({ status: 403, json: { error: "No" } });
  });
  await page.goto("/administration");
  await expect(page.getByRole("heading", { name: "Registered stables" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accounts" })).toHaveCount(0);
  expect(accountsRequested).toBe(false);
});

test("the superadmin profile is shown locked with no save button", async ({ page }) => {
  await signedIn(page, superadmin);
  await page.goto("/account");
  await expect(page.getByText(/superadmin profile is locked/)).toBeVisible();
  await expect(page.getByLabel("First name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save profile" })).toHaveCount(0);
});

test("admins can still edit their own profile", async ({ page }) => {
  await signedIn(page, { ...base, role: "admin", platformRole: "admin", actingRole: null });
  await page.goto("/account");
  await expect(page.getByLabel("First name")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible();
});
