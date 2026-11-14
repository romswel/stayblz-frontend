import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend.
type Row = Record<string, unknown> & { id: string; name: string; mine: boolean };
const row = (id: string, name: string, extra: Partial<Row> = {}): Row => ({
  id,
  name,
  price: 45000,
  breed: "thoroughbred",
  discipline: "flat-racing",
  type: "racehorse",
  gender: "gelding",
  color: "bay",
  age: 4,
  heightIn: 66,
  location: "Lexington, Kentucky",
  sellerName: "Alice Seller",
  mine: false,
  createdAt: "2026-11-10T12:00:00Z",
  updatedAt: "2026-11-10T12:00:00Z",
  ...extra,
});

async function mockApp(page: Page, { role = "member", listings = [] as Row[] } = {}) {
  const state = {
    listings: [...listings],
    queries: [] as string[],
    posted: [] as unknown[],
    removed: [] as string[],
  };
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: { user: { id: "member", username: "member", displayName: "Racing Member", role } },
      });
    if (path === "/api/tv/status") return route.fulfill({ json: { state: "off_air", title: null, startsAt: null } });
    if (path === "/api/marketplace/listings" && request.method() === "GET") {
      state.queries.push(url.search);
      const mine = url.searchParams.get("mine") === "1";
      const breed = url.searchParams.get("breed");
      const priceMin = Number(url.searchParams.get("priceMin") ?? 0);
      const shown = state.listings.filter(
        (l) => (!mine || l.mine) && (!breed || l.breed === breed) && Number(l.price) >= priceMin,
      );
      return route.fulfill({ json: { listings: shown, more: false } });
    }
    if (path === "/api/marketplace/listings" && request.method() === "POST") {
      const body = request.postDataJSON();
      state.posted.push(body);
      const created = row("new-1", body.name, { ...body, sellerName: "Racing Member", mine: true });
      state.listings.unshift(created);
      return route.fulfill({ status: 201, json: { listing: created } });
    }
    const edit = path.match(/^\/api\/marketplace\/listings\/([^/]+)$/);
    if (edit && request.method() === "PATCH") {
      const body = request.postDataJSON();
      const updated = { ...state.listings.find((l) => l.id === edit[1])!, ...body };
      state.listings = state.listings.map((l) => (l.id === edit[1] ? updated : l));
      return route.fulfill({ json: { listing: updated } });
    }
    const remove = path.match(/^\/api\/marketplace\/listings\/([^/]+)\/remove$/);
    if (remove) {
      state.removed.push(remove[1]);
      state.listings = state.listings.filter((l) => l.id !== remove[1]);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
  return state;
}

