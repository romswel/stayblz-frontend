import { test, expect } from "@playwright/test";
test("header logo toggles the shared theme and preserves the setting", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, json: { error: "No published data yet." } }),
  );
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
});

test("landing has a header theme button; light and dark match the dashboard colours", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in." } }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const card = page.getByRole("region", { name: "Your Stayblz account" });
  await expect(card).toBeVisible();
  const bg = (selector: string) =>
    page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  // Light (the default): dashboard paper card, cream page, dark green header.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bg(".ld-auth")).toBe("rgb(255, 254, 249)");
  expect(await bg(".landing")).toBe("rgb(242, 240, 233)");
  expect(await bg(".ld-header")).toBe("rgb(21, 62, 46)");
  expect(
    await page.getByLabel("Email", { exact: true }).evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(30, 53, 44)");
  // Header button switches to dark and is remembered.
  // exact: the header logo is a theme switch too ("Stayblz logo: switch to dark mode").
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bg(".ld-auth")).toBe("rgb(26, 40, 33)");
  expect(await bg(".landing")).toBe("rgb(18, 28, 24)");
  expect(await bg(".ld-header")).toBe("rgb(16, 39, 28)");
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to light mode", exact: true })).toBeVisible();
  // The hero headline stays light over the photo in both themes.
  expect(
    await page.locator(".ld-hero h1").evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(244, 240, 230)");
});
