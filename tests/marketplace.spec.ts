import { writeFileSync } from "node:fs";
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

async function mockApp(page: Page, { role = "member", listings = [] as Row[], videoBytes = 100 * 1024 * 1024 } = {}) {
  const state = {
    listings: [...listings],
    queries: [] as string[],
    posted: [] as unknown[],
    removed: [] as string[],
    dropped: [] as string[],
    // Uploaded files by id, with what the browser sent.
    files: new Map<string, { kind: string; type: string; body: Buffer; query: Record<string, string>; poster?: Buffer }>(),
    serveVideo: null as Buffer | null,
  };
  let next = 0;
  const fileView = (id: string) => {
    const f = state.files.get(id)!;
    return {
      id,
      kind: f.kind,
      width: Number(f.query.width) || null,
      height: Number(f.query.height) || null,
      ...(f.kind === "video" ? { duration: f.query.duration ? Number(f.query.duration) : null, poster: !!f.poster } : {}),
      name: f.query.name ?? "",
      size: f.body.length,
    };
  };
  const mediaOf = (l: Row) => ((l.mediaIds as string[] | undefined) ?? []).filter((id) => state.files.has(id)).map(fileView);
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
    if (path === "/api/marketplace/limits") return route.fulfill({ json: { videoBytes, videoSeconds: 180, photos: 8, videos: 3, documents: 5 } });
    if (path === "/api/marketplace/uploads" && request.method() === "POST") {
      const id = `up-${++next}`;
      const query = Object.fromEntries(url.searchParams);
      state.files.set(id, { kind: query.kind, type: request.headers()["content-type"], body: request.postDataBuffer() ?? Buffer.alloc(0), query });
      return route.fulfill({ status: 201, json: { file: fileView(id) } });
    }
    const still = path.match(/^\/api\/marketplace\/uploads\/([^/]+)\/poster$/);
    if (still) {
      state.files.get(still[1])!.poster = request.postDataBuffer() ?? Buffer.alloc(0);
      return route.fulfill({ json: { ok: true } });
    }
    const drop = path.match(/^\/api\/marketplace\/uploads\/([^/]+)\/remove$/);
    if (drop) {
      state.dropped.push(drop[1]);
      return route.fulfill({ json: { ok: true } });
    }
    const file = path.match(/^\/api\/marketplace\/media\/([^/]+)(\/poster)?$/);
    if (file) {
      const f = state.files.get(file[1]);
      if (!f) return route.fulfill({ status: 404, json: { error: "File not found." } });
      if (file[2]) return route.fulfill({ status: 200, contentType: "image/jpeg", body: f.poster ?? Buffer.alloc(0) });
      return route.fulfill({ status: 200, contentType: f.type, body: f.kind === "video" ? (state.serveVideo ?? f.body) : f.body });
    }
    const one = path.match(/^\/api\/marketplace\/listings\/([^/]+)$/);
    if (one && request.method() === "GET") {
      const found = state.listings.find((l) => l.id === one[1]);
      if (!found) return route.fulfill({ status: 404, json: { error: "Listing not found." } });
      return route.fulfill({ json: { listing: { ...found, media: mediaOf(found), documents: [] } } });
    }
    if (path === "/api/marketplace/listings" && request.method() === "POST") {
      const body = request.postDataJSON();
      state.posted.push(body);
      const media = mediaOf(body);
      const created = row(`new-${state.posted.length}`, body.name, {
        ...body,
        sellerName: "Racing Member",
        mine: true,
        cover: media[0] ?? null,
        photoCount: media.filter((m) => m.kind === "photo").length,
        videoCount: media.filter((m) => m.kind === "video").length,
        documentCount: (body.documentIds ?? []).length,
      });
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
    // Photos, videos and documents are optional: a listing can be published with none.
    mediaIds: [],
    documentIds: [],
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

/* ---------- Photos and videos (optional) ---------- */

// A 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Records a real, short WebM clip in the test browser (Chromium can't play MP4/H.264). */
async function recordClip(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const parts: Blob[] = [];
    recorder.ondataavailable = (e) => parts.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    let frame = 0;
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        ctx.fillStyle = frame % 2 ? "#1f6b45" : "#c9a24a";
        ctx.fillRect(0, 0, 160, 90);
        if (++frame > 12) {
          clearInterval(timer);
          resolve();
        }
      }, 60);
    });
    recorder.stop();
    await stopped;
    const bytes = new Uint8Array(await new Blob(parts, { type: "video/webm" }).arrayBuffer());
    let text = "";
    for (const b of bytes) text += String.fromCharCode(b);
    return btoa(text);
  });
  return Buffer.from(base64, "base64");
}

async function fillHorse(dialog: ReturnType<Page["getByRole"]>, name: string) {
  await dialog.getByLabel("Horse name").fill(name);
  await dialog.getByLabel("Price (USD)").fill("30000");
  await dialog.getByLabel("Breed").selectOption("thoroughbred");
  await dialog.getByLabel("Discipline").selectOption("flat-racing");
  await dialog.getByLabel("Type").selectOption("racing-prospect");
  await dialog.getByLabel("Gender").selectOption("filly");
  await dialog.getByLabel("Color").selectOption("bay");
  await dialog.getByLabel("Age (years)").fill("2");
  await dialog.getByLabel("Height (hands)").selectOption({ label: "15.2 hh" });
  await dialog.getByLabel("Location").fill("Ocala, Florida");
}
const mediaInput = (dialog: ReturnType<Page["getByRole"]>) => dialog.locator('input[type="file"][accept*="video/mp4"]');

