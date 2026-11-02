import { test, expect } from "@playwright/test";
import { stableId } from "./workspace-fixture";
const otherStable = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const member = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Owner User",
  role: "member",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me")
      return route.fulfill({ json: { user: member } });
    if (path === "/api/workspaces")
      return route.fulfill({
        json: {
          stables: [
            { id: stableId, name: "My stable", role: "owner" },
            { id: otherStable, name: "Second stable", role: "member" },
          ],
        },
      });
    if (path === "/api/workspaces/members")
      return route.fulfill({
        json: {
          members: [
            { id: member.id, displayName: "Owner User", role: "owner" },
            {
              id: "22222222-2222-4222-8222-222222222222",
              displayName: "Teammate",
              role: "member",
            },
          ],
        },
      });
    if (path === "/api/workspaces/invitations")
      return route.fulfill({ json: { invitations: [] } });
    if (path === "/api/inventory")
      return route.fulfill({ json: { items: [] } });
    if (path === "/api/horses") return route.fulfill({ json: { horses: [] } });
    if (path === "/api/messages")
      return route.fulfill({ json: { conversations: [] } });
    if (path === "/api/feed") return route.fulfill({ json: { posts: [] } });
    return route.fulfill({
      status: 503,
      json: { error: "Service unavailable" },
    });
  });
});

test("regular users create a stable, manage horses, and lose write controls in member workspaces", async ({
  page,
}) => {
  let created = false;
  let horses: any[] = [];
  await page.route("**/api/workspaces", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({ name: "New operation" });
      created = true;
      return route.fulfill({
        json: {
          stable: { id: stableId, name: "New operation", role: "owner" },
        },
      });
    }
    return route.fulfill({
      json: {
        stables: created
          ? [
              { id: stableId, name: "New operation", role: "owner" },
              { id: otherStable, name: "Other stable", role: "member" },
            ]
          : [],
      },
    });
  });
  await page.route("**/api/inventory", async (route) => {
    expect(route.request().headers()["x-stayblz-stable"]).toBe(stableId);
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      horses = [
        {
          ...body,
          id: "aaaaaaaa-1111-4111-8111-111111111111",
          silksColor: "#365b43",
          coatColor: "#704a32",
          maneColor: "#2f261e",
          blaze: false,
        },
      ];
      return route.fulfill({ json: { item: horses[0] } });
    }
    return route.fulfill({ json: { items: horses } });
  });
  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: "Start your stable" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Set up your stable" }).click();
  await page.getByLabel("New stable name").fill("New operation");
  await page
    .getByRole("button", { name: "Create stable", exact: true })
    .click();
  await expect(page.getByLabel("Active stable")).toHaveValue(stableId);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Inventory", exact: true })
    .click();
  await page.getByRole("button", { name: "Add horse", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a horse" });
  await dialog.getByLabel("Horse name", { exact: true }).fill("Homebred");
  await dialog.getByLabel("Age", { exact: true }).fill("3");
  await dialog.getByRole("button", { name: "Save horse" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: "View details for Homebred" }),
  ).toBeVisible();
  await page.route("**/api/inventory", (route) => {
    expect(route.request().headers()["x-stayblz-stable"]).toBe(otherStable);
    return route.fulfill({ json: { items: [] } });
  });
  await page.getByLabel("Current stable").selectOption(otherStable);
  await expect(
    page.getByRole("button", { name: "Add horse", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Homebred", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Administration", exact: true }),
  ).toHaveCount(0);
});

