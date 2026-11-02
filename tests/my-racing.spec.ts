import { test, expect, type Page } from "@playwright/test";
const self = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Racing Customer",
  role: "member",
  email: "customer@example.test",
};
const conversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const conversation = {
  id: conversationId,
  title: "Race day conversation",
  participants: ["Racing Customer"],
  lastMessage: "",
  lastMessageAt: "2026-11-03T00:00:00Z",
  unread: 0,
  canInvite: true,
  messages: [],
};
test.beforeEach(async ({ page }) => {
  let notes: any[] = [];
  let preferences = {
    entry_alerts: false,
    workout_alerts: false,
    result_alerts: false,
    email_enabled: false,
  };
  let conversations: any[] = [];
  const watched = new Set<string>();
  await page.route("**/api/**", (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    if (path === "/api/auth/me") return route.fulfill({ json: { user: self } });
    if (path === "/api/workspaces")
      return route.fulfill({
        status: 503,
        json: { error: "Stable service unavailable" },
      });
    if (path === "/api/public/racing-overview")
      return route.fulfill({
        json: {
          sections: Object.fromEntries(
            [
              "racecards",
              "results",
              "workouts",
              "horses",
              "jockeys",
              "trainers",
              "stakes",
              "notes",
            ].map((k) => [k, []]),
          ),
          fetchedAt: "2026-11-03T00:00:00Z",
        },
      });
    if (path === "/api/my-racing/summary")
      return route.fulfill({
        json: {
          following: watched.size,
          notes: notes.length,
          conversations: conversations.length,
        },
      });
    if (path === "/api/watchlist") {
      const kind = url.searchParams.get("kind") ?? "horses";
      return route.fulfill({
        json: {
          stable: [
            {
              id: kind,
              name:
                kind === "horses"
                  ? "Published Horse"
                  : kind === "jockeys"
                    ? "Published Rider"
                    : "Published Trainer",
              watched: watched.has(kind),
              lastActivity: "Published record",
              nextAlert: null,
            },
          ],
        },
      });
    }
    if (path === "/api/watchlist/toggle") {
      expect(req.headers()["x-stayblz-stable"]).toBeUndefined();
      const body = req.postDataJSON();
      if (body.watched) watched.add(body.id);
      else watched.delete(body.id);
      return route.fulfill({ json: body });
    }
    if (path === "/api/my-racing/notes") {
      if (method === "POST") {
        const note = {
          ...req.postDataJSON(),
          id: "note-1",
          updated_at: "2026-11-03T00:00:00Z",
        };
        notes = [note, ...notes];
        return route.fulfill({ json: { note } });
      }
      return route.fulfill({ json: { notes } });
    }
    if (path === "/api/my-racing/notes/note-1" && method === "PATCH") {
      const note = { ...notes[0], ...req.postDataJSON() };
      notes = [note];
      return route.fulfill({ json: { note } });
    }
    if (path === "/api/my-racing/notes/note-1/remove") {
      notes = [];
      return route.fulfill({ json: { ok: true } });
    }
    if (path === "/api/my-racing/preferences") {
      if (method === "PATCH") preferences = req.postDataJSON();
      return route.fulfill({ json: { preferences, deliveryAvailable: false } });
    }
    if (path === "/api/messages") {
      expect(req.headers()["x-stayblz-stable"]).toBeUndefined();
      if (method === "POST") {
        expect(req.postDataJSON()).toEqual({ title: "Race day conversation" });
        conversations = [conversation];
        return route.fulfill({ json: { conversation } });
      }
      return route.fulfill({ json: { conversations } });
    }
    if (path === `/api/messages/${conversationId}`)
      return route.fulfill({ json: { conversation, before: null } });
    if (path === `/api/messages/${conversationId}/invitations`)
      return route.fulfill({
        json:
          method === "POST" ? { token: "a".repeat(64) } : { invitations: [] },
      });
    return route.fulfill({
      status: 503,
      json: { error: "Service unavailable" },
    });
  });
});

async function openNotebook(page: Page) {
  await page.goto("/my-racing?tab=notes");
  await expect(
    page.getByRole("heading", { name: "The race notebook" }),
  ).toBeVisible();
}

