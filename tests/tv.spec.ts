import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend, a real stream or a phone.
type Status = { state: "live" | "upcoming" | "off_air"; title: string | null; startsAt: string | null };
const OFF: Status = { state: "off_air", title: null, startsAt: null };

async function mockTv(
  page: Page,
  {
    status = OFF as Status | number,
    playback = { status: 409, json: { code: "off_air", error: "Nothing is on air right now." } } as { status: number; json: unknown },
    youtube = { status: 200, json: { channels: [], videos: [] } } as { status: number; json: unknown },
  } = {},
) {
  const calls = { status: 0, playback: 0 };
  const state = { status };
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: { id: "member", username: "member", displayName: "Racing Member", role: "member" } } });
    if (path === "/api/tv/status") {
      calls.status++;
      return typeof state.status === "number"
        ? route.fulfill({ status: state.status, json: { error: "STAYBLZ TV is unavailable right now." } })
        : route.fulfill({ json: state.status });
    }
    if (path === "/api/tv/playback") {
      calls.playback++;
      return route.fulfill(playback);
    }
    if (path === "/api/tv/youtube") return route.fulfill(youtube);
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
  return { calls, state };
}

// YouTube is never reached: its player and thumbnails are stood in for.
async function stubYouTube(page: Page) {
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ status: 404, body: "" }));
}

const CH = "UCzU39Vjjyv2_SXipboFPAsQ";
const YT = {
  status: 200,
  json: {
    channels: [{ id: CH, name: "Los Alamitos Race Course", url: `https://www.youtube.com/channel/${CH}` }],
    videos: [
      {
        id: "cJA4RJ5teuw",
        channelId: CH,
        title: "Los Alamitos NIGHTTIME Full Card & Replays on - Sunday, November 15",
        kind: "card",
        heading: "Sunday night card",
        publishedAt: "2026-11-16T06:01:05.000Z",
        raceDay: "2026-11-15",
        races: 8,
        firstPost: "5:10 PM",
        highlight: "Paul Jones sets an all-time Quarter Horse win record!",
        description: "8 Races starting at 5:10 PM. Paul Jones sets an all-time Quarter Horse win record!",
        views: 1234,
      },
      {
        id: "cHSBFpM-Oeg",
        channelId: CH,
        title: "Los Alamitos Preview Show for November 14-15",
        kind: "preview",
        heading: "Preview show",
        publishedAt: "2026-11-14T01:40:12.000Z",
        raceDay: null,
        races: null,
        firstPost: null,
        highlight: null,
        description: "The running of the G2 Las Damas headlines the weekend.",
        views: null,
      },
    ],
  },
};
const LIVE_EMBED = {
  status: 200,
  json: { url: "https://www.youtube-nocookie.com/embed/83L5qoWNHYM?autoplay=1", title: "Los Alamitos", kind: "embed" },
};

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

test("off air: honest message and no player request", async ({ page }) => {
  const { calls } = await mockTv(page);
  await page.goto("/tv");
  await expect(page.locator(".tvg-status")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No live broadcast right now" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(calls.playback).toBe(0);
});

test("upcoming: shows the title and start time", async ({ page }) => {
  await mockTv(page, { status: { state: "upcoming", title: "Saturday card", startsAt: "2099-01-03T18:30:00Z" } });
  await page.goto("/tv");
  await expect(page.locator(".tvg-status")).toHaveText("Coming up");
  await expect(page.getByRole("heading", { name: "Saturday card" }).first()).toBeVisible();
  await expect(page.locator('time[datetime="2099-01-03T18:30:00Z"]').first()).toBeVisible();
});

test("status failure shows a retry that recovers", async ({ page }) => {
  const { state } = await mockTv(page, { status: 503 });
  await page.goto("/tv");
  await expect(page.getByRole("alert")).toContainText("unavailable");
  state.status = OFF;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".tvg-status")).toBeVisible();
});

