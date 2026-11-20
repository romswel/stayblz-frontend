import { test, expect, type Page } from "@playwright/test";
import { ANN, GRP, fakeServer, me, msg } from "./messenger-fixture";

// Stayblz Chat v3 details and notifications, against the in-memory fake API.
const row = (page: Page, text: string) => page.locator(".mx-row", { hasText: text }).first();

test("reply labels, double-click 👍, who reacted, and the pinned list", async ({ page }) => {
  const server = await fakeServer(page);
  const gallops = server.threads[ANN].messages[0];
  server.threads[ANN].messages.push(
    msg("Ann Ames", "Bring the blue saddle cloth", false, 2, {
      replyTo: { id: server.threads[ANN].messages[1].id, from: me.displayName, senderId: me.id, body: "I'll be there", removed: false },
    }),
  );
  gallops.pinned = true;
  server.threads[ANN].pinnedMessages = [{ id: gallops.id, from: "Ann Ames", body: "Gallops at six?", attachment: null, pinnedAt: new Date().toISOString() }];
  await page.goto(`/messages/${ANN}`);

  // "In reply to you" above the quoted message.
  await expect(row(page, "Bring the blue saddle cloth")).toContainText("In reply to you");

  // Double-click a message: a quick 👍, with the who-reacted list behind the tag.
  await row(page, "Gallops at six?").locator(".mx-bubble").dblclick();
  await expect.poll(() => server.posts.filter((p) => p.path.endsWith("/react")).map((p) => p.body.emoji)).toEqual(["👍"]);
  await row(page, "Gallops at six?").getByRole("button", { name: /Reactions: 👍 1/ }).click();
  const who = page.getByRole("dialog", { name: "Reactions" });
  await expect(who.getByRole("listitem")).toContainText("You");
  await who.getByRole("button", { name: "Tap to remove" }).click();
  await expect.poll(() => server.posts.filter((p) => p.path.endsWith("/react")).length).toBe(2);

  // Pinned bar → every pinned message; tapping one jumps to it.
  await expect(page.locator(".mx-pinbar")).toContainText("Gallops at six?");
  await page.getByRole("button", { name: /See all 1 pinned messages/ }).click();
  const pinned = page.getByRole("dialog", { name: "Pinned messages" });
  await expect(pinned.getByRole("button", { name: "Go to pinned message from Ann Ames" })).toBeVisible();
  await pinned.getByRole("button", { name: "Go to pinned message from Ann Ames" }).click();
  await expect(pinned).toHaveCount(0);
  await expect(row(page, "Gallops at six?")).toHaveClass(/is-flash/);
});

test("chat info: mute for a while, media/files/links, and voice clips play from the timeline", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[ANN].messages.push(
    msg("Ann Ames", "Card is up https://example.test/card", false, 3),
    msg("Ann Ames", "", false, 2, { attachment: { name: "Voice message.webm", size: 20_000, type: "audio/webm", duration: 7 } }),
  );
  await page.goto(`/messages/${ANN}`);
  await expect(page.getByRole("button", { name: "Play voice message" })).toBeVisible();
  await expect(row(page, "0:07")).toBeVisible();

  await page.getByRole("button", { name: "Chat info", exact: true }).click();
  const info = page.getByRole("complementary", { name: "Chat info" });
  await expect(info.getByRole("link", { name: "Profile" })).toHaveAttribute("href", /\/community\/people\//);
  await info.getByRole("button", { name: "Mute", exact: true }).click();
  const mute = page.getByRole("dialog", { name: "Mute notifications" });
  await mute.getByLabel("For 1 hour").check();
  await mute.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(info.locator(".mx-info-muted")).toHaveText(/^Muted until/);
  await expect(page.locator(".mx-thread-sub .mx-sub-muted")).toBeVisible();
  expect(server.posts.find((p) => p.path.endsWith("/settings"))?.body).toEqual({ muteMinutes: 60 });

  await info.getByRole("button", { name: "Media, files and links" }).click();
  await info.getByRole("button", { name: /Links/ }).click();
  await expect(info.getByRole("link", { name: "example.test" })).toBeVisible();
  await info.getByRole("tab", { name: "Voice" }).click();
  await expect(info.getByRole("button", { name: "Play voice message" })).toBeVisible();
  await info.getByRole("button", { name: "Back to chat info" }).click();
  await expect(info.getByRole("button", { name: "Privacy & support" })).toBeVisible();
});

