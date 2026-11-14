import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow, not the real backend, a real stream or a phone.
type Status = { state: "live" | "upcoming" | "off_air"; title: string | null; startsAt: string | null };
const OFF: Status = { state: "off_air", title: null, startsAt: null };

async function mockTv(
  page: Page,
  { status = OFF as Status | number, playback = { status: 409, json: { code: "off_air", error: "Nothing is on air right now." } } as { status: number; json: unknown } } = {},
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
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
  return { calls, state };
}

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
    expect(Math.abs(box.height - (box.width * 9) / 16)).toBeLessThan(2);
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
