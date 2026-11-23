import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend, a real stream or a phone.
type Status = { state: "live" | "upcoming" | "off_air"; title: string | null; startsAt: string | null; [extra: string]: unknown };
type Reply = { status: number; json: unknown };
const OFF: Status = { state: "off_air", title: null, startsAt: null };

async function mockTv(
  page: Page,
  {
    status = OFF as Status | number,
    playback = { status: 409, json: { code: "off_air", error: "Nothing is on air right now." } } as Reply | ((url: URL) => Reply),
    youtube = { status: 200, json: { channels: [], videos: [] } } as Reply,
    replays = { status: 404, json: { error: "Not found" } } as Reply,
  } = {},
) {
  const calls = { status: 0, playback: 0, playbackUrls: [] as string[] };
  const state = { status };
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
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
      calls.playbackUrls.push(url.pathname + url.search);
      return route.fulfill(typeof playback === "function" ? playback(url) : playback);
    }
    if (path === "/api/tv/youtube") return route.fulfill(youtube);
    if (path === "/api/tv/replays") return route.fulfill(replays);
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
const CH2 = "UCkhBqbxs8CbO-vYxKROF73g";
const CH3 = "UC7NsS9H61hQ51JLeaHHeivA";
const YT = {
  status: 200,
  json: {
    channels: [
      { id: CH, name: "Los Alamitos Race Course", url: `https://www.youtube.com/channel/${CH}`, track: "Los Alamitos Race Course", breed: "Quarter Horse", streamsCards: true },
      { id: CH2, name: "Red Shores", url: `https://www.youtube.com/channel/${CH2}`, track: "Red Shores (Charlottetown)", breed: "Harness", streamsCards: true },
      { id: CH3, name: "Del Mar", url: `https://www.youtube.com/channel/${CH3}`, track: "Del Mar", breed: "Thoroughbred", streamsCards: true },
    ],
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
        durationSec: 14520,
        wasLive: true,
      },
      {
        id: "RSrace00014",
        channelId: CH2,
        title: "CDP 2026 November 21 R14",
        kind: "race",
        heading: "CDP 2026 November 21 R14",
        publishedAt: "2026-11-15T22:06:55.000Z",
        raceDay: "2026-11-21",
        races: null,
        firstPost: null,
        highlight: null,
        description: "",
        views: 88,
        durationSec: 130,
        wasLive: false,
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

test("replays open on the track channels; the Channel menu groups them by breed; no sample data", async ({ page }) => {
  await mockTv(page, { youtube: YT, status: { ...OFF, live: [{ channelId: CH2, channelName: "Red Shores", track: null, title: "Live", startedAt: null, viewers: 3 }], featured: false } });
  await stubYouTube(page);
  await page.goto("/tv");
  await expect(page.getByText("Sample data")).toHaveCount(0);
  // No race replays with results yet (404): no surface buttons, no Track menu, no made-up races.
  await expect(page.getByRole("group", { name: "Surface" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Track/ })).toHaveCount(0);
  const channel = page.getByRole("combobox", { name: /^Channel/ });
  await expect(channel).toHaveValue("all");
  expect(await channel.locator("optgroup").evaluateAll((els) => els.map((e) => e.getAttribute("label")))).toEqual(["Thoroughbred", "Quarter Horse", "Harness"]);
  await expect(channel.locator("option")).toHaveText(["All channels", "Del Mar", "Los Alamitos Race Course", "Red Shores · Live"]);
  // All channels lead with race cards; "Everything" shows the rest.
  await expect(page.getByRole("combobox", { name: /^Show/ })).toHaveValue("card");
  await expect(page.locator(".tvg-count")).toContainText("1 race card from all channels");
  await page.getByRole("combobox", { name: /^Show/ }).selectOption("all");
  await expect(page.locator(".tvg-count")).toContainText("3 videos from all channels");

  await channel.selectOption(CH);
  await expect(page).toHaveURL(new RegExp(`yt=${CH}`));
  await expect(page.locator(".tvg-count")).toContainText("2 videos from Los Alamitos Race Course");
  const card = page.getByRole("region", { name: "Replays" }).locator(".tvg-card").first();
  await expect(card.getByRole("heading", { name: "Sunday night card" })).toBeVisible();
  await expect(card.locator(".tvg-race-no")).toHaveText("8 races");
  await expect(card).toContainText("Paul Jones sets an all-time Quarter Horse win record!");
  await expect(card.locator(".tvg-podium")).toContainText("First post5:10 PM");
  await expect(card.locator(".tvg-duration")).toHaveText("4:02:00");
  await expect(card.locator("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/cJA4RJ5teuw/hqdefault.jpg");

  await page.getByRole("combobox", { name: /^Show/ }).selectOption("card");
  await expect(page).toHaveURL(/type=card/);
  await expect(page.locator(".tvg-count")).toContainText("1 race card from Los Alamitos Race Course");
  await channel.selectOption("all");
  await expect(page).not.toHaveURL(/type=/);
  await expect(page.locator(".tvg-count")).toContainText("1 race card from all channels");
  await page.getByRole("combobox", { name: /^Show/ }).selectOption("race");
  await expect(page).toHaveURL(/type=race/);
  await expect(page.getByRole("region", { name: "Replays" }).locator(".tvg-card")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Replays" }).locator(".tvg-card .tvg-thumb-top")).toContainText("Race replay");
});

test("race replays with results, once the server has them, come first with surfaces and tracks", async ({ page }) => {
  const replay = { id: "r1", title: "Allowance", track: "Keeneland", raceNumber: 3, date: "2026-10-10T18:00:00Z", distance: "6f", surface: "Dirt", runners: [{ pos: 1, horse: "Fast One", odds: "2-1" }] };
  await mockTv(page, { youtube: YT, replays: { status: 200, json: { replays: [replay] } } });
  await stubYouTube(page);
  await page.goto("/tv");
  const channel = page.getByRole("combobox", { name: /^Channel/ });
  await expect(channel).toHaveValue("");
  await expect(channel.locator("option").first()).toHaveText("Race replays with results");
  await expect(page.getByRole("group", { name: "Surface" }).getByRole("button")).toHaveText(["All surfaces", "Dirt", "Turf", "Synthetic"]);
  await expect(page.getByRole("combobox", { name: /^Track/ })).toBeVisible();
  await expect(page.locator(".tvg-card")).toHaveCount(1);
  await channel.selectOption("all");
  await expect(page.getByRole("combobox", { name: /^Track/ })).toHaveCount(0);
  await expect(page.locator(".tvg-card")).toHaveCount(1);
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

/* ---------- Tracks live on YouTube ---------- */

const LIVE_TRACKS: Status = {
  state: "live",
  title: "Los Alamitos NIGHTTIME Full Card",
  startsAt: null,
  featured: false,
  // The featured broadcast's pass is missing, but tracks' YouTube streams are free.
  access: { allowed: false, reason: "required", plan: "tv_monthly" },
  // As the server sends them: the latest stream to start first.
  live: [
    { channelId: CH, channelName: "Los Alamitos", track: "Los Alamitos Race Course", videoId: "LIVEvideo01", title: "Los Alamitos NIGHTTIME Full Card", startedAt: "2026-11-23T01:00:00Z", viewers: 500 },
    { channelId: CH3, channelName: "Del Mar", track: "Del Mar", videoId: "DMlive00001", title: "Sunday, November 22 at Del Mar", startedAt: "2026-11-22T20:00:00Z", viewers: 900 },
  ],
  upcoming: null,
  latest: null,
};
const trackPlayback = (url: URL): Reply => {
  const id = url.searchParams.get("channel") === CH ? "LIVEvideo01" : "DMlive00001";
  return { status: 200, json: { url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, title: "Live", kind: "embed", embeddable: true, watchUrl: `https://www.youtube.com/watch?v=${id}` } };
};

test("live tracks: the latest to start plays first, free; Live now cards and the side panel switch tracks", async ({ page }) => {
  const { calls } = await mockTv(page, { status: LIVE_TRACKS, playback: trackPlayback, youtube: YT });
  await stubYouTube(page);
  await page.goto("/tv");
  await expect(page.locator(".tvg-onscreen")).toHaveText("Live");
  await expect(page.locator(".tvg-screen iframe")).toHaveAttribute("src", /LIVEvideo01/);
  await expect(page.getByText("Live races need the TV Pass")).toHaveCount(0);
  expect(calls.playbackUrls[0]).toBe(`/api/tv/playback?channel=${CH}`);
  const side = page.getByRole("complementary", { name: "On air" });
  await expect(side).toContainText("Live now (2)");
  await expect(side.locator(".tvg-side-time")).toContainText("Los Alamitos Race Course · 500 watching");

  // The Live now section sits above Replays, one card per live track.
  const liveNow = page.getByRole("region", { name: "Live now" });
  await expect(liveNow).toContainText("2 tracks are racing live on YouTube");
  const box = (await liveNow.boundingBox())!;
  const replays = (await page.getByRole("region", { name: "Replays" }).boundingBox())!;
  expect(box.y).toBeLessThan(replays.y);
  await expect(liveNow.locator(".tvg-card")).toHaveCount(2);
  await expect(liveNow.locator(".tvg-card.is-playing")).toContainText("Los Alamitos NIGHTTIME Full Card");
  await expect(liveNow.locator("img").first()).toHaveAttribute("src", "https://i.ytimg.com/vi/LIVEvideo01/hqdefault_live.jpg");
  await liveNow.getByRole("button", { name: "Watch live: Del Mar" }).click();
  await expect(page).toHaveURL(new RegExp(`live=${CH3}`));
  await expect(page.locator(".tvg-screen iframe")).toHaveAttribute("src", /DMlive00001/);
  await expect(page.locator(".tvg-bar-title")).toHaveText("Del Mar · Sunday, November 22 at Del Mar");
  await expect(liveNow.locator(".tvg-card.is-playing")).toContainText("Sunday, November 22 at Del Mar");

  const list = side.getByRole("list", { name: "Tracks live now" });
  await expect(list.getByRole("button", { pressed: true })).toContainText("Del Mar");
  await list.getByRole("button", { name: /Los Alamitos/ }).click();
  await expect(page).toHaveURL(new RegExp(`live=${CH}`));
  await expect(page.locator(".tvg-screen iframe")).toHaveAttribute("src", /LIVEvideo01/);
});

test("no Live now section while nothing is live", async ({ page }) => {
  await mockTv(page, { youtube: YT });
  await page.goto("/tv");
  await expect(page.getByRole("heading", { name: "No live broadcast right now" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Live now" })).toHaveCount(0);
});

test("live track that only allows YouTube: a link to watch it there", async ({ page }) => {
  await mockTv(page, {
    status: { ...LIVE_TRACKS, live: [(LIVE_TRACKS.live as unknown[])[0]] },
    playback: { status: 200, json: { url: "https://www.youtube-nocookie.com/embed/DMlive00001", title: "Live", kind: "embed", embeddable: false, watchUrl: "https://www.youtube.com/watch?v=DMlive00001" } },
  });
  await page.goto("/tv");
  await expect(page.getByText("This track only allows its live stream to play on YouTube.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=DMlive00001");
  await expect(page.locator(".tvg-screen iframe")).toHaveCount(0);
});

test("the featured broadcast stays behind the TV Pass even while tracks are live", async ({ page }) => {
  await mockTv(page, { status: { ...LIVE_TRACKS, featured: true, title: "STAYBLZ special" }, playback: trackPlayback });
  await stubYouTube(page);
  await page.goto("/tv");
  await expect(page.locator(".tvg-screen iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Watch live: Del Mar" }).click();
  await expect(page.locator(".tvg-screen iframe")).toHaveAttribute("src", /DMlive00001/);
});

test("off air: the latest finished broadcast plays in the screen", async ({ page }) => {
  await mockTv(page, {
    youtube: YT,
    status: { ...OFF, featured: false, live: [], upcoming: null, latest: { channelId: CH, channelName: "Los Alamitos", videoId: "cJA4RJ5teuw", title: "Full card", endedAt: "2026-11-16T05:00:00Z" } },
  });
  await stubYouTube(page);
  await page.goto("/tv");
  await expect(page.locator(".tvg-latest-note")).toContainText("Los Alamitos · ended");
  await page.getByRole("button", { name: "Watch the latest broadcast" }).click();
  await expect(page).toHaveURL(/watch=cJA4RJ5teuw/);
  await expect(page.locator(".tvg-onscreen")).toHaveText("Replay");
});

test("upcoming track stream: countdown names the channel", async ({ page }) => {
  await mockTv(page, {
    status: { state: "upcoming", title: "Saturday at Del Mar", startsAt: "2099-01-03T18:30:00.000Z", featured: false, live: [], latest: null, upcoming: { channelId: CH3, channelName: "Del Mar", title: "Saturday at Del Mar", startsAt: "2099-01-03T18:30:00.000Z" } },
  });
  await page.goto("/tv");
  await expect(page.locator(".tvg-status")).toHaveText("Coming up");
  await expect(page.locator(".tvg-side-time")).toContainText("Del Mar");
});

for (const width of [320, 375]) {
  test(`phone ${width}px: live track list and Channel menu fit`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await mockTv(page, { status: LIVE_TRACKS, playback: trackPlayback, youtube: YT });
    await stubYouTube(page);
    await page.goto("/tv");
    await expect(page.getByRole("list", { name: "Tracks live now" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /^Channel/ })).toBeVisible();
    await noOverflow(page);
    const pick = (await page.getByRole("list", { name: "Tracks live now" }).getByRole("button").first().boundingBox())!;
    expect(pick.height).toBeGreaterThanOrEqual(44);
  });
}
