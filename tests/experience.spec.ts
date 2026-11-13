import { test, expect, type Page } from "@playwright/test";

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

const post = (over: Record<string, unknown>) => ({
  id: "00000000-0000-4000-8000-000000000001",
  slug: "faster-racecards",
  kind: "update",
  title: "Faster racecards",
  summary: "Racecards open quicker.",
  items: [
    { tag: "new", text: "A brand-new racecard filter." },
    { tag: "fixed", text: "Dates show in your time zone." },
  ],
  version: "0.6",
  audience: "public",
  pinned: false,
  popup: true,
  status: "published",
  publishedAt: "2026-11-10T08:00:00Z",
  authorLabel: "Stayblz team",
  updatedAt: "2026-11-10T08:00:00Z",
  readMinutes: 1,
  hasBody: true,
  ...over,
});
const newest = post({});
const older = post({
  id: "00000000-0000-4000-8000-000000000002",
  slug: "safer-accounts",
  title: "Safer accounts and admin tools",
  kind: "announcement",
  publishedAt: "2026-11-09T08:00:00Z",
  popup: false,
});
const postBody = [
  "## Why it matters",
  "",
  "Racecards are **twice** as fast. [Read the FAQ](/faq) or [this](javascript:alert(1)).",
  "",
  "| Page | Before | After |",
  "|---|---|---|",
  "| Racecards | 4 s | 2 s |",
].join("\n");