test("racing and account tools work while the optional stable service is unavailable", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/(inventory|horses|feed|team-messages)/.test(
        new URL(r.url()).pathname,
      )
    )
      privateCalls.push(r.url());
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "The overview." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Saved to your account. You do not need to own or join a stable to use My racing.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start your stable" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Inventory", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Following & notebook", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "My racing." })).toBeVisible();
  await page
    .getByRole("button", { name: "Watch Published Horse", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop watching Published Horse" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jockeys", exact: true }).click();
  await page.getByRole("button", { name: "Watch Published Rider" }).click();
  await expect(
    page.getByRole("button", { name: "Stop watching Published Rider" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Trainers", exact: true }).click();
  await expect(
    page.getByText("Published Trainer", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  expect(privateCalls).toEqual([]);
});

test("the private notebook saves, edits, preserves failed drafts and confirms deletion", async ({
  page,
}) => {
  await openNotebook(page);
  await page.getByLabel("Note title", { exact: true }).fill("Watch the finish");
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Strong late run.\nWatch next time 🐎");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText("Note saved to your account.")).toBeVisible();
  await expect(
    page
      .locator(".mr-note")
      .getByText("Strong late run.\nWatch next time 🐎", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Watch the finish" }).click();
  await page
    .getByLabel("Your note", { exact: true })
    .fill("Revised observation");
  await page.route("**/api/my-racing/notes/note-1", (route) =>
    route.fulfill({ status: 503, json: { error: "Note save unavailable" } }),
  );
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Note save unavailable");
  await expect(page.getByLabel("Your note", { exact: true })).toHaveValue(
    "Revised observation",
  );
  await page.getByRole("button", { name: "Cancel editing" }).click();
  await page.getByRole("button", { name: "Delete Watch the finish" }).click();
  await expect(page.getByText("Delete this note permanently?")).toBeVisible();
  await page.getByRole("button", { name: "Keep note", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Watch the finish", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Watch the finish" }).click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Watch the finish", exact: true }),
  ).toHaveCount(0);
});

test("alert choices persist and delivery remains clearly unavailable", async ({
  page,
}) => {
  await page.goto("/my-racing?tab=alerts");
  await page.getByRole("checkbox", { name: /Race entries/ }).check();
  await page.getByRole("checkbox", { name: /Email delivery/ }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Automatic alerts and email delivery are not active yet.",
  );
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: /Race entries/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Email delivery/ }),
  ).toBeChecked();
  await expect(
    page.getByText("DELIVERY NOT CONNECTED", { exact: true }),
  ).toBeVisible();
});

test("personal conversations and private invitations require an account but no stable", async ({
  page,
}) => {
  await page.goto("/messages");
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/No stable membership is needed/)).toBeVisible();
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page.getByLabel("Conversation title").fill("Race day conversation");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await page.getByRole("button", { name: "Invite someone" }).click();
  await page.getByLabel("Recipient email").fill("friend@example.test");
  await page.getByRole("button", { name: "Create private invitation" }).click();
  await expect(page.getByLabel("Private conversation invitation")).toHaveValue(
    new RegExp("/messages#invite=a{64}$"),
  );
  await expect(
    page.getByText(/They will be able to read this conversation/),
  ).toBeVisible();
  let requestBody: any;
  await page.route("**/api/messages/*/messages", (route) => {
    expect(route.request().headers()["x-stayblz-stable"]).toBeUndefined();
    requestBody = route.request().postDataJSON();
    return route.fulfill({
      json: {
        message: {
          id: "message-1",
          from: self.displayName,
          body: requestBody.body,
          sentAt: "2026-11-03T00:00:00Z",
          mine: true,
        },
      },
    });
  });
  await page.getByLabel("Write a message").fill("See you at the races.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.locator(".bubble").getByText("See you at the races."),
  ).toBeVisible();
  expect(requestBody.clientId).toBeTruthy();
});

test("conversation invitations survive account loading and are consumed without stable setup", async ({
  page,
}) => {
  const token = "b".repeat(64);
  await page.route("**/api/messages/accept-invitation", (route) => {
    expect(route.request().postDataJSON().token).toBe(token);
    return route.fulfill({ json: { conversationId } });
  });
  await page.goto("/messages#invite=" + token);
  await expect(page.getByLabel("Conversation invitation code")).toHaveValue(
    token,
  );
  expect(new URL(page.url()).hash).toBe("");
  await page
    .getByRole("button", { name: "Accept conversation invitation" })
    .click();
  await expect(
    page.getByText("Conversation invitation accepted."),
  ).toBeVisible();
  await expect(
    page
      .locator(".thread-head")
      .getByText("Race day conversation", { exact: true }),
  ).toBeVisible();
});

test("personal pages remain usable across devices and themes with account access retained", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 375, 768, 1440, 2560]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/my-racing");
    await expect(
      page.getByRole("button", { name: "Watch Published Horse" }),
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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/my-racing?tab=notes");
  await expect(page.getByLabel("Note title", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/my-racing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: "test-results/my-racing-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.locator('.ws-main').evaluate(el=>getComputedStyle(el).marginLeft)).toBe('0px');
  await page.screenshot({
    path: "test-results/my-racing-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});


test("notebook protects the submitted draft while a save is in flight", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/my-racing/notes", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    const note = { ...route.request().postDataJSON(), id: "delayed-note", updated_at: "2026-11-03T00:00:00Z" };
    await held;
    return route.fulfill({ json: { note } });
  });
  await openNotebook(page);
  await page.getByLabel("Note title", { exact: true }).fill("My observation");
  await page.getByLabel("Your note", { exact: true }).fill("Keep the full draft");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByLabel("Note title", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Your note", { exact: true })).toBeDisabled();
  release();
  await expect(page.getByText("Note saved to your account.")).toBeVisible();
  await expect(page.getByLabel("Your note", { exact: true })).toBeEnabled();
  await expect(page.locator(".mr-note")).toContainText("Keep the full draft");
});