test("live: the player asks for playback; a failure offers Try again", async ({ page }) => {
  const { calls } = await mockTv(page, {
    status: { state: "live", title: "Keeneland – Race 7", startsAt: null },
    playback: { status: 503, json: { error: "The broadcast is unavailable right now." } },
  });
  await page.goto("/tv");
  await expect(page.locator(".tvg-status")).toHaveText("Live");
  await expect(page.getByRole("heading", { name: "Keeneland – Race 7" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.getByRole("alert")).toContainText("unavailable");
  const before = calls.playback;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => calls.playback).toBeGreaterThan(before);
});

test("live demo embed: YouTube's player fills the screen, no HLS video or our sound button", async ({ page }) => {
  const url = "https://www.youtube-nocookie.com/embed/cJA4RJ5teuw?autoplay=1&playsinline=1&rel=0";
  await mockTv(page, {
    status: { state: "live", title: "Los Alamitos Race Course", startsAt: null },
    playback: { status: 200, json: { url, title: "Los Alamitos Race Course", kind: "embed" } },
  });
  // The test never reaches YouTube; an empty page stands in for its player.
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.goto("/tv");
  const frame = page.locator("iframe.tv-embed");
  await expect(frame).toHaveAttribute("src", url);
  await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  await expect(frame).toHaveAttribute("title", "Live race telecast: Los Alamitos Race Course");
  await expect(page.locator("video")).toBeHidden();
  await expect(page.getByText("Connecting to the broadcast…")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tap for sound" })).toHaveCount(0);
  const screen = (await page.locator(".tvg-player").boundingBox())!;
  const box = (await frame.boundingBox())!;
  expect(box.width).toBeGreaterThan(300);
  expect(Math.abs(box.width - screen.width)).toBeLessThan(2);
  expect(Math.abs(box.height - screen.height)).toBeLessThan(2);
});

test("live but ended before playback: the page re-checks and shows off air", async ({ page }) => {
  const { state } = await mockTv(page, { status: { state: "live", title: null, startsAt: null } });
  await page.route("**/api/tv/playback", async (route) => {
    state.status = OFF;
    await route.fulfill({ status: 409, json: { code: "off_air", error: "Nothing is on air right now." } });
  });
  await page.goto("/tv");
  await expect(page.getByRole("heading", { name: "No live broadcast right now" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
});

for (const width of [320, 375]) {
  test(`phone ${width}px: no overflow, player fills the width (inside the page margins) at 16:9`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await mockTv(page, {
      status: { state: "live", title: "A very long broadcast title that has to wrap on a small phone screen", startsAt: null },
      playback: { status: 503, json: { error: "The broadcast is unavailable right now." } },
    });
    await page.goto("/tv");
    await expect(page.getByRole("alert")).toBeVisible();
    await noOverflow(page);
    const box = (await page.locator(".tvg-screen").boundingBox())!;
    // The glass redesign keeps a small page margin on phones (no longer edge to edge).
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.width).toBeGreaterThanOrEqual(width - 32);
    // The video area under the Live strip stays 16:9.
    const video = (await page.locator(".tvg-player").boundingBox())!;
    expect(Math.abs(video.height - (video.width * 9) / 16)).toBeLessThan(2);
    const retry = (await page.getByRole("button", { name: "Try again" }).boundingBox())!;
    expect(retry.height).toBeGreaterThanOrEqual(40);
  });
}

test("phone: off-air screen and Updates link fit at 320px in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockTv(page);
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "dark"));
  await page.goto("/tv");
  await expect(page.getByRole("heading", { name: "No live broadcast right now" })).toBeVisible();
  await noOverflow(page);
  const link = (await page.getByRole("link", { name: "See Updates" }).boundingBox())!;
  expect(link.height).toBeGreaterThanOrEqual(44);
});

test("landscape phone: the live screen fits the height", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await mockTv(page, {
    status: { state: "live", title: null, startsAt: null },
    playback: { status: 503, json: { error: "The broadcast is unavailable right now." } },
  });
  await page.goto("/tv");
  await expect(page.getByRole("alert")).toBeVisible();
  await noOverflow(page);
  const box = (await page.locator(".tvg-screen").boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(360);
});

/* ---------- YouTube replays (demo) ---------- */