test("calls start a Stayblz Paddock meeting with the chat invited and post the link", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  await page.getByRole("button", { name: "Start a video call" }).click();
  await expect(page).toHaveURL(/\/paddock\/abcd-efgh$/);
  expect(server.meetings).toBe(1);
  const sent = server.threads[ANN].messages.at(-1)!;
  expect(sent.body).toMatch(/^📹 Video call on Stayblz Paddock — tap to join: http.*\/paddock\/abcd-efgh$/);
  // The call shows as a card with a Join button in the chat.
  await page.goto(`/messages/${ANN}`);
  await expect(row(page, "Video call").getByRole("link", { name: "Join" })).toHaveAttribute("href", "/paddock/abcd-efgh");
});

test("group chats: two faces for a group, 'Bo: …' previews, group photo upload", async ({ page }) => {
  const server = await fakeServer(page);
  Object.assign(server.threads[GRP], { participantIds: ["bo", "cy"], lastSenderName: "Bo Burke", lastSenderId: "bo" });
  await page.goto("/messages");
  const item = page.locator(".mx-item", { hasText: "Saturday syndicate" });
  await expect(item.locator(".mx-av.is-pair")).toBeVisible();
  await expect(item.locator(".mx-item-preview")).toHaveText("Bo: Who's driving?");
});

test("notifications: the guide turns them on, then new messages show as device notifications that open the chat", async ({ page, context }) => {
  const server = await fakeServer(page);
  server.notify = { enabled: false, chatMessages: true, chatRequests: true, previews: true, sound: false, promptedAt: null, devices: 0 };
  // Headless Chromium always says "denied", so stand in for the browser's permission question.
  await context.addInitScript(() => {
    class FakeNotification {
      static permission: NotificationPermission = "default";
      static async requestPermission() {
        FakeNotification.permission = "granted";
        return "granted" as NotificationPermission;
      }
      onclick: (() => void) | null = null;
      constructor(title: string, options: NotificationOptions = {}) {
        (window as unknown as { __shown: unknown[] }).__shown = [...((window as unknown as { __shown?: unknown[] }).__shown ?? []), { title, body: options.body }];
        (window as unknown as { __last: unknown }).__last = this;
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
  });
  await page.goto("/dashboard");
  const ask = page.getByRole("dialog", { name: "Set up notifications" });
  await expect(ask).toBeVisible({ timeout: 8000 });
  await expect(ask.getByText("Mentions and replies to you")).toBeVisible();
  await ask.getByRole("button", { name: "Turn on" }).click();
  await expect(ask.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await expect.poll(() => server.posts.filter((p) => p.path === "/api/notifications/settings").map((p) => p.body)).toEqual([{ enabled: true, prompted: true }]);
  await ask.getByRole("button", { name: "Done" }).click();
  await expect(ask).toHaveCount(0);

  const alert = (extra: Record<string, unknown>) => ({
    id: crypto.randomUUID(), kind: "message", chatKind: "personal", chatId: ANN, messageId: null, stableId: null,
    actorId: "other-" + ANN, actorName: "Ann Ames", title: null, group: false, body: "", emoji: null, attachment: null,
    count: 1, at: new Date().toISOString(), read: false, ...extra,
  });
  // Stayblz open and in front: still a device notification (not a card inside the page).
  server.alerts.push(alert({ body: "Track is fast today" }));
  await page.evaluate(() => window.dispatchEvent(new Event("stayblz:chats-changed")));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shown?: unknown[] }).__shown ?? []), { timeout: 8000 }).toEqual([
    { title: "Ann Ames", body: "Track is fast today" },
  ]);
  await expect(page.locator(".nt-toast")).toHaveCount(0);
  // Clicking it opens that chat.
  await page.evaluate(() => (window as unknown as { __last: { onclick: () => void } }).__last.onclick());
  await expect(page).toHaveURL(new RegExp(`/messages/${ANN}$`));

  // The bell remembers it.
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByRole("dialog", { name: "Notifications" }).getByText("Track is fast today")).toBeVisible();
  await page.keyboard.press("Escape");

  // Stayblz in the background: a system notification instead of a card, saying what was sent.
  server.alerts.push(alert({ body: "", attachment: { type: "image/png", name: "gate.png" }, at: new Date(Date.now() + 1000).toISOString() }));
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { value: () => false, configurable: true });
    window.dispatchEvent(new Event("stayblz:chats-changed"));
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shown?: unknown[] }).__shown ?? []), { timeout: 8000 }).toEqual([
    { title: "Ann Ames", body: "Track is fast today" },
    { title: "Ann Ames", body: "📷 Sent a photo" },
  ]);
});