/** Fake API. `me` null means signed out. Unmatched calls answer like an unavailable service. */
async function api(page: Page, me: Record<string, unknown> | null) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh")
      return me ? route.fulfill({ json: { user: me } }) : route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/public/racing-overview")
      return route.fulfill({ json: { sections: { racecards: [], results: [], workouts: [], horses: [], jockeys: [], trainers: [], stakes: [], notes: [] }, fetchedAt: "2026-11-10T00:00:00Z" } });
    if (path === "/api/updates") {
      const kind = url.searchParams.get("kind");
      const updates = [newest, older].filter((p) => !kind || p.kind === kind);
      return route.fulfill({ json: { updates, pinned: [], hasMore: false, signedIn: !!me } });
    }
    if (path === "/api/updates/faster-racecards")
      return route.fulfill({
        json: { update: { ...newest, body: postBody }, newer: null, older: { slug: older.slug, title: older.title } },
      });
    if (path.startsWith("/api/updates/"))
      return route.fulfill({ status: 404, json: { code: "not_found_or_members", error: "That update was not found." } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
}

test.describe("pages that can't be shown", () => {
  test("unknown addresses get a friendly 404, while real pages still ask signed-out people to log in", async ({ page }) => {
    await api(page, null);
    await page.goto("/this-does-not-exist");
    await expect(page.getByRole("heading", { name: "This page isn't on the card" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
    await page.goto("/messages/inbox-old-link");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signed-in 404s keep the menu so people can carry on", async ({ page }) => {
    await api(page, member);
    await page.goto("/no-such-section");
    await expect(page.getByRole("heading", { name: "This page isn't on the card" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  test("lost connections and unreachable servers show plain words, never browser errors", async ({ page, context }) => {
    await api(page, member);
    await page.goto("/account/preferences");
    await page.route("**/api/auth/preferences", (route) => route.abort("internetdisconnected"));
    await page.getByRole("checkbox", { name: /Email me Stayblz news/ }).check();
    await expect(page.getByRole("alert")).toContainText("We can't reach Stayblz right now");
    await expect(page.getByText(/Failed to fetch|TypeError|NetworkError/)).toHaveCount(0);
    await expect(page.getByRole("status", { name: "Connection status" })).toContainText("Can't reach Stayblz");
    await context.setOffline(true);
    await expect(page.getByRole("status", { name: "Connection status" })).toContainText("You're offline");
    await context.setOffline(false);
  });

  test("a slow first load explains the sleeping server and the development preview", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6500));
      await route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
    });
    await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 401, json: { error: "Sign in" } }));
    await page.goto("/login");
    await expect(page.getByText(/Starting the server/)).toBeVisible({ timeout: 9000 });
    await expect(page.getByText(/development preview running on a free server/)).toBeVisible();
  });
});

test.describe("development preview notice", () => {
  test("shows on public and signed-in pages and can be hidden for this visit", async ({ page }) => {
    await api(page, null);
    await page.goto("/faq");
    const notice = page.getByRole("note", { name: "Development preview" });
    await expect(notice).toContainText("Expect bugs");
    await notice.getByRole("button", { name: "Hide" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("note", { name: "Development preview" })).toHaveCount(0);
    await expect(page.getByText(/DEVELOPMENT PREVIEW/)).toBeVisible();
  });
});

test.describe("Updates", () => {
  const unseen = { ...member, preferences: { ...member.preferences, updatesSeenAt: "2026-11-01T00:00:00Z" } };

  test("the newest post pops up once after sign-in, and 'Got it' marks everything read", async ({ page }) => {
    await api(page, unseen);
    let saved: unknown;
    await page.route("**/api/auth/preferences", (route) => {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { user: { ...unseen, preferences: { ...unseen.preferences, updatesSeenAt: "2026-11-11T00:00:00Z" } } } });
    });
    await page.goto("/");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/dashboard");
    const dialog = page.getByRole("dialog", { name: "Stayblz Updates" });
    await expect(dialog.getByRole("heading", { name: "Faster racecards" })).toBeVisible();
    await expect(dialog.getByText("1 more new post")).toBeVisible();
    await expect(page.getByRole("link", { name: "Updates (2 new posts)" })).toBeVisible();
    await dialog.getByRole("button", { name: "Got it" }).click();
    await expect(dialog).toHaveCount(0);
    expect(saved).toEqual({ updatesSeen: true });
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Updates", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("'Don't show pop-ups again' turns them off; the Updates page keeps every post", async ({ page }) => {
    await api(page, unseen);
    let saved: unknown;
    await page.route("**/api/auth/preferences", (route) => {
      saved = route.request().postDataJSON();
      return route.fulfill({
        json: { user: { ...unseen, preferences: { ...unseen.preferences, updatesSeenAt: "2026-11-11T00:00:00Z", updatesPopup: false } } },
      });
    });
    await page.goto("/dashboard");
    const dialog = page.getByRole("dialog", { name: "Stayblz Updates" });
    await expect(dialog.getByText(/Every post stays on/)).toBeVisible();
    await dialog.getByRole("button", { name: "Don't show pop-ups again" }).click();
    await expect(dialog).toHaveCount(0);
    expect(saved).toEqual({ updatesPopup: false, updatesSeen: true });
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /^Updates/ }).click();
    await expect(page.getByRole("heading", { name: "Updates", exact: true, level: 1 })).toBeVisible();
    // The pop-up preference lives in the small Updates settings menu.
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("checkbox", { name: /Pop-up for new posts/ })).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("checkbox", { name: /Pop-up for new posts/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Safer accounts and admin tools" })).toBeVisible();
  });

  test("anyone can browse, filter and read posts without an account; old Bulletin links still work", async ({ page }) => {
    await api(page, null);
    await page.goto("/bulletin");
    await expect(page).toHaveURL(/\/updates$/);
    await expect(page.getByRole("link", { name: "Faster racecards" })).toBeVisible();
    await page.getByRole("button", { name: "Announcements" }).click();
    await expect(page).toHaveURL(/kind=announcement/);
    await expect(page.getByRole("link", { name: "Faster racecards" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Safer accounts and admin tools" })).toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("link", { name: "Faster racecards" }).click();
    await expect(page.getByRole("heading", { name: "Faster racecards", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "New" })).toContainText("A brand-new racecard filter.");
    await expect(page.getByRole("region", { name: "Fixed" })).toContainText("Dates show in your time zone.");
    await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
    await expect(page.locator(".rt strong")).toHaveText("twice");
    await expect(page.getByRole("link", { name: "Read the FAQ" })).toHaveAttribute("href", "/faq");
    await expect(page.getByRole("link", { name: "this", exact: true })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "2 s" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Older.*Safer accounts/ })).toBeVisible();
    await page.goto("/updates/members-secret");
    await expect(page.getByText(/for members only/)).toBeVisible();
  });

  test("admins write, preview and publish posts; customers never see the tools", async ({ page }) => {
    await api(page, member);
    await page.goto("/updates");
    await expect(page.getByRole("heading", { name: "Updates", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Write a post" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Manage Updates" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Updates sections" })).toHaveCount(0);
    await page.goto("/admin/updates");
    await expect(page.getByRole("heading", { name: "This page isn't on the card" })).toBeVisible();
    await page.goto("/updates/manage");
    await expect(page.getByRole("heading", { name: "This page isn't on the card" })).toBeVisible();

    const admin = { ...member, role: "admin", platformRole: "admin" };
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await api(page, admin);
    let sent: Record<string, unknown> = {};
    await page.route("**/api/admin/updates**", (route) => {
      if (route.request().method() === "POST") {
        sent = route.request().postDataJSON();
        return route.fulfill({ status: 201, json: { update: { ...newest, ...sent, publishedAt: new Date(Date.now() - 60_000).toISOString(), id: "00000000-0000-4000-8000-000000000009" } } });
      }
      return route.fulfill({ json: { updates: [{ ...newest, ...sent, id: "00000000-0000-4000-8000-000000000009" }] } });
    });
    await page.goto("/updates");
    await page.getByRole("link", { name: "Write a post" }).click();
    await expect(page.getByRole("heading", { name: "New post", level: 1 })).toBeVisible();
    await page.getByLabel("Title").fill("Stable feed photos");
    await expect(page.getByLabel("Web address")).toHaveValue("stable-feed-photos");
    await page.getByLabel("Change line 1").fill("Add photos to stable feed posts.");
    await page.getByRole("button", { name: "Add a line" }).click();
    await page.getByLabel("Label for line 2").selectOption("fixed");
    await page.getByLabel("Change line 2").fill("Long names no longer overlap.");
    await page.getByLabel(/Full post/).fill("## Try it\n\nOpen **Team feed**.");
    await page.getByRole("radio", { name: /Members only/ }).check();
    const preview = page.getByRole("complementary", { name: "Preview" });
    await expect(preview.getByRole("heading", { name: "Stable feed photos" })).toBeVisible();
    await expect(preview.getByText("Members only")).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
    expect(sent).toMatchObject({
      title: "Stable feed photos",
      slug: "stable-feed-photos",
      status: "published",
      audience: "members",
      items: [
        { tag: "new", text: "Add photos to stable feed posts." },
        { tag: "fixed", text: "Long names no longer overlap." },
      ],
    });
    await expect(page).toHaveURL(/\/updates\/manage\/00000000-0000-4000-8000-000000000009$/);
    // Managing posts lives inside Updates: no separate menu entry, and old links still work.
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Manage/ })).toHaveCount(0);
    await page.goto("/admin/updates");
    await expect(page).toHaveURL(/\/updates\/manage$/);
    await expect(page.getByRole("heading", { name: "Manage posts", level: 1 })).toBeVisible();
    const sections = page.getByRole("navigation", { name: "Updates sections" });
    await sections.getByRole("link", { name: "Feed" }).click();
    await expect(page.getByRole("heading", { name: "Updates", level: 1 })).toBeVisible();
  });
});

