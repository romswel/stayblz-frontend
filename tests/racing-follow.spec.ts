import { test, expect, type Page } from "@playwright/test";

// Fictional fixture data for mocked API responses only.
const member = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "member@example.test",
  displayName: "Member User",
  role: "member",
  platformRole: "member",
  actingRole: null,
  email: "member@example.test",
  emailVerified: true,
  mfa: { enabled: false, verified: false },
  profile: { firstName: "Member", lastName: "User", country: "PH", racingRole: "fan", communityRoles: [], organisation: "", city: "", bio: "" },
  preferences: { marketingOptIn: false, updatesSeenAt: "2099-01-01T00:00:00Z", updatesPopup: false },
};
const HORSE = "h0000001-0000-4000-8000-000000000000";
const TRAINER = "p0000009-0000-4000-8000-000000000000";
const RACE = "a0000001-0000-4000-8000-000000000000";
const horse = { id: HORSE, name: "Alpha Fixture", country: "", foaled: 2096, sex: "filly", color: "", sire: "Fixture Sire", dam: "Fixture Dam", damSire: "", breeder: "", breed: "thoroughbred" };
const start = (extra: Record<string, unknown> = {}) => ({
  runnerId: "r1", raceId: RACE, dayId: "d1", date: "2099-06-08", track: "Fixture Downs", trackCode: "FX", race: 3, raceName: "",
  type: "maiden", grade: null, status: "scheduled", distance: "6 f", surface: "dirt", horse: { id: HORSE, name: "Alpha Fixture" },
  jockey: null, trainer: null, owner: null, program: "1", scratched: false, finish: null, lengths: null, odds: null, earnings: null, field: 8,
  ...extra,
});
const racingAlert = {
  id: "aaaa0000-0000-4000-8000-000000000001", kind: "race_entry", chatKind: null, chatId: null, messageId: "r1", stableId: null,
  actorId: null, actorName: "Alpha Fixture", title: "Alpha Fixture is entered", group: false,
  body: "Race 3 · Fixture Downs · Mon, Jun 8 · post 13:00", emoji: null, attachment: null, count: 1,
  link: `/racing/races/${RACE}`, at: new Date().toISOString(), read: false,
};

