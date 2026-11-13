import { test, expect } from "@playwright/test";
const empty = () => ({
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
  fetchedAt: new Date().toISOString(),
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/**", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in." } }),
  );
  await page.route("**/api/public/racing-overview", (route) =>
    route.fulfill({ json: empty() }),
  );
});

test("branded startup stays visible during session restore and respects reduced motion", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/me", async (route) => {
    await waiting;
    await route.fulfill({ status: 401, json: { error: "Not signed in." } });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const loader = page.getByRole("status", { name: "Loading Stayblz" });
  await expect(loader).toBeVisible();
  await expect(loader.getByText("STAYBLZ", { exact: false })).toBeVisible();
  await expect(page.locator(".sb-startup-mark img")).toHaveCSS(
    "animation-name",
    "sb-stride",
  );
  await page.screenshot({ path: "test-results/startup-mobile.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".sb-startup-mark img")).toHaveCSS(
    "animation-name",
    "none",
  );
  release();
  await expect(loader).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "FAQ", exact: true }),
  ).toBeVisible();
});

test("FAQ is public, searchable, keyboard usable and responsive with a shared footer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page).toHaveURL(/\/faq$/);
  const question = page
    .locator("summary")
    .filter({ hasText: "How do I create an account?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(question.locator("..")).toHaveAttribute("open", "");
  await page
    .getByRole("searchbox", { name: "Find a question" })
    .fill("password");
  await expect(page.getByRole("status")).toContainText("answers found");
  await expect(
    page.getByRole("heading", { name: "Racing records", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("searchbox").fill("no-such-question-here");
  await expect(
    page.getByRole("heading", { name: "No matching questions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  for (const width of [320, 375, 768, 1024, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "Footer navigation" }),
    ).toBeAttached();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/faq-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: "test-results/faq-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Stayblz logo: switch to/ }).click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
  await page.getByRole("button", { name: "Sign up", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Create an account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Footer navigation" }),
  ).toBeAttached();
});

test("FAQ remains accessible to signed-in members with long account names", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "member",
          username: "member@example.test",
          displayName: "A long account name for a racing member",
          role: "member",
          emailVerified: true,
        },
      },
    }),
  );
  await page.goto("/faq");
  await expect(
    page.getByRole("heading", { name: "Frequently asked questions." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue to dashboard" }),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: "Your account" }),
  ).toBeAttached();
});

test("public motion is quick, preserves form drafts and stops for reduced motion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const audit: { path: string; target: string; duration: number }[] = [];
    Object.defineProperty(window, "__publicMotion", { value: audit });
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      audit.push({
        path: location.pathname,
        target: String(this.className),
        duration:
          typeof options === "number"
            ? options
            : Number(options?.duration || 0),
      });
      return original.call(this, frames, options);
    };
  });
  await page.goto("/signup");
  await page.getByLabel("First name", { exact: true }).fill("Draft");
  const account = page.getByRole("region", { name: "Your Stayblz account" });
  await account.getByRole("button", { name: "Log in", exact: true }).click();
  await account.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(
    "Draft",
  );
  const formMotion = await page.evaluate(() =>
    (
      Reflect.get(window, "__publicMotion") as {
        target: string;
        duration: number;
      }[]
    ).filter((item) => item.target === "ld-auth-body"),
  );
  expect(formMotion.length).toBeGreaterThan(1);
  expect(formMotion.every((item) => item.duration <= 200)).toBe(true);
  await page
    .getByRole("navigation", { name: "Footer navigation" })
    .getByRole("link", { name: "Frequently asked questions" })
    .click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const entrance = await page.evaluate(() =>
    (
      Reflect.get(window, "__publicMotion") as {
        path: string;
        target: string;
        duration: number;
      }[]
    ).filter((item) => item.path === "/faq" && item.target === "faq-main"),
  );
  expect(entrance.length).toBeGreaterThan(0);
  expect(entrance.every((item) => item.duration <= 250)).toBe(true);
  await page.locator("#using-stayblz").scrollIntoViewIfNeeded();
  await expect(page.locator("#using-stayblz")).toHaveClass(/ld-visible/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#using-stayblz")).not.toHaveClass(
    /ld-await-reveal/,
  );
  expect(
    await page.locator("main").evaluate((el) => el.getAnimations().length),
  ).toBe(0);
});

test("FAQ topic fragments work after session restore and after clearing filtered results", async ({
  page,
}) => {
  await page.goto("/faq#your-account");
  const account = page.locator("#your-account");
  await expect(account).toBeVisible();
  await expect
    .poll(async () => (await account.boundingBox())!.y)
    .toBeLessThan(80);
  await page
    .getByRole("searchbox", { name: "Find a question" })
    .fill("no-such-question");
  await expect(
    page.getByRole("heading", { name: "No matching questions" }),
  ).toBeVisible();
  await page
    .getByRole("complementary", { name: "Question topics" })
    .getByRole("link", { name: /Racing records/ })
    .click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page).toHaveURL(/#racing-records$/);
  await expect
    .poll(async () => (await page.locator("#racing-records").boundingBox())!.y)
    .toBeLessThan(80);
});
