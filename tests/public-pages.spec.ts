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

test("overview retries failures automatically, refreshes empty data, and preserves loaded rows", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/public/racing-overview", (route) => {
    calls++;
    if (calls === 1 || calls === 4)
      return route.fulfill({
        status: 503,
        json: { error: "Records unavailable." },
      });
    const data = empty();
    if (calls >= 3)
      (data.sections.racecards as unknown[]) = [
        {
          id: "published-1",
          name: "Fresh published record",
          track: "Real source",
        },
      ];
    return route.fulfill({ json: data });
  });
  await page.goto("/");
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator(".ld-data-status p")).toContainText(
    "Records unavailable.",
  );
  await page.clock.fastForward(5100);
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator(".ld-data-status p")).toContainText("Updated");
  await page.clock.fastForward(60100);
  await expect(
    page.getByText("Fresh published record", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(60100);
  await expect.poll(() => calls).toBe(4);
  await expect(page.locator(".ld-data-status p")).toContainText(
    "Records unavailable.",
  );
  await expect(
    page.getByText("Fresh published record", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(5100);
  await expect.poll(() => calls).toBe(5);
});

test("overview pauses while hidden and resumes on reconnect without overlapping requests", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/public/racing-overview", (route) => {
    calls++;
    return route.fulfill({ json: empty() });
  });
  await page.goto("/");
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(121000);
  expect(calls).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls).toBe(2);
  await page.clock.fastForward(2100);
  expect(calls).toBe(2);
});

test("automatic retries and manual refresh respect the server rate limit", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/public/racing-overview", (route) => {
    calls++;
    return route.fulfill({
      status: 429,
      headers: { "Retry-After": "120" },
      json: { error: "Try again later." },
    });
  });
  await page.goto("/");
  await expect.poll(() => calls).toBe(1);
  await page
    .getByRole("button", { name: "Refresh racing data", exact: true })
    .click();
  await page.clock.fastForward(61000);
  expect(calls).toBe(1);
  await page.clock.fastForward(60100);
  await expect.poll(() => calls).toBe(2);
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
  await page
    .getByRole("button", { name: "Log in", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Sign up", exact: true })
    .last()
    .click();
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