async function mock(page: Page, { signedIn = true, failFollow = false } = {}) {
  const state = { horse: false, family: false, person: false, relatives: 2, total: 0 };
  const posts: unknown[] = [];
  const alertQueries: string[] = [];
  await page.route("**/api/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === "/api/auth/me" || path === "/api/auth/refresh")
      return signedIn ? route.fulfill({ json: { user: member } }) : route.fulfill({ status: 401, json: { error: "Not signed in." } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    if (path === "/api/updates") return route.fulfill({ json: { updates: [], pinned: [], hasMore: false } });
    if (path === `/api/public/racing/horses/${HORSE}`)
      return route.fulfill({ json: { horse, stats: { starts: 0, wins: 0, places: 0, shows: 0, earnings: 0 }, starts: [start()], workouts: [] } });
    if (path === `/api/public/racing/people/${TRAINER}`)
      return route.fulfill({
        json: { person: { id: TRAINER, name: "Tess Trainer", kind: "trainer", country: "" }, stats: { starts: 0, wins: 0, places: 0, shows: 0, earnings: 0 }, byYear: [], upcoming: [], recent: [] },
      });
    if (path === "/api/my-racing/follows/state") return route.fulfill({ json: { state } });
    if (path === "/api/my-racing/follows" && req.method() === "POST") {
      const body = req.postDataJSON();
      posts.push(body);
      if (failFollow) return route.fulfill({ status: 503, json: { error: "Your follow could not be saved. Please try again." } });
      (state as Record<string, unknown>)[body.kind] = body.on;
      state.total = [state.horse, state.family, state.person].filter(Boolean).length;
      return route.fulfill({ json: { state } });
    }
    if (path === "/api/my-racing/follows") {
      const follows = [
        ...(state.horse ? [{ id: "f1", kind: "horse", since: "2099-01-01", horse: { ...horse }, person: null, relatives: null, next: start(), last: null }] : []),
        ...(state.family
          ? [{ id: "f2", kind: "family", since: "2099-01-01", horse: { ...horse }, person: null, relatives: 2, next: start({ horse: { id: "h2", name: "Beta Fixture" } }), last: start({ status: "official", finish: 2, horse: { id: "h2", name: "Beta Fixture" } }) }]
          : []),
        ...(state.person ? [{ id: "f3", kind: "person", since: "2099-01-01", horse: null, person: { id: TRAINER, name: "Tess Trainer", kind: "trainer" }, relatives: null, next: null, last: null }] : []),
      ];
      return route.fulfill({ json: { follows } });
    }
    if (path === "/api/notifications/settings")
      return route.fulfill({
        json: {
          settings: { enabled: true, chatMessages: true, chatRequests: true, chatMentions: true, chatReactions: true, paddockCalls: true, previews: true, sound: false, promptedAt: "2099-01-01T00:00:00Z", devices: 0 },
          push: { available: false, publicKey: null },
        },
      });
    if (path === "/api/notifications/alerts") {
      alertQueries.push(url.search);
      return route.fulfill({ json: { items: [racingAlert], unread: 1 } });
    }
    if (path === "/api/messages/unread") return route.fulfill({ json: { personal: 0, requests: 0, team: 0, alerts: [], alertsUnread: 1, now: new Date().toISOString() } });
    if (path.startsWith("/api/public/racing/")) return route.fulfill({ status: 404, json: { error: "That isn't published on Stayblz." } });
    return route.fulfill({ status: 503, json: { error: "Service unavailable" } });
  });
  return { posts, alertQueries };
}

test("follow a horse and its family from the horse page, then see and unfollow them in My racing", async ({ page }) => {
  const { posts } = await mock(page);
  await page.goto(`/racing/horses/${HORSE}`);
  await expect(page.getByRole("heading", { name: "Alpha Fixture", level: 1 })).toBeVisible();
  const follow = page.getByRole("button", { name: "Follow", exact: true });
  await expect(follow).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/Family = sire, dam, brothers and sisters out of the same dam, and foals · 2 on Stayblz now/)).toBeVisible();

  await follow.click();
  await expect(page.getByRole("button", { name: "Following", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Following Alpha Fixture. You'll get alerts" })).toBeVisible();
  await page.getByRole("button", { name: "Follow family" }).click();
  await expect(page.getByRole("button", { name: "Following family" })).toHaveAttribute("aria-pressed", "true");
  expect(posts).toEqual([
    { kind: "horse", id: HORSE, on: true },
    { kind: "family", id: HORSE, on: true },
  ]);

  await page.goto("/my-racing");
  await expect(page.locator("#mrg-panel-title")).toHaveText("Following");
  const items = page.locator(".fl-item");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("By Fixture Sire out of Fixture Dam");
  await expect(items.first().getByRole("link", { name: /Race 3 · FX/ })).toHaveAttribute("href", `/racing/races/${RACE}`);
  await expect(items.nth(1)).toContainText("Family · 2 relatives on Stayblz");
  await expect(items.nth(1)).toContainText("Beta Fixture · 2nd of 8");
  await page.getByRole("button", { name: "Families 1" }).click();
  await expect(items).toHaveCount(1);
  await items.first().getByRole("button", { name: "Unfollow" }).click();
  await expect(page.getByText("Stopped following Alpha Fixture's family.")).toBeVisible();
  await expect(page.getByText("Nothing in this group yet.")).toBeVisible();
  expect(posts.at(-1)).toEqual({ kind: "family", id: HORSE, on: false });
});

test("people pages follow the person; a failed save says so and changes nothing", async ({ page }) => {
  await mock(page, { failFollow: true });
  await page.goto(`/racing/people/${TRAINER}`);
  await expect(page.getByRole("heading", { name: "Tess Trainer", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Follow family" })).toHaveCount(0);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your follow could not be saved. Please try again." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("racing alerts show in the bell and open the race", async ({ page }) => {
  const { alertQueries } = await mock(page);
  await page.goto("/my-racing");
  await page.getByRole("button", { name: /Notifications \(1 new\)/ }).click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("Alpha Fixture is entered")).toBeVisible();
  await expect(panel.getByText("Race 3 · Fixture Downs · Mon, Jun 8 · post 13:00")).toBeVisible();
  expect(alertQueries).toContain("?racing=1");
  await panel.getByRole("button", { name: /Alpha Fixture is entered/ }).click();
  await expect(page).toHaveURL(new RegExp(`/racing/races/${RACE}$`));
});

test("an empty Following list points to the racing pages, and the phone layout fits", async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 320, height: 760 });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
    await page.goto("/my-racing");
    await expect(page.getByText("You're not following anything yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Entries", exact: true }).last()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no sideways scroll in ${theme}`).toBeLessThanOrEqual(1);
    await page.goto(`/racing/horses/${HORSE}`);
    await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow2, `horse page fits in ${theme}`).toBeLessThanOrEqual(1);
  }
});