test.describe("sign-up, codes and sign-in", () => {
  test("sign-up needs the Terms and age confirmation, then a 6-digit code finishes it", async ({ page }) => {
    await api(page, null);
    let signups = 0;
    let body: Record<string, unknown> = {};
    await page.route("**/api/auth/signup", (route) => {
      signups++;
      body = route.request().postDataJSON();
      return route.fulfill({ status: 202, json: { requiresVerification: true, message: "Check your email." } });
    });
    let confirm: unknown;
    await page.route("**/api/auth/confirm", (route) => {
      confirm = route.request().postDataJSON();
      return route.fulfill({ json: { user: member } });
    });
    await page.goto("/signup");
    await page.getByLabel("First name", { exact: true }).fill("Fia");
    await page.getByLabel("Last name", { exact: true }).fill("Farrier");
    await page.getByLabel("Email address", { exact: true }).fill("fia@example.test");
    await page.getByLabel("Password", { exact: true }).fill("TestOnlyPassword123");
    await page.getByLabel("Confirm password", { exact: true }).fill("TestOnlyPassword123");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // Page 2: the first field gets focus.
    await expect(page.getByRole("combobox", { name: "Country", exact: true })).toBeFocused();
    await page.getByRole("combobox", { name: "Country", exact: true }).selectOption("IE");
    await page.getByLabel(/Town or city/).fill("Naas");
    await page.getByRole("combobox", { name: "Your main role in racing" }).selectOption("farrier");
    await page.getByText("Also involved in other ways?").click();
    await page.getByRole("checkbox", { name: "Equine vet" }).check();
    await expect(page.getByRole("checkbox", { name: "Farrier" })).toBeDisabled();
    await page.getByLabel(/Stable, farm or organisation/).fill("Kildare Forge");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    // The browser's own required-field check stops the form before anything is sent.
    const terms = page.getByRole("checkbox", { name: /I agree to the Terms of Use/ });
    expect(await terms.evaluate((box) => (box as HTMLInputElement).validity.valid)).toBe(false);
    expect(signups).toBe(0);
    await page.getByRole("checkbox", { name: /I agree to the Terms of Use/ }).check();
    await page.getByRole("checkbox", { name: "I'm 18 or older." }).check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(body).toMatchObject({
      firstName: "Fia",
      lastName: "Farrier",
      email: "fia@example.test",
      password: "TestOnlyPassword123",
      country: "IE",
      racingRole: "farrier",
      communityRoles: ["vet"],
      city: "Naas",
      organisation: "Kildare Forge",
      acceptTerms: true,
      ageConfirmed: true,
      marketingOptIn: false,
    });
    await page.getByLabel("6-digit code from the email").fill("12a3456");
    await expect(page.getByLabel("6-digit code from the email")).toHaveValue("123456");
    await page.getByRole("button", { name: "Confirm email" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(confirm).toEqual({ email: "fia@example.test", code: "123456", type: "signup" });
  });

  test("a password reset can be finished with the emailed code", async ({ page }) => {
    await api(page, null);
    await page.route("**/api/auth/forgot-password", (route) => route.fulfill({ status: 202, json: { message: "If the address can receive this request, an email will arrive shortly." } }));
    const calls: unknown[] = [];
    await page.route("**/api/auth/confirm", (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ json: { user: member } });
    });
    await page.route("**/api/auth/password", (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Email address", { exact: true }).fill("member@example.test");
    await page.getByRole("button", { name: "Send reset email" }).click();
    await page.getByLabel("6-digit code from the email").fill("654321");
    await page.getByLabel("New password", { exact: true }).fill("BrandNewPassword123");
    await page.getByLabel("Confirm password", { exact: true }).fill("BrandNewPassword123");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.locator(".ld-auth-success")).toContainText("Password changed");
    expect(calls).toEqual([
      { email: "member@example.test", code: "654321", type: "recovery" },
      { password: "BrandNewPassword123", confirmPassword: "BrandNewPassword123" },
    ]);
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("member@example.test");
  });

  test("logging in before confirming asks for the sign-up code for that address", async ({ page }) => {
    await api(page, null);
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 403,
        json: {
          code: "email_not_confirmed",
          error: "Confirm your email before logging in. Enter the 6-digit code from your sign-up email, or send a new one.",
        },
      }),
    );
    let confirm: unknown;
    await page.route("**/api/auth/confirm", (route) => {
      confirm = route.request().postDataJSON();
      return route.fulfill({ json: { user: member } });
    });
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("Late@Example.test");
    await page.getByLabel("Password", { exact: true }).fill("TestOnlyPassword123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.locator(".ld-verification")).toContainText("Late@Example.test");
    await expect(page.locator(".ld-auth-success")).toContainText("Confirm your email before logging in");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByLabel("6-digit code from the email").fill("246810");
    await page.getByRole("button", { name: "Confirm email" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(confirm).toEqual({ email: "Late@Example.test", code: "246810", type: "signup" });
  });

  test("a reset code is used once: a refused password is retried without asking for the code again", async ({ page }) => {
    await api(page, null);
    await page.route("**/api/auth/forgot-password", (route) =>
      route.fulfill({ status: 202, json: { message: "If the address can receive this request, an email will arrive shortly." } }),
    );
    let confirms = 0;
    await page.route("**/api/auth/confirm", (route) => {
      confirms++;
      return route.fulfill({ json: { user: member } });
    });
    const passwords: unknown[] = [];
    await page.route("**/api/auth/password", (route) => {
      passwords.push(route.request().postDataJSON());
      return passwords.length === 1
        ? route.fulfill({
            status: 400,
            json: { code: "same_password", error: "Choose a password that is different from your current one." },
          })
        : route.fulfill({ json: { ok: true } });
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Email address", { exact: true }).fill("member@example.test");
    await page.getByRole("button", { name: "Send reset email" }).click();
    await page.getByLabel("6-digit code from the email").fill("135790");
    await page.getByLabel("New password", { exact: true }).fill("OldPasswordAgain123");
    await page.getByLabel("Confirm password", { exact: true }).fill("OldPasswordAgain123");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("alert")).toContainText("different from your current one");
    // The code was accepted, so it isn't asked for (or sent) again.
    await expect(page.getByLabel("6-digit code from the email")).toHaveCount(0);
    await expect(page.getByText("Code accepted. Choose a new password.")).toBeVisible();
    await page.getByLabel("New password", { exact: true }).fill("BrandNewPassword123");
    await page.getByLabel("Confirm password", { exact: true }).fill("BrandNewPassword123");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.locator(".ld-auth-success")).toContainText("Password changed");
    expect(confirms).toBe(1);
    expect(passwords).toHaveLength(2);
  });

  test("with 2-step login on, a code reset also asks for the authenticator code before saving", async ({ page }) => {
    await api(page, null);
    await page.route("**/api/auth/forgot-password", (route) =>
      route.fulfill({ status: 202, json: { message: "If the address can receive this request, an email will arrive shortly." } }),
    );
    const calls: string[] = [];
    await page.route("**/api/auth/confirm", (route) => {
      calls.push("confirm");
      return route.fulfill({ json: { user: { ...member, mfaPending: true } } });
    });
    await page.route("**/api/auth/mfa/verify", (route) => {
      calls.push("mfa:" + route.request().postDataJSON().code);
      return route.fulfill({ json: { user: member } });
    });
    await page.route("**/api/auth/password", (route) => {
      calls.push("password");
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Email address", { exact: true }).fill("member@example.test");
    await page.getByRole("button", { name: "Send reset email" }).click();
    await page.getByLabel("6-digit code from the email").fill("112233");
    await page.getByLabel("New password", { exact: true }).fill("BrandNewPassword123");
    await page.getByLabel("Confirm password", { exact: true }).fill("BrandNewPassword123");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByLabel("6-digit code from your authenticator app")).toBeVisible();
    await expect(page.locator(".ld-auth-success")).toContainText("2-step login is on");
    expect(calls).toEqual(["confirm"]);
    await page.getByLabel("6-digit code from your authenticator app").fill("445566");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.locator(".ld-auth-success")).toContainText("Password changed");
    expect(calls).toEqual(["confirm", "mfa:445566", "password"]);
  });

  test("the reset screen sends a new code, refuses a wrong one, and can switch address", async ({ page }) => {
    await api(page, null);
    const requested: string[] = [];
    await page.route("**/api/auth/forgot-password", (route) => {
      requested.push(route.request().postDataJSON().email);
      return route.fulfill({ status: 202, json: { message: "If the address can receive this request, an email will arrive shortly." } });
    });
    await page.route("**/api/auth/confirm", (route) =>
      route.fulfill({
        status: 400,
        json: { code: "code_invalid", error: "That code is wrong or has expired. Check the latest email or request a new one." },
      }),
    );
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByLabel("Email address", { exact: true }).fill("member@example.test");
    await page.getByRole("button", { name: "Send reset email" }).click();
    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect.poll(() => requested).toEqual(["member@example.test", "member@example.test"]);
    await expect(page.locator(".ld-auth-success")).toContainText("If the address");
    await page.getByLabel("6-digit code from the email").fill("000000");
    await page.getByLabel("New password", { exact: true }).fill("BrandNewPassword123");
    await page.getByLabel("Confirm password", { exact: true }).fill("BrandNewPassword123");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("alert")).toContainText("wrong or has expired");
    await expect(page.getByLabel("6-digit code from the email")).toHaveValue("");
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email address", { exact: true })).toBeEditable();
    await expect(page.getByRole("button", { name: "Send reset email" })).toBeVisible();
  });

  test("'Keep me signed in' can be turned off for shared computers", async ({ page }) => {
    await api(page, null);
    let body: Record<string, unknown> = {};
    await page.route("**/api/auth/login", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { user: member } });
    });
    await page.goto("/login");
    await expect(page.getByRole("checkbox", { name: /Keep me signed in/ })).toBeChecked();
    await page.getByRole("checkbox", { name: /Keep me signed in/ }).uncheck();
    await page.getByLabel("Email", { exact: true }).fill("member@example.test");
    await page.getByLabel("Password", { exact: true }).fill("whatever-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(body.remember).toBe(false);
  });

  test("'This wasn't me' strips the token from the address and removes the sign-up only after a click", async ({ page }) => {
    await api(page, null);
    let sent: unknown;
    await page.route("**/api/auth/not-me", (route) => {
      sent = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/auth/not-me?token_hash=abcdefghijklmnop1234");
    await expect(page).toHaveURL(/\/auth\/not-me$/);
    await expect(page.getByRole("heading", { name: "Didn't sign up for Stayblz?" })).toBeVisible();
    expect(sent).toBeUndefined();
    await page.getByRole("button", { name: "Yes, remove this sign-up" }).click();
    await expect(page.getByRole("heading", { name: "Sign-up removed" })).toBeVisible();
    expect(sent).toEqual({ tokenHash: "abcdefghijklmnop1234" });
  });

  test("Terms and Privacy pages are public and linked from sign-up", async ({ page }) => {
    await api(page, null);
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Use", level: 1 })).toBeVisible();
    await expect(page.locator("#account-h")).toHaveText("Your account");
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Notice", level: 1 })).toBeVisible();
  });
});