test("YouTube: All YouTube and the channel sit with the surfaces; cards show the broadcast data", async ({ page }) => {
  await mockTv(page, { youtube: YT });
  await stubYouTube(page);
  await page.goto("/tv");
  const seg = page.getByRole("group", { name: "Surface or YouTube channel" });
  await expect(seg.getByRole("button")).toHaveText(["All surfaces", "Dirt", "Turf", "Synthetic", "All YouTube", "Los Alamitos Race Course"]);
  await seg.getByRole("button", { name: "Los Alamitos Race Course" }).click();
  await expect(page).toHaveURL(new RegExp(`yt=${CH}`));
  await expect(page.locator(".tvg-select")).toHaveCount(0);
  await expect(page.locator(".tvg-count")).toContainText("2 broadcasts from Los Alamitos Race Course");
  const card = page.locator(".tvg-card").first();
  await expect(card.getByRole("heading", { name: "Sunday night card" })).toBeVisible();
  await expect(card.locator(".tvg-race-no")).toHaveText("8 races");
  await expect(card).toContainText("Paul Jones sets an all-time Quarter Horse win record!");
  await expect(card.locator(".tvg-podium")).toContainText("First post5:10 PM");
  await expect(card.locator("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/cJA4RJ5teuw/hqdefault.jpg");
  await seg.getByRole("button", { name: "Dirt" }).click();
  await expect(page).not.toHaveURL(/yt=/);
  await expect(page.locator(".tvg-select")).toHaveCount(1);
});

test("YouTube: a replay takes over the screen as Replay; Back to live returns to the live feed", async ({ page }) => {
  const { calls } = await mockTv(page, { status: { state: "live", title: "Los Alamitos", startsAt: null }, playback: LIVE_EMBED, youtube: YT });
  await stubYouTube(page);
  await page.goto(`/tv?yt=all`);
  await expect(page.locator(".tvg-onscreen")).toHaveText("Live");
  const before = calls.playback;
  await page.getByRole("button", { name: /Watch replay: Sunday night card/ }).click();
  await expect(page).toHaveURL(/watch=cJA4RJ5teuw/);
  const screen = page.locator(".tvg-screen");
  await expect(screen.locator(".tvg-onscreen")).toHaveText("Replay");
  await expect(screen.locator("iframe")).toHaveCount(1);
  await expect(screen.locator("iframe")).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/cJA4RJ5teuw\?/);
  await expect(screen.locator("iframe")).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  const side = page.getByRole("complementary", { name: "Now playing" });
  await expect(side.getByRole("heading", { name: "Sunday night card" })).toBeVisible();
  await expect(side.locator(".tvg-facts")).toContainText("First post5:10 PM");
  await expect(side.getByRole("link", { name: "Open on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=cJA4RJ5teuw");
  await expect(page.locator(".tvg-card.is-playing")).toHaveCount(1);

  await screen.getByRole("button", { name: "Back to live" }).click();
  await expect(page).not.toHaveURL(/watch=/);
  await expect(screen.locator(".tvg-onscreen")).toHaveText("Live");
  await expect(screen.locator("iframe")).toHaveAttribute("src", /83L5qoWNHYM/);
  expect(calls.playback).toBeGreaterThan(before);

  // The browser's Back button goes to the replay again.
  await page.goBack();
  await expect(screen.locator(".tvg-onscreen")).toHaveText("Replay");
});

test("YouTube: while off air the button closes the replay instead", async ({ page }) => {
  await mockTv(page, { youtube: YT });
  await stubYouTube(page);
  await page.goto("/tv?yt=all&watch=cHSBFpM-Oeg");
  await expect(page.locator(".tvg-onscreen")).toHaveText("Replay");
  await expect(page.getByRole("complementary", { name: "Now playing" })).toContainText("The running of the G2 Las Damas");
  await page.locator(".tvg-screen").getByRole("button", { name: "Close replay" }).click();
  await expect(page.getByRole("heading", { name: "No live broadcast right now" })).toBeVisible();
});

test("YouTube: a failed load says so with Try again", async ({ page }) => {
  await mockTv(page, { youtube: { status: 502, json: { error: "YouTube replays couldn't be loaded right now." } } });
  await page.goto("/tv?yt=all");
  await expect(page.getByRole("alert")).toContainText("YouTube replays could not be loaded.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

for (const width of [320, 375]) {
  test(`YouTube phone ${width}px: replay screen at 16:9, no overflow, 44px back button`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await mockTv(page, { status: { state: "live", title: "Los Alamitos", startsAt: null }, playback: LIVE_EMBED, youtube: YT });
    await stubYouTube(page);
    await page.goto("/tv?yt=all&watch=cJA4RJ5teuw");
    await expect(page.locator(".tvg-onscreen")).toHaveText("Replay");
    await noOverflow(page);
    const box = (await page.locator(".tvg-screen").boundingBox())!;
    const video = (await page.locator(".tvg-player").boundingBox())!;
    expect(Math.abs(video.height - (video.width * 9) / 16)).toBeLessThan(2);
    const back = (await page.locator(".tvg-back-live").boundingBox())!;
    expect(back.height).toBeGreaterThanOrEqual(44);
    expect(back.x + back.width).toBeLessThanOrEqual(box.x + box.width);
  });
}

test("YouTube's player corners stay clear: the badge and Back to live sit above the video, not on it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await mockTv(page, { status: { state: "live", title: "Los Alamitos", startsAt: null }, playback: LIVE_EMBED, youtube: YT });
  await stubYouTube(page);
  for (const path of ["/tv", "/tv?yt=all&watch=cJA4RJ5teuw"]) {
    await page.goto(path);
    const frame = page.locator(".tvg-screen iframe");
    await expect(frame).toHaveCount(1);
    const video = (await frame.boundingBox())!;
    for (const sel of [".tvg-onscreen", ".tvg-back-live"]) {
      const el = page.locator(`.tvg-screen ${sel}`);
      if (!(await el.count())) continue;
      const b = (await el.boundingBox())!;
      expect(b.y + b.height, `${sel} on ${path}`).toBeLessThanOrEqual(video.y + 0.5);
    }
    // Nothing of ours is on top of the player's corners (where its unmute and volume buttons are).
    for (const [x, y] of [[24, 24], [video.width - 24, 24], [24, video.height - 24], [video.width - 24, video.height - 24]]) {
      const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName, [video.x + x, video.y + y]);
      expect(hit, `${path} @${x},${y}`).toBe("IFRAME");
    }
  }
});