test("sidebar has an Explore section with Marketplace and STAYBLZ TV", async ({ page }) => {
  await mockApp(page);
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByText("Explore", { exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "STAYBLZ TV", exact: true }).click();
  await expect(page).toHaveURL(/\/tv$/);
  await expect(page.getByRole("heading", { name: /STAYBLZ TV/ })).toBeVisible();
  await expect(page.locator(".tvg-status")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No live broadcast right now" })).toBeVisible();
  await nav.getByRole("link", { name: "Marketplace", exact: true }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
  await expect(page.getByRole("heading", { name: /Marketplace/, level: 1 })).toBeVisible();
});

test("signed-out visitors are sent to log in", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { error: "Sign in" } }));
  for (const path of ["/marketplace", "/tv"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("listings show every field and filters go to the server in the address", async ({ page }) => {
  const state = await mockApp(page, {
    listings: [
      row("a", "Northern Ledger"),
      row("b", "Quiet Mare", {
        price: 8000,
        breed: "quarter-horse",
        discipline: "barrel-racing",
        type: "riding-horse",
        gender: "mare",
        color: "palomino",
        age: 9,
        heightIn: 60,
        location: "Ocala, Florida",
      }),
    ],
  });
  await page.goto("/marketplace");
  const card = page.getByRole("article", { name: /Quiet Mare/ });
  await expect(card).toContainText("$8,000");
  for (const text of ["Quarter Horse", "Barrel racing", "Riding horse", "Mare", "Palomino", "9 yrs", "15.0 hh", "Ocala, Florida", "Alice Seller"])
    await expect(card).toContainText(text);
  await expect(page.locator(".mp-count").getByText("2 horses")).toBeVisible();

  const filters = page.getByRole("complementary", { name: "Filter horses" });
  await filters.getByRole("combobox", { name: "Breed" }).selectOption("quarter-horse");
  await expect(page).toHaveURL(/breed=quarter-horse/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await filters.getByRole("combobox", { name: "Price from" }).selectOption("10000");
  await expect(page.getByRole("heading", { name: "No horses match these filters." })).toBeVisible();
  await filters.getByRole("combobox", { name: "Height from" }).selectOption("60");
  await filters.getByRole("combobox", { name: "Age (years) up to" }).selectOption("10");
  for (const name of ["Discipline", "Type", "Gender", "Color"])
    await expect(filters.getByRole("combobox", { name })).toBeVisible();
  await filters.getByRole("searchbox").fill("Ocala");
  await expect.poll(() => state.queries.at(-1)).toContain("location=Ocala");
  const last = new URLSearchParams(state.queries.at(-1));
  expect(Object.fromEntries(last)).toMatchObject({
    breed: "quarter-horse",
    priceMin: "10000",
    heightMin: "60",
    ageMax: "10",
    location: "Ocala",
  });
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page).not.toHaveURL(/breed=/);
});

test("members list a horse with dropdowns, then edit and remove it", async ({ page }) => {
  const state = await mockApp(page, { listings: [row("a", "Northern Ledger")] });
  await page.goto("/marketplace");
  await page.getByRole("button", { name: "List a horse" }).first().click();
  const dialog = page.getByRole("dialog", { name: "List a horse" });
  await dialog.getByRole("button", { name: "Publish listing" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter the horse's name.");

  await dialog.getByLabel("Horse name").fill("Gold Furlong");
  await dialog.getByLabel("Price (USD)").fill("125000");
  await expect(dialog.getByLabel("Price (USD)")).toHaveValue("125,000");
  await dialog.getByLabel("Breed").selectOption("thoroughbred");
  await dialog.getByLabel("Discipline").selectOption("flat-racing");
  await dialog.getByLabel("Type").selectOption("yearling");
  await dialog.getByLabel("Gender").selectOption("colt");
  await dialog.getByLabel("Color").selectOption("chestnut");
  await dialog.getByLabel("Age (years)").fill("1");
  await dialog.getByLabel("Height (hands)").selectOption({ label: "15.2 hh" });
  await dialog.getByLabel("Location").fill("Newmarket, England");
  await dialog.getByRole("button", { name: "Publish listing" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.posted[0]).toEqual({
    name: "Gold Furlong",
    price: 125000,
    breed: "thoroughbred",
    discipline: "flat-racing",
    type: "yearling",
    gender: "colt",
    color: "chestnut",
    age: 1,
    heightIn: 62,
    location: "Newmarket, England",
  });
  await expect(page.getByRole("status").filter({ hasText: "Gold Furlong is now listed" })).toBeVisible();
  const mine = page.getByRole("article", { name: /Gold Furlong/ });
  await expect(mine).toContainText("Your listing");
  // Someone else's listing has no edit or remove for a member.
  await expect(page.getByRole("button", { name: "Remove Northern Ledger" })).toHaveCount(0);

  await mine.getByRole("button", { name: "Edit Gold Furlong" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit Gold Furlong" });
  await expect(editDialog.getByLabel("Price (USD)")).toHaveValue("125,000");
  await editDialog.getByLabel("Price (USD)").fill("99000");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(mine).toContainText("$99,000");

  await mine.getByRole("button", { name: "Remove Gold Furlong" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove listing" }).click();
  await expect(page.getByRole("article", { name: /Gold Furlong/ })).toHaveCount(0);
  expect(state.removed).toEqual(["new-1"]);

  await page.getByRole("button", { name: "My listings" }).click();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page.getByRole("heading", { name: "You haven't listed any horses yet." })).toBeVisible();
});

test("admins can remove any listing; layout fits a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockApp(page, { role: "admin", listings: [row("a", "Northern Ledger")] });
  await page.goto("/marketplace");
  await expect(page.getByRole("button", { name: "Remove Northern Ledger" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Northern Ledger" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("complementary", { name: "Filter horses" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto("/tv");
  await expect(page.locator(".tvg-status")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