test("invitation codes survive initial stable loading and are removed from the URL", async ({
  page,
}) => {
  const code = "a".repeat(64);
  await page.route("**/api/workspaces", async (route) => {
    await new Promise((r) => setTimeout(r, 250));
    return route.fulfill({
      json: { stables: [{ id: stableId, name: "My stable", role: "owner" }] },
    });
  });
  let accepted = "";
  await page.route("**/api/workspaces/accept-invitation", (route) => {
    accepted = route.request().postDataJSON().token;
    return route.fulfill({ json: { stableId } });
  });
  await page.goto("/stables#invite=" + code);
  await expect(page.getByLabel("Invitation code")).toHaveValue(code);
  await expect(page.getByLabel("Active stable")).toHaveValue(stableId);
  await expect(page.getByLabel("Invitation code")).toHaveValue(code);
  expect(new URL(page.url()).hash).toBe("");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByText(/Invitation accepted/)).toBeVisible();
  expect(accepted).toBe(code);
});

test("owners can create shareable invitations and members cannot see team administration", async ({
  page,
}) => {
  await page.route("**/api/workspaces/invitations", (route) =>
    route.fulfill({
      json:
        route.request().method() === "POST"
          ? { token: "b".repeat(64) }
          : { invitations: [] },
    }),
  );
  await page.goto("/stables");
  await page.getByLabel("Teammate email").fill("teammate@example.test");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await expect(
    page.getByLabel("Invitation link · copy and share privately"),
  ).toHaveValue(new RegExp("#invite=b{64}$"));
  await expect(page.getByText(/no email was sent/)).toBeVisible();
  await page.getByLabel("Active stable").selectOption(otherStable);
  await expect(
    page.getByRole("button", { name: "Create invitation", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Remove Teammate/ }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Invitation link · copy and share privately"),
  ).toHaveCount(0);
});

test("messages save only after the server confirms; failed sends retain the draft and retry ID", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  const conversation = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Training plan",
    participants: ["Owner User", "Teammate"],
    lastMessage: "",
    lastMessageAt: "2026-11-03T00:00:00Z",
    unread: 0,
    messages: [],
  };
  await page.route("**/api/team-messages", (route) =>
    route.fulfill({
      json:
        route.request().method() === "POST"
          ? { conversation }
          : { conversations: [] },
    }),
  );
  let calls = 0;
  const ids: string[] = [];
  await page.route("**/api/team-messages/*/messages", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    ids.push(body.clientId);
    expect(route.request().headers()["x-stayblz-stable"]).toBe(stableId);
    await new Promise((r) => setTimeout(r, 150));
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: "Could not save message" },
        })
      : route.fulfill({
          json: {
            message: {
              id: "saved",
              from: "Owner User",
              body: body.body,
              sentAt: "2026-11-03T01:00:00Z",
              mine: true,
            },
          },
        });
  });
  await page.goto("/team-messages");
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page.getByLabel("Conversation title").fill("Training plan");
  await page.getByLabel("Teammate", { exact: true }).check();
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  const draft = page.getByLabel("Write a message");
  await draft.fill("Keep this message");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText("Could not save message");
  await expect(draft).toHaveValue("Keep this message");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(draft).toHaveValue("");
  await expect(
    page.locator(".bubble").getByText("Keep this message"),
  ).toBeVisible();
  expect(ids[0]).toBe(ids[1]);
});

test("team, inventory and message flows fit small and wide screens in both themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 375, 768, 1440, 2560]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/stables");
    await expect(
      page.getByRole("heading", { name: "My stables & team" }),
    ).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Add horse", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.goto("/stables");
  await expect(page.getByText("Teammate", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/team-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});


test("late invitation creation cannot display a link inside another stable", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/workspaces/invitations", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    await held;
    return route.fulfill({ json: { token: "c".repeat(64) } });
  });
  await page.goto("/stables");
  await page.getByLabel("Teammate email").fill("teammate@example.test");
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  await page.getByLabel("Active stable").selectOption(otherStable);
  release();
  await expect(page.getByRole("button", { name: "Refresh stables & team" })).toBeEnabled();
  await expect(page.getByLabel("Invitation link ? copy and share privately")).toHaveCount(0);
  await page.getByLabel("Active stable").selectOption(stableId);
  await expect(page.getByLabel("Teammate email")).toBeVisible();
  await expect(page.getByLabel("Invitation link ? copy and share privately")).toHaveCount(0);
});
