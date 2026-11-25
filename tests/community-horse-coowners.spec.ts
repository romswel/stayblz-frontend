import { test, expect, type Page } from "@playwright/test";

// Every API is mocked: these tests prove the page flow (co-owned horses in My horses), not the real backend.
const ME = "11111111-1111-4111-8111-111111111111";
const DAD = "55555555-5555-4555-8555-555555555555";
const HORSE = "22222222-2222-4222-8222-222222222222";
const INVITED = "66666666-6666-4666-8666-666666666666";
const CHANGE = "77777777-7777-4777-8777-777777777777";

const horse = (extra: Record<string, unknown> = {}) => ({
  id: HORSE,
  ownerId: ME,
  name: "Dad's Dream",
  breed: "Thoroughbred",
  sex: "colt",
  foaledYear: 2022,
  color: "Bay",
  sire: "",
  dam: "",
  status: "racing",
  trainer: "T. Jones",
  location: "",
  description: "",
  visibility: "members",
  coverImageId: null,
  imageCount: 0,
  stats: { starts: 0, wins: 0, places: 0, shows: 0, earningsCents: 0, lastRace: null },
  mine: true,
  role: "lead",
  requireApproval: true,
  coOwners: 1,
  pendingChanges: 1,
  raceData: null,
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  ...extra,
});
const person = { id: ME, name: "Rita Archer", headline: "", me: true, horses: 1, starts: 0, wins: 0, earningsCents: 0, followers: 0, followingCount: 0, posts: 0, isFollowing: false, followsYou: false, inventoryOpen: true };
const ownersList = () => [
  { id: ME, name: "Rita Archer", lead: true, status: "accepted", shareBps: 5000, me: true },
  { id: DAD, name: "Ben Archer", lead: false, status: "accepted", shareBps: 5000, me: false },
];

async function mockApp(page: Page) {
  const state = {
    invites: [
      { horse: { id: INVITED, name: "Lucky Star", breed: "Standardbred", coverImageId: null }, invitedBy: { id: DAD, name: "Ben Archer" }, invitedAt: "2026-11-20T10:00:00Z", shareBps: 2500 },
    ],
    answeredInvites: [] as string[],
    answeredChanges: [] as string[],
    trainer: "T. Jones",
    invitedOwners: [] as unknown[],
  };
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "light"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: ME, username: "rita", displayName: "Rita Archer", role: "member" } } });
    if (path === "/api/tv/status") return route.fulfill({ json: { state: "off_air", title: null, startsAt: null } });
    if (path === "/api/community/me")
      return route.fulfill({ json: { settings: { headline: "", inventoryVisibility: "members", showEarnings: true, listed: true }, person } });
    if (path === "/api/community/horse-invites") return route.fulfill({ json: { invites: state.invites } });
    if (path === `/api/community/horse-invites/${INVITED}/accept`) {
      state.answeredInvites.push("accept");
      state.invites = [];
      return route.fulfill({ json: { horse: { ...horse({ id: INVITED, name: "Lucky Star", role: "coowner" }), images: [], records: [], owner: { id: DAD, name: "Ben Archer", headline: "", isFollowing: false, me: false } } } });
    }
    if (path === `/api/community/people/${ME}/horses`) {
      const list = [horse({ trainer: state.trainer, pendingChanges: state.answeredChanges.length ? 0 : 1 })];
      if (state.answeredInvites.length) list.push(horse({ id: INVITED, name: "Lucky Star", ownerId: DAD, role: "coowner", coOwners: 1, pendingChanges: 0 }));
      return route.fulfill({ json: { horses: list, restricted: false } });
    }
    if (path === `/api/community/horses/${HORSE}`)
      return route.fulfill({
        json: {
          horse: {
            ...horse({ trainer: state.trainer, pendingChanges: state.answeredChanges.length ? 0 : 1 }),
            images: [],
            records: [],
            owner: { id: ME, name: "Rita Archer", headline: "", isFollowing: false, me: true },
            owners: ownersList(),
          },
        },
      });
    if (path === `/api/community/horses/${HORSE}/owners` && method === "GET")
      return route.fulfill({ json: { owners: ownersList(), role: "lead", requireApproval: true } });
    if (path === `/api/community/horses/${HORSE}/owners` && method === "POST") {
      state.invitedOwners.push(request.postDataJSON());
      return route.fulfill({
        status: 201,
        json: { owners: [...ownersList(), { id: "88888888-8888-4888-8888-888888888888", name: "Cara Archer", lead: false, status: "pending", shareBps: null, me: false }] },
      });
    }
    if (path === `/api/community/horses/${HORSE}/changes`)
      return route.fulfill({
        json: {
          changes: state.answeredChanges.length
            ? []
            : [{ id: CHANGE, kind: "details", createdAt: "2026-11-24T09:00:00Z", mine: false, proposedBy: { id: DAD, name: "Ben Archer" }, fields: [{ field: "trainer", from: "T. Jones", to: "B. Baffert" }], record: null, proposed: null }],
        },
      });
    if (path === `/api/community/changes/${CHANGE}/accept`) {
      state.answeredChanges.push("accept");
      state.trainer = "B. Baffert";
      return route.fulfill({
        json: { ok: true, horse: { ...horse({ trainer: "B. Baffert", pendingChanges: 0 }), images: [], records: [], owner: { id: ME, name: "Rita Archer", headline: "", isFollowing: false, me: true }, owners: ownersList() } },
      });
    }
    if (path === "/api/community/search")
      return route.fulfill({ json: { people: [{ id: "88888888-8888-4888-8888-888888888888", name: "Cara Archer", headline: "Owner", horses: 0, me: false }], horses: [] } });
    if (path.startsWith("/api/community/media/horse/")) return route.fulfill({ status: 404, json: { error: "none" } });
    return route.fulfill({ status: 403, json: { error: "Not part of this test" } });
  });
  return state;
}