test.describe("account area", () => {
  test("Profile, Security and Preferences are separate pages with real controls", async ({ page }) => {
    await api(page, member);
    let logoutBody: unknown;
    await page.route("**/api/auth/logout", (route) => {
      logoutBody = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/account");
    const sections = page.getByRole("navigation", { name: "Account sections" });
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Short bio (optional)")).toBeVisible();
    await sections.getByRole("link", { name: "Preferences" }).click();
    await expect(page.getByRole("checkbox", { name: /Dark mode/ })).toBeVisible();
    await sections.getByRole("link", { name: "Security" }).click();
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out of all devices" }).click();
    const sure = page.getByRole("alertdialog", { name: "Sign out on every device?" });
    await sure.getByRole("button", { name: "Sign out everywhere" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(logoutBody).toEqual({ everywhere: true });
  });

  test("account pages fit a phone screen in both themes", async ({ page }) => {
    await api(page, member);
    await page.setViewportSize({ width: 320, height: 720 });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
      for (const path of ["/account", "/account/security", "/account/preferences", "/updates", "/updates/faster-racecards", "/nowhere"]) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${theme} ${path}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

test.describe("navigation", () => {
  test("pressing / jumps to search, but not while typing in a field", async ({ page }) => {
    await api(page, member);
    await page.goto("/updates");
    await expect(page.getByRole("heading", { name: "Updates", level: 1 })).toBeVisible();
    // Under a busy test run the key can arrive before the shortcut listener is attached; retry it.
    await expect(async () => {
      await page.keyboard.press("/");
      await expect(page.getByRole("searchbox", { name: "Search racing records" })).toBeFocused({ timeout: 1000 });
    }).toPass({ timeout: 8000 });
    await page.getByRole("searchbox", { name: "Search updates" }).click();
    await page.keyboard.type("a/b");
    await expect(page.getByRole("searchbox", { name: "Search updates" })).toHaveValue("a/b");
  });
});