test("sellers add photos and videos (optional); buyers see and play them", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/marketplace");
  const clip = await recordClip(page);
  await page.getByRole("button", { name: "List a horse" }).first().click();
  const dialog = page.getByRole("dialog", { name: "List a horse" });
  const box = dialog.getByRole("group", { name: /Photos & videos/ });
  await expect(box).toContainText("Optional");
  await expect(box).not.toContainText("Required");
  await expect(box).toContainText("100 MB each");
  await fillHorse(dialog, "Reel Runner");

  await mediaInput(dialog).setInputFiles([
    { name: "side.png", mimeType: "image/png", buffer: PNG },
    { name: "jog.webm", mimeType: "video/webm", buffer: clip },
  ]);
  await expect(dialog.locator(".mkm-photo.is-ready")).toHaveCount(2);
  // A still frame was made in the browser and sent after the video.
  await expect.poll(() => [...state.files.values()].find((f) => f.kind === "video")?.poster?.length ?? 0).toBeGreaterThan(100);
  const [photoId] = [...state.files.entries()].find(([, f]) => f.kind === "photo")!;
  const [videoId, video] = [...state.files.entries()].find(([, f]) => f.kind === "video")!;
  expect(video.type).toBe("video/webm");
  expect(video.query).toMatchObject({ kind: "video", width: "160", height: "90" });
  expect(video.body.equals(clip)).toBe(true);

  await dialog.getByRole("button", { name: "Publish listing" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.posted[0]).toMatchObject({ mediaIds: [photoId, videoId], documentIds: [] });

  const card = page.getByRole("article", { name: /Reel Runner/ });
  await card.getByRole("button", { name: "View Reel Runner: 1 photo, 1 video" }).click();
  const details = page.getByRole("dialog", { name: /Reel Runner/ });
  await details.getByRole("tab", { name: "Video 2" }).click();
  const player = details.locator("video").first();
  await expect(player).toHaveAttribute("src", `/api/marketplace/media/${videoId}`);
  // The browser really loads it.
  await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
});

test("a listing with only a video uses its still frame on the card", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/marketplace");
  const clip = await recordClip(page);
  await page.getByRole("button", { name: "List a horse" }).first().click();
  const dialog = page.getByRole("dialog", { name: "List a horse" });
  await fillHorse(dialog, "Only Moving");
  await mediaInput(dialog).setInputFiles({ name: "walk.webm", mimeType: "video/webm", buffer: clip });
  await expect(dialog.locator(".mkm-photo.is-ready")).toHaveCount(1);
  await expect.poll(() => [...state.files.values()][0]?.poster?.length ?? 0).toBeGreaterThan(100);
  await dialog.getByRole("button", { name: "Publish listing" }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.getByRole("article", { name: /Only Moving/ });
  const cover = card.locator("img.mkm-card-img");
  await expect(cover).toHaveAttribute("src", /\/api\/marketplace\/media\/up-\d+\/poster$/);
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(card.locator(".mkm-card-play")).toBeVisible();
});

test("while files are kept in Supabase, a video over 50 MB is stopped before it uploads", async ({ page }) => {
  const state = await mockApp(page, { videoBytes: 50 * 1024 * 1024 });
  await page.goto("/marketplace");
  await page.getByRole("button", { name: "List a horse" }).first().click();
  const dialog = page.getByRole("dialog", { name: "List a horse" });
  await expect(dialog.getByRole("group", { name: /Photos & videos/ })).toContainText("50 MB each");
  // Playwright only passes files over 50 MB from disk.
  const big = test.info().outputPath("long.webm");
  writeFileSync(big, Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(50 * 1024 * 1024)]));
  await mediaInput(dialog).setInputFiles(big);
  await expect(dialog.getByRole("alert").filter({ hasText: "too big (videos up to 50 MB for now)" })).toBeVisible();
  expect(state.files.size).toBe(0);
});

test("removing an upload before saving drops it; the form fits a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const state = await mockApp(page);
  await page.goto("/marketplace");
  const clip = await recordClip(page);
  await page.getByRole("button", { name: "List a horse" }).first().click();
  const dialog = page.getByRole("dialog", { name: "List a horse" });
  await mediaInput(dialog).setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: PNG },
    { name: "b.webm", mimeType: "video/webm", buffer: clip },
  ]);
  await expect(dialog.locator(".mkm-photo.is-ready")).toHaveCount(2);
  const wide = await page.evaluate(() =>
    [...document.querySelectorAll(".mk-form *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length,
  );
  expect(wide).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await dialog.getByRole("button", { name: "Remove video 2" }).click();
  await expect(dialog.locator(".mkm-photo")).toHaveCount(1);
  await expect.poll(() => state.dropped.length).toBe(1);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => state.dropped.length).toBe(2);
  expect(new Set(state.dropped)).toEqual(new Set(state.files.keys()));
});
