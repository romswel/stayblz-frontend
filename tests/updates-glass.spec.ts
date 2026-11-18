import { test, expect, type Page } from "@playwright/test";

// Updates on the glass theme: month timeline, reactions (signed in to react), "In this post" outline.
const member = { id: "11111111-1111-4111-8111-111111111111", username: "m@example.test", displayName: "Mia Member", role: "member", email: "m@example.test",
  preferences: { marketingOptIn: false, updatesSeenAt: "2026-11-30T00:00:00Z", updatesPopup: false } };
const post = (over: Record<string, unknown>) => ({
  id: "00000000-0000-4000-8000-000000000001", slug: "faster-racecards", kind: "update", title: "Faster racecards", summary: "Racecards load faster.",
  items: [], version: "0.16", audience: "public", pinned: false, popup: false, status: "published", publishedAt: "2026-11-17T08:00:00Z",
  authorLabel: "Stayblz team", updatedAt: "2026-11-17T08:00:00Z", readMinutes: 2, hasBody: true, ...over,
});
const posts = [
  post({}),
  post({ id: "00000000-0000-4000-8000-000000000002", slug: "safer-accounts", title: "Safer accounts", kind: "announcement", publishedAt: "2026-11-09T08:00:00Z" }),
  post({ id: "00000000-0000-4000-8000-000000000003", slug: "october-fixes", title: "October fixes", publishedAt: "2026-10-20T08:00:00Z" }),
];
const body = "## Why it matters\n\nText.\n\n## What changed\n\nMore text.\n\n### Small detail\n\nEven more.";

async function api(page: Page, me: Record<string, unknown> | null) {
  const reactions: Record<string, { counts: Record<string, number>; mine: string[] }> = {
    "faster-racecards": { counts: { like: 2 }, mine: [] },
  };
  const sent: unknown[] = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh")
      return me ? route.fulfill({ json: { user: me } }) : route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/messages/unread") return route.fulfill({ json: { personal: 0, requests: 0, team: 0 } });
    if (path === "/api/updates") return route.fulfill({ json: { updates: posts, pinned: [], hasMore: false, signedIn: !!me } });
    if (path === "/api/updates/reactions") {
      const slugs = (url.searchParams.get("slugs") ?? "").split(",");
      return route.fulfill({ json: { reactions: Object.fromEntries(slugs.filter((s) => reactions[s]).map((s) => [s, reactions[s]])) } });
    }
    const react = path.match(/^\/api\/updates\/([a-z0-9-]+)\/reactions$/);
    if (react && route.request().method() === "POST") {
      const { reaction, on } = route.request().postDataJSON();
      sent.push({ reaction, on });
      const r = reactions[react[1]];
      r.counts[reaction] = (r.counts[reaction] ?? 0) + (on ? 1 : -1);
      r.mine = on ? [...r.mine, reaction] : r.mine.filter((k) => k !== reaction);
      return route.fulfill({ json: { reactions: r } });
    }
    if (path === "/api/updates/faster-racecards")
      return route.fulfill({ json: { update: { ...posts[0], body }, newer: null, older: { slug: "safer-accounts", title: "Safer accounts" } } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
  return sent;
}

test("the feed groups older posts by month and shows reaction counts", async ({ page }) => {
  await api(page, member);
  await page.goto("/updates");
  await expect(page.getByRole("heading", { name: "Updates", level: 1 })).toBeVisible();
  const earlier = page.getByRole("region", { name: "Earlier posts" });
  const months = earlier.locator(".up-month-label");
  await expect(months).toHaveCount(2);
  await expect(months.nth(0)).toContainText("2026");
  await expect(page.locator(".up-card.is-featured .up-react-counts")).toHaveAttribute("aria-label", "2 reactions");
});

test("signed-in readers react to a post; the outline follows the headings", async ({ page }) => {
  const sent = await api(page, member);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/updates/faster-racecards");
  const outline = page.getByRole("navigation", { name: "In this post" });
  await expect(outline.getByRole("link")).toHaveText(["Why it matters", "What changed"]);
  await outline.getByRole("link", { name: "What changed" }).click();
  await expect(page).toHaveURL(/#h-what-changed$/);
  await expect(page.getByRole("progressbar", { name: "Reading progress" })).toBeAttached();
  const reactions = page.getByRole("group", { name: "React to this post" });
  const helpful = reactions.getByRole("button", { name: /Helpful/ });
  await expect(helpful).toContainText("2");
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "true");
  await expect(helpful).toContainText("3");
  await helpful.click();
  await expect(helpful).toHaveAttribute("aria-pressed", "false");
  expect(sent).toEqual([{ reaction: "like", on: true }, { reaction: "like", on: false }]);
});

test("guests see the counts and a log in link, not working buttons", async ({ page }) => {
  await api(page, null);
  await page.goto("/updates/faster-racecards");
  const reactions = page.getByRole("group", { name: "React to this post" });
  await expect(reactions.getByRole("button", { name: /Helpful/ })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Reactions" }).getByRole("link", { name: "Log in" })).toBeVisible();
});