test("My horses: accepting a co-ownership invite adds the horse to the list as co-owned", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/account/horses");
  const invites = page.getByRole("region", { name: "Co-ownership invitations" });
  await expect(invites.getByText("Lucky Star")).toBeVisible();
  await expect(invites.getByText("Ben Archer invited you to co-own this horse (25% share).")).toBeVisible();
  await invites.getByRole("button", { name: "Accept" }).click();
  await expect(invites).toHaveCount(0);
  expect(state.answeredInvites).toEqual(["accept"]);
  await expect(page.getByText("Co-owned")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lucky Star", exact: true })).toBeVisible();
  await expect(page.getByText("Shared with 1")).toBeVisible();
});

test("My horses: the lead owner approves a co-owner's change and invites another co-owner from the Owners tab", async ({ page }) => {
  const state = await mockApp(page);
  await page.goto("/account/horses");
  // "1 to approve" opens the editor on the Owners tab.
  await page.getByRole("button", { name: "1 to approve" }).click();
  const editor = page.getByRole("dialog", { name: "Dad's Dream" });
  await expect(editor.getByText("Ben Archer", { exact: true })).toBeVisible();
  await expect(editor.getByText("Lead owner")).toBeVisible();
  await expect(editor.getByLabel("Ben Archer's share")).toHaveValue("50");
  await expect(editor.getByRole("checkbox", { name: /Changes need approval/ })).toBeChecked();

  const change = editor.locator(".cm-change-list li");
  await expect(change.getByText("Trainer")).toBeVisible();
  await expect(change.getByText("B. Baffert")).toBeVisible();
  await change.getByRole("button", { name: "Accept" }).click();
  await expect(editor.getByText("Nothing is waiting.")).toBeVisible();
  expect(state.answeredChanges).toEqual(["accept"]);

  await editor.getByPlaceholder("Search members by name").fill("Cara");
  await editor.getByRole("button", { name: /Cara Archer/ }).click();
  await editor.getByPlaceholder("50").fill("10");
  await editor.getByRole("button", { name: "Send invite" }).click();
  await expect(editor.getByText("Invited · waiting for an answer")).toBeVisible();
  expect(state.invitedOwners).toEqual([{ accountId: "88888888-8888-4888-8888-888888888888", shareBps: 1000 }]);

  // No horizontal overflow on a small phone.
  await page.setViewportSize({ width: 320, height: 700 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
