import { test, expect, type Page } from "@playwright/test";
import { ANN, GRP, fakeServer, me, msg } from "./messenger-fixture";

// Stayblz Chat v3 (Messenger-style details) and notifications, against the in-memory fake API.
const row = (page: Page, text: string) => page.locator(".mx-row", { hasText: text }).first();

test("reply labels, double-click ❤️, who reacted, and the pinned list", async ({ page }) => {
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

  // "Ann replied to you" above the quoted message.
  await expect(row(page, "Bring the blue saddle cloth")).toContainText("Ann replied to you");

  // Double-click a message: a quick ❤️, with the who-reacted list behind the pill.
  await row(page, "Gallops at six?").locator(".mx-bubble").dblclick();
  await expect.poll(() => server.posts.filter((p) => p.path.endsWith("/react")).map((p) => p.body.emoji)).toEqual(["❤️"]);
  await row(page, "Gallops at six?").getByRole("button", { name: /Reactions: ❤️ 1/ }).click();
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

test("notifications: the pop-up turns them on, then a new message shows a card that opens the chat", async ({ page, context }) => {
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
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification, configurable: true });
  });
  await page.goto("/dashboard");
  const ask = page.getByRole("dialog", { name: "Turn on notifications" });
  await expect(ask).toBeVisible({ timeout: 8000 });
  await ask.getByRole("button", { name: "Turn on" }).click();
  await expect(ask.getByText("Notifications are on")).toBeVisible();
  await expect.poll(() => server.posts.filter((p) => p.path === "/api/notifications/settings").map((p) => p.body)).toEqual([{ enabled: true, prompted: true }]);
  await ask.getByRole("button", { name: "Got it" }).click();

  server.alerts.push({
    chatId: ANN,
    kind: "personal",
    stableId: null,
    stableName: null,
    group: false,
    title: null,
    from: "Ann Ames",
    fromId: "other-" + ANN,
    body: "Track is fast today",
    at: new Date().toISOString(),
    request: false,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("stayblz:chats-changed")));
  const card = page.locator(".nt-toast", { hasText: "Track is fast today" });
  await expect(card).toBeVisible({ timeout: 8000 });
  await card.getByRole("button", { name: /Ann Ames/ }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${ANN}$`));

  // The bell remembers it.
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByRole("dialog", { name: "Notifications" }).getByText("Track is fast today")).toBeVisible();

  // Stayblz in the background: a system notification instead of a card.
  server.alerts.push({
    chatId: ANN, kind: "personal", stableId: null, stableName: null, group: false, title: null,
    from: "Ann Ames", fromId: null, body: "📷 Photo", at: new Date(Date.now() + 1000).toISOString(), request: false,
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { value: () => false, configurable: true });
    window.dispatchEvent(new Event("stayblz:chats-changed"));
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shown?: unknown[] }).__shown ?? []), { timeout: 8000 }).toEqual([
    { title: "Ann Ames", body: "Sent a photo" },
  ]);
});

test("notification settings page: account switch, chat choices, honest push status", async ({ page }) => {
  const server = await fakeServer(page);
  server.notify = { enabled: true, chatMessages: true, chatRequests: true, previews: true, sound: true, promptedAt: new Date().toISOString(), devices: 0 };
  await page.goto("/account/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("Not switched on for Stayblz yet", { exact: false })).toBeVisible();
  await page.getByLabel(/Show message text/).uncheck();
  await expect.poll(() => server.posts.filter((p) => p.path === "/api/notifications/settings").map((p) => p.body)).toEqual([{ previews: false }]);
  await page.getByLabel(/Notify me/).uncheck();
  await expect(page.getByLabel(/New messages/)).toBeDisabled();
  // No pop-up when you've already been asked.
  await expect(page.getByRole("dialog", { name: "Turn on notifications" })).toHaveCount(0);
});
