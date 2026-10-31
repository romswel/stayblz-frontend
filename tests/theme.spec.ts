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
