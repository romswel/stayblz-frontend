import { test, expect } from "@playwright/test";
const user = {
  id: "member-1",
  username: "member@example.test",
  displayName: "Member User",
  role: "member",
  email: "member@example.test",
  emailVerified: true,
  profile: {
    firstName: "Member",
    lastName: "User",
    country: "PH",
    racingRole: "fan",
  },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/public/racing-overview")
      return route.fulfill({
        json: {
          sections: {
            racecards: [],
            results: [],
            workouts: [],
            horses: [],
            jockeys: [],
            trainers: [],
            stakes: [],
            notes: [],
          },
          fetchedAt: "2026-11-01T00:00:00Z",
        },
      });
    if (path.startsWith("/api/racing/published/"))
      return route.fulfill({ json: { records: [], nextOffset: null } });
    return route.fulfill({ status: 401, json: { error: "Not signed in." } });
  });
});
async function fillSignup(page: import("@playwright/test").Page) {
  await page.getByLabel("First name", { exact: true }).fill("Member");
  await page.getByLabel("Last name", { exact: true }).fill("User");
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("PH");
  await page
    .getByRole("combobox", { name: "Racing role", exact: true })
    .selectOption("fan");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("member@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("TestOnlyPassword123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("TestOnlyPassword123");
}
test("signup validates profile, sends it once, and waits for email confirmation", async ({
  page,
}) => {
  let calls = 0;
  let saved: unknown;
  await page.route("**/api/auth/signup", async (route) => {
    calls++;
    saved = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 202,
      json: {
        requiresVerification: true,
        message: "Check your email for a confirmation link.",
      },
    });
  });
  await page.goto("/signup");
  await fillSignup(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check your email", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  expect(saved).toMatchObject({
    firstName: "Member",
    lastName: "User",
    country: "PH",
    racingRole: "fan",
    email: "member@example.test",
  });
  expect(saved).not.toHaveProperty("role");
  await expect(
    page.getByRole("link", { name: "Continue to dashboard" }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("stayblz.token"))).toBe(
    null,
  );
});
test("password mismatch stays in the form without a signup request", async ({
  page,
}) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/auth/signup")) posts++;
  });
  await page.goto("/signup");
  await fillSignup(page);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("DifferentPassword123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
  expect(posts).toBe(0);
  await expect(page.getByLabel("First name")).toHaveValue("Member");
});
test("logo Easter egg toggles a persistent shared dark theme with keyboard support", async ({
  page,
}) => {
  await page.goto("/");
  const logo = page.getByRole("button", {
    name: /Stayblz logo: switch to dark mode/,
  });
  await logo.hover();
  expect(
    await page
      .locator(".ld-brand-toggle .ld-brand-symbol")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("ld-horse-nod");
  await logo.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkLogo = page.getByRole("button", {
    name: /Stayblz logo: switch to light mode/,
  });
  await darkLogo.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("confirmation removes tokens from the URL and consumes them only once under StrictMode", async ({
  page,
}) => {
  let confirmations = 0;
  await page.route("**/api/auth/confirm", (route) => {
    confirmations++;
    expect(route.request().postDataJSON()).toMatchObject({
      accessToken: "fixture-access",
      refreshToken: "fixture-refresh",
    });
    return route.fulfill({ json: { user } });
  });
  await page.goto(
    "/#access_token=fixture-access&refresh_token=fixture-refresh&type=signup",
  );
  await expect(
    page.getByRole("heading", { name: "Email verified", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  expect(confirmations).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "fixture-access",
  );
});
test("password recovery uses a confirmed session and returns to login after saving", async ({
  page,
}) => {
  await page.route("**/api/auth/confirm", (route) =>
    route.fulfill({ json: { user } }),
  );
  let passwordChanges = 0;
  await page.route("**/api/auth/password", (route) => {
    passwordChanges++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(
    "/auth/confirm?recovery=1#access_token=fixture-access&refresh_token=fixture-refresh&type=recovery",
  );
  await page
    .getByLabel("New password", { exact: true })
    .fill("NewTestOnlyPassword123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("NewTestOnlyPassword123");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Password saved", exact: true }),
  ).toBeVisible();
  expect(passwordChanges).toBe(1);
  await expect(
    page.getByRole("link", { name: "Back to login", exact: true }),
  ).toBeVisible();
});
test('token-hash recovery opens the password form and strips query credentials',async({page})=>{
  await page.route('**/api/auth/confirm',route=>{expect(route.request().postDataJSON()).toMatchObject({tokenHash:'fixture-recovery-token-hash',type:'recovery'});return route.fulfill({json:{user}});});
  await page.goto('/auth/confirm?token_hash=fixture-recovery-token-hash&type=recovery');await expect(page.getByRole('heading',{name:'Set your password',exact:true})).toBeVisible();await expect(page).toHaveURL(/\/auth\/confirm$/);
});
test("member profile persists through the API without exposing stable navigation", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user } }),
  );
  let profileBody: unknown;
  await page.route("**/api/auth/profile", (route) => {
    profileBody = route.request().postDataJSON();
    return route.fulfill({
      json: {
        user: {
          ...user,
          displayName: "Updated User",
          profile: { ...user.profile, firstName: "Updated" },
        },
      },
    });
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inventory", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("First name", { exact: true }).fill("Updated");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  expect(profileBody).toMatchObject({ firstName: "Updated", lastName: "User" });
  expect(profileBody).not.toHaveProperty("role");
});

test('late pagination cannot replace a newly selected standings category',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{user}}));
  await page.route('**/api/racing/published/**',async route=>{
    const url=new URL(route.request().url());
    if(url.searchParams.has('offset')){await new Promise(resolve=>setTimeout(resolve,350));return route.fulfill({json:{records:[{id:'late-horse',name:'Late horse response',figure:90}],nextOffset:null}});}
    return route.fulfill({json:{records:[{id:url.pathname,name:url.pathname.endsWith('jockeys')?'Current jockey':'Initial horse',figure:100}],nextOffset:url.pathname.endsWith('horses')?50:null}});
  });
  await page.goto('/statistics');await page.getByRole('button',{name:'Load more',exact:true}).click();await page.getByRole('button',{name:'Jockeys',exact:true}).click();
  await expect(page.getByRole('cell',{name:'Current jockey',exact:true})).toBeVisible();await page.waitForTimeout(450);await expect(page.getByRole('cell',{name:'Late horse response',exact:true})).toHaveCount(0);
});
test('malformed full-view data shows an error instead of crashing',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/auth/me',route=>route.fulfill({json:{user}}));await page.route('**/api/racing/published/**',route=>route.fulfill({json:{records:null,nextOffset:null}}));
  await page.goto('/entries');await expect(page.getByRole('alert')).toContainText('records response was invalid');expect(errors).toEqual([]);
});
test('failed logout reports the error and does not pretend the cookie session ended',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{user}}));await page.route('**/api/auth/logout',route=>route.fulfill({status:503,json:{error:'Sign-out could not be confirmed.'}}));
  await page.goto('/dashboard');await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Sign-out could not be confirmed.');await expect(page).toHaveURL(/\/dashboard$/);
  await page.route('**/api/auth/logout',route=>route.fulfill({json:{ok:true}}));await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});
