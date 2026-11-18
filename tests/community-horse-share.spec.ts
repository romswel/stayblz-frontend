import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend.
const ME = "11111111-1111-4111-8111-111111111111";
const HORSE = "22222222-2222-4222-8222-222222222222";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const media = (n: number, kind: "photo" | "video" = "photo") => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  kind,
  width: 800,
  height: 600,
  hasPoster: kind === "video",
});
// 7 photos and 1 video; the Feed carries the first 5 (main picture first).
const ALL = [media(1), media(2), media(3), media(4, "video"), media(5), media(6), media(7), media(8)];

const horse = (extra: Record<string, unknown> = {}) => ({
  id: HORSE,
  ownerId: ME,
  name: "Midnight Runner",
  breed: "Thoroughbred",
  sex: "colt",
  foaledYear: 2022,
  color: "Bay",
  sire: "Into Mischief",
  dam: "Starry Night",
  status: "racing",
  trainer: "Bob Baffert",
  location: "Santa Anita",
  description: "Quick out of the gate.",
  visibility: "private",
  coverImageId: ALL[0].id,
  imageCount: 8,
  stats: { starts: 6, wins: 3, places: 1, shows: 1, earningsCents: 12500000, lastRace: "2026-10-01" },
  mine: true,
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  ...extra,
});
const person = { id: ME, name: "Rita Owner", headline: "", me: true, horses: 1, starts: 6, wins: 3, earningsCents: 0, followers: 0, followingCount: 0, posts: 1, isFollowing: false, followsYou: false, inventoryOpen: true };
const post = (extra: Record<string, unknown> = {}) => ({
  id: "33333333-3333-4333-8333-333333333333",
  kind: "horse_share",
  body: "Meet our colt",
  result: null,
  visibility: "members",
  createdAt: new Date().toISOString(),
  editedAt: null,
  mine: false,
  author: { id: "44444444-4444-4444-8444-444444444444", name: "Sam Seller", headline: "" },
  horse: { id: HORSE, name: "Midnight Runner", breed: "Thoroughbred", status: "racing", coverImageId: ALL[0].id, media: ALL.slice(0, 5), mediaCount: 8 },
  images: [],
  likes: 0,
  liked: false,
  comments: 0,
  ...extra,
});

async function mockApp(page: Page) {
  const state = { shares: [] as unknown[] };
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: ME, username: "rita", displayName: "Rita Owner", role: "member" } } });
    if (path === "/api/tv/status") return route.fulfill({ json: { state: "off_air", title: null, startsAt: null } });
    if (path === "/api/community/me")
      return route.fulfill({ json: { settings: { headline: "", inventoryVisibility: "members", showEarnings: true, listed: true }, person } });
    if (path === `/api/community/people/${ME}/horses`) return route.fulfill({ json: { horses: [horse()], restricted: false } });
    if (path === "/api/community/people") return route.fulfill({ json: { people: [], page: 1, hasNext: false } });
    if (path === "/api/community/feed") return route.fulfill({ json: { posts: [post()], next: null } });
    if (path === "/api/community/feed/new") return route.fulfill({ json: { count: 0 } });
    if (path === `/api/community/horses/${HORSE}/share` && method === "POST") {
      state.shares.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { post: post({ mine: true }) } });
    }
    if (path === `/api/community/horses/${HORSE}`)
      return route.fulfill({
        json: {
          horse: {
            ...horse({ mine: false, visibility: undefined }),
            images: ALL.map((m, position) => ({ ...m, caption: "", position, durationSeconds: m.kind === "video" ? 42 : null })),
            records: [{ id: "r1", raceDate: "2026-10-01", track: "Santa Anita", raceName: "Golden State Juvenile", distance: "7f", surface: "dirt", finish: 1, fieldSize: 9, earningsCents: 6000000, notes: "" }],
            owner: { id: "44444444-4444-4444-8444-444444444444", name: "Sam Seller", headline: "Breeder", isFollowing: false, me: false },
          },
        },
      });
    if (path.startsWith("/api/community/media/horse/")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.fulfill({ status: 403, json: { error: "Not part of this test" } });
  });
  return state;
}

test("My horses: sharing a private horse asks to make it visible, then posts it with the caption", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/account/horses");
  await page.getByRole("button", { name: "Share Midnight Runner to the Feed" }).click();
  const dialog = page.getByRole("dialog", { name: "Share Midnight Runner to the Feed" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Only you can see this horse.")).toBeVisible();
  await dialog.getByLabel("Caption (optional)").fill("Meet our colt");
  await dialog.getByRole("button", { name: "Make visible to everyone & share" }).click();
  await expect(dialog.getByText("is on the Feed.")).toBeVisible();
  expect(state.shares).toEqual([{ body: "Meet our colt", visibility: "members", makeVisible: true }]);
  await expect(dialog.getByRole("link", { name: "View in Feed" })).toHaveAttribute("href", "/community");
});

test("Feed: a shared horse shows name, breed, a main picture with thumbnails and +N, and opens the floating viewer", async ({ page }) => {
  await mockApp(page);
  await page.goto("/community");
  const share = page.getByRole("region", { name: "Shared horse: Midnight Runner" });
  await expect(share.getByRole("button", { name: "Midnight Runner", exact: true })).toBeVisible();
  await expect(share.getByRole("button", { name: "Thoroughbred", exact: true })).toBeVisible();
  await expect(share.locator(".cm-hshare-main img")).toHaveCount(1);
  await expect(share.locator(".cm-hshare-thumbs .cm-hshare-tile")).toHaveCount(4);
  await expect(share.locator(".cm-hshare-play")).toHaveCount(1);
  await expect(share.locator(".cm-hshare-more")).toHaveText("+3");
  // No link to the profile page from the post: the viewer is the way in.
  await expect(share.locator("a")).toHaveCount(0);

  // Clicking the breed opens the viewer with the horse's information on the side.
  await share.getByRole("button", { name: "Thoroughbred", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Midnight Runner: photos and details" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("heading", { name: "Midnight Runner" })).toBeVisible();
  await expect(viewer.getByText("Into Mischief")).toBeVisible();
  await expect(viewer.getByText("Golden State Juvenile")).toBeVisible();
  await expect(viewer.getByText("1 / 8")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText("2 / 8")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  // The "+3" tile opens the viewer at that item; the darkened backdrop closes it.
  await share.getByRole("button", { name: /3 more photos and videos/ }).click();
  await expect(viewer.getByText("5 / 8")).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(viewer).toBeHidden();

  // The video tile plays in the viewer.
  await share.getByRole("button", { name: /video 4 of 8/ }).click();
  await expect(viewer.locator("video")).toHaveAttribute("src", `/api/community/media/horse/${ALL[3].id}`);
  await viewer.getByRole("button", { name: "Close" }).click();

  // And the name opens it too.
  await share.getByRole("button", { name: "Midnight Runner", exact: true }).click();
  await expect(viewer).toBeVisible();
});

test("Feed and viewer fit a 375px phone without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await mockApp(page);
  await page.goto("/community");
  const share = page.getByRole("region", { name: "Shared horse: Midnight Runner" });
  await expect(share.locator(".cm-hshare-more")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await share.getByRole("button", { name: "Midnight Runner", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Midnight Runner: photos and details" });
  await expect(viewer.getByText("Into Mischief")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await viewer.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
});