test("where the browser blocks notifications, a mention shows as a card in Stayblz and opens the group at that message", async ({ page, context }) => {
  const server = await fakeServer(page);
  server.notify = { enabled: true, chatMessages: true, chatRequests: true, chatMentions: true, chatReactions: true, previews: true, sound: false, promptedAt: new Date().toISOString(), devices: 0 };
  await context.addInitScript(() => {
    class FakeNotification {
      static permission: NotificationPermission = "denied";
      static async requestPermission() {
        return "denied" as NotificationPermission;
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
  });
  // The first check only sets the starting point (nothing from before you opened Stayblz pops up), so wait for it.
  const firstCheck = page.waitForResponse((r) => r.url().includes("/api/messages/unread?since="));
  await page.goto("/dashboard");
  await firstCheck;
  const target = server.threads[GRP].messages[0];
  server.alerts.push({
    id: crypto.randomUUID(), kind: "mention", chatKind: "personal", chatId: GRP, messageId: target.id, stableId: null,
    actorId: "bo", actorName: "Bo Burke", title: "Saturday syndicate", group: true, body: "@Rae Rider who's driving?",
    emoji: null, attachment: null, count: 1, at: new Date().toISOString(), read: false,
  });
  server.alerts.push({
    id: crypto.randomUUID(), kind: "reaction", chatKind: "personal", chatId: ANN, messageId: null, stableId: null,
    actorId: "x", actorName: "Ann Ames", title: null, group: false, body: "I'll be there",
    emoji: "🎉", attachment: null, count: 1, at: new Date().toISOString(), read: false,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("stayblz:chats-changed")));
  await expect(page.locator(".nt-toast", { hasText: "Ann Ames reacted 🎉 to your message" })).toBeVisible({ timeout: 8000 });
  const card = page.locator(".nt-toast", { hasText: "Bo Burke mentioned you in Saturday syndicate" });
  await expect(card).toBeVisible();
  await expect(card.locator(".nt-face-badge")).toHaveText("@");
  await card.getByRole("button", { name: /mentioned you/ }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${GRP}$`), { timeout: 8000 });
  await expect(page.locator(`#msg-${target.id}`)).toHaveClass(/is-flash/);
  await expect.poll(() => server.posts.some((p) => p.path === "/api/notifications/alerts/read")).toBe(true);
});

test("a friend request notification opens People", async ({ page }) => {
  await fakeServer(page);
  await page.goto("/messages?people=1");
  await expect(page.getByRole("tab", { name: "People" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/\/messages$/);
});

test("notification settings page: account switch, chat choices, honest push status", async ({ page }) => {
  const server = await fakeServer(page);
  server.notify = { enabled: true, chatMessages: true, chatRequests: true, previews: true, sound: true, promptedAt: new Date().toISOString(), devices: 0 };
  await page.goto("/account/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("Not switched on for Stayblz yet", { exact: false })).toBeVisible();
  await expect(page.getByLabel(/Mentions and replies/)).toBeChecked();
  await expect(page.getByLabel(/Reactions/)).toBeChecked();
  await page.getByLabel(/Show message text/).uncheck();
  await expect.poll(() => server.posts.filter((p) => p.path === "/api/notifications/settings").map((p) => p.body)).toEqual([{ previews: false }]);
  await page.getByLabel(/Notify me/).uncheck();
  await expect(page.getByLabel(/New messages/)).toBeDisabled();
  // No pop-up when you've already been asked.
  await expect(page.getByRole("dialog", { name: "Set up notifications" })).toHaveCount(0);
});

test("group chats: @mentions suggest members and stand out; Stayblz links get a card", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[GRP].messages.push(
    msg("Cy Cole", "Can you drive, @Rae Rider?", false, 6, { senderId: "cy" }),
    msg("Bo Burke", "The race: http://127.0.0.1:5178/racing/races/11111111-2222-4333-8444-555555555555 and https://example.com/x", false, 4, { senderId: "bo" }),
  );
  await page.goto(`/messages/${GRP}`);
  // A message that mentions you is marked, and the mention is a chip.
  const mention = row(page, "Can you drive");
  await expect(mention).toHaveClass(/is-mention/);
  await expect(mention.locator(".mx-mention")).toHaveText("@Rae Rider");
  // Only Stayblz's own links get a card; it opens inside Stayblz.
  const card = row(page, "The race:").locator(".mx-linkcard");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Race");
  await expect(card).toHaveAttribute("href", "/racing/races/11111111-2222-4333-8444-555555555555");
  // Typing "@b" suggests Bo; Enter picks him.
  const box = page.getByRole("textbox", { name: "Write a message" });
  await box.fill("Thanks @b");
  const list = page.getByRole("listbox", { name: "Mention someone" });
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option")).toContainText("Bo Burke");
  await box.press("Enter");
  await expect(box).toHaveValue("Thanks @Bo Burke ");
  await expect(list).toHaveCount(0);
  await box.press("Enter");
  await expect.poll(() => server.posts.filter((p) => p.path.endsWith("/messages")).map((p) => p.body.body)).toEqual(["Thanks @Bo Burke"]);
  // Direct chats don't suggest anyone.
  await page.goto(`/messages/${ANN}`);
  await page.getByRole("textbox", { name: "Write a message" }).fill("@a");
  await expect(page.getByRole("listbox", { name: "Mention someone" })).toHaveCount(0);
});

test("a Marketplace inquiry shows the message, then the listing card", async ({ page }) => {
  const server = await fakeServer(page);
  const id = "5e11e700-0000-4000-8000-000000000001";
  server.threads[ANN].messages.push(
    msg("", "Hi, is this still available?", true, 1, {
      listing: { id, name: "Northern Ledger", price: 45000, location: "Lexington, Kentucky", cover: null },
    }),
  );
  await page.goto(`/messages/${ANN}`);
  const bubble = row(page, "Hi, is this still available?").locator(".mx-bubble");
  const card = bubble.locator(".mx-listingcard");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Northern Ledger");
  await expect(card).toContainText("$45,000");
  await expect(card).toContainText("Lexington, Kentucky");
  await expect(card).toHaveAttribute("href", `/marketplace?listing=${id}`);
  // The text comes first, the card under it.
  const text = await bubble.locator(".mx-text").boundingBox();
  const box = await card.boundingBox();
  expect(text && box && box.y > text.y).toBeTruthy();
});
