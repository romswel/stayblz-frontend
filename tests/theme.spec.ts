import { test, expect } from "@playwright/test";
test("header logo toggles the shared theme and preserves the setting", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, json: { error: "No published data yet." } }),
  );
  // The logo switch is in the header of the public pages (the log in page has its own small bar).
  await page.goto("/faq");
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

test("public pages have the app's light/dark switch and use the glass colours in both themes", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 401, json: { error: "Not signed in." } }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const card = page.getByRole("region", { name: "Your Stayblz account" });
  await expect(card).toBeVisible();
  const color = (selector: string, prop: "backgroundColor" | "color" = "backgroundColor") =>
    page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p as "color"], prop);
  // Light (the default): cool slate page, white glass card, ink text.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await color(".au-page")).toBe("rgb(238, 242, 249)");
  expect(await color(".au-split")).toBe("rgba(255, 255, 255, 0.58)");
  expect(await color(".au-head h1", "color")).toBe("rgb(11, 19, 36)");
  expect(await page.getByLabel("Email", { exact: true }).evaluate((el) => getComputedStyle(el).color)).toBe("rgb(11, 19, 36)");
  // The header switch turns dark mode on, and it's remembered.
  const toggle = page.getByRole("banner").getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await color(".au-page")).toBe("rgb(8, 23, 15)");
  expect(await color(".au-split")).toBe("rgba(6, 22, 14, 0.55)");
  expect(await color(".au-head h1", "color")).toBe("rgb(236, 245, 239)");
  await page.reload();
  await expect(page.getByRole("banner").getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", "true");
});
