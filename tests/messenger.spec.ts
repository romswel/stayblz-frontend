import { test, expect, type Page } from "@playwright/test";
import { ANN, GRP, NEW, REQ, chat, fakeServer, msg, PNG } from "./messenger-fixture";

const row = (page: Page, text: string) => page.locator(".mx-row", { hasText: text }).first();
async function more(page: Page, text: string, item: string) {
  const r = row(page, text);
  await r.hover();
  await r.getByRole("button", { name: "More" }).click();
  await page.getByRole("menu", { name: "Message options" }).getByRole("menuitem", { name: item }).click();
}

test("Stayblz Chat: honest free-plan notice, unread badge and settings", async ({ page }) => {
  const server = await fakeServer(page, { personal: 2, requests: 1, team: 0 });
  await page.goto("/messages");
  await expect(page.getByRole("heading", { name: "Stayblz Chat", exact: true })).toBeVisible();
  await expect(page.locator(".ws-version")).toHaveText(/^v\d+\.\d+/);
  await expect(page.getByRole("link", { name: "Stayblz Chat (3 unread)" })).toBeVisible();
  await expect(page.getByText("Free plan:")).toBeVisible();
  await page.getByRole("button", { name: "What this means" }).click();
  const about = page.getByRole("dialog", { name: "About chat storage" });
  await expect(about.getByText("Messages can go missing.")).toBeVisible();
  await expect(about.getByText("Small files only.")).toBeVisible();
  await about.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Dismiss notice" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Stayblz Chat", exact: true })).toBeVisible();
  await expect(page.getByText("Free plan:")).toHaveCount(0);

  await page.getByRole("button", { name: "Chat settings" }).click();
  const settings = page.getByRole("dialog", { name: "Stayblz Chat settings" });
  await expect(settings.getByText("1.1 MB of 50 MB used.")).toBeVisible();
  await settings.getByRole("switch", { name: /Show when I'm active/ }).click();
  await expect.poll(() => server.posts.find((p) => p.path === "/api/messages/people/profile")?.body).toEqual({ showActive: false });
});

test("start a chat by email; an unknown email gets a clear answer", async ({ page }) => {
  await fakeServer(page);
  await page.goto("/messages");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "New chat" });
  await dialog.getByRole("button", { name: "Use an account email instead" }).click();
  await dialog.getByLabel("Their account email").fill("nobody@example.test");
  await dialog.getByRole("button", { name: "Start chat" }).click();
  await expect(dialog.getByText(/No Stayblz account uses that email/)).toBeVisible();
  await dialog.getByLabel("Their account email").fill("friend@example.test");
  await dialog.getByRole("button", { name: "Start chat" }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${NEW}$`));
  await expect(page.locator(".mx-thread-head")).toContainText("Waiting for them to accept your request");
});

test("People: find members by name, add a friend, and message them", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto("/messages");
  await page.getByRole("tab", { name: "People" }).click();
  await expect(page.getByText(/No friends yet/)).toBeVisible();
  await page.getByLabel("Find people by name").fill("gus");
  await page.getByRole("button", { name: "Add Gus Grant as a friend" }).click();
  await expect(page.getByText("Requested")).toBeVisible();
  expect(server.posts.some((p) => p.path.endsWith("/friends/a0000000-0000-4000-8000-00000000000b/request"))).toBe(true);
  await page.getByRole("button", { name: "Message Gus Grant" }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${NEW}$`));
  await expect(page.locator(".mx-thread-head h2")).toHaveText("Gus Grant");
});

test("message requests can be read first, then accepted before replying", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[REQ] = chat(REQ, "Sam Stable", [msg("Sam Stable", "Is your filly for sale?", false, 3)], { request: true });
  await page.goto("/messages");
  await expect(page.getByRole("link", { name: /Sam Stable/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Requests/ }).click();
  await page.getByRole("link", { name: /Sam Stable, message request/ }).click();
  await expect(page.getByText("Is your filly for sale?")).toBeVisible();
  await expect(page.getByLabel("Write a message")).toHaveCount(0);
  expect(server.posts.some((p) => p.path.endsWith("/read"))).toBe(false);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByLabel("Write a message")).toBeVisible();
});

test("react (quick or any emoji), reply, edit, pin, forward and unsend", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[ANN].messages.push(msg("", "Bringing the tack", true, 2));
  await page.goto(`/messages/${ANN}`);

  const theirs = row(page, "Gallops at six?");
  await theirs.hover();
  await theirs.getByRole("button", { name: "React" }).click();
  await page.getByRole("group", { name: "Pick a reaction" }).getByRole("button", { name: "React ❤️" }).click();
  await expect(theirs.getByRole("button", { name: "❤️ 1, including you" })).toBeVisible();
  await theirs.hover();
  await theirs.getByRole("button", { name: "React" }).click();
  await page.getByRole("button", { name: "More reactions" }).click();
  await page.getByLabel("Search emoji").fill("trophy");
  await page.getByRole("button", { name: "trophy", exact: true }).click();
  await expect.poll(() => server.posts.filter((p) => p.path.endsWith("/react")).map((p) => p.body.emoji)).toEqual(["❤️", "🏆"]);

  await theirs.hover();
  await theirs.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText("Replying to")).toBeVisible();
  await page.getByLabel("Write a message").fill("See you at the barn");
  await page.keyboard.press("Enter");
  await expect(row(page, "See you at the barn").locator(".mx-quote")).toContainText("Gallops at six?");

  await more(page, "Bringing the tack", "Edit");
  const edit = page.getByLabel("Edit message");
  await expect(edit).toHaveValue("Bringing the tack");
  await edit.fill("Bringing the tack and the boots");
  await page.keyboard.press("Enter");
  await expect(row(page, "and the boots")).toContainText("Edited");

  await more(page, "Gallops at six?", "Pin");
  await expect(page.locator(".mx-pinbar")).toContainText("Gallops at six?");

  await more(page, "Gallops at six?", "Forward");
  const forward = page.getByRole("dialog", { name: "Forward message" });
  await forward.getByRole("checkbox", { name: "Saturday syndicate" }).check();
  await forward.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Forwarded." })).toBeVisible();
  expect(server.threads[GRP].messages.at(-1)?.forwarded).toBe(true);

  await more(page, "I'll be there", "Unsend");
  await page.getByRole("alertdialog").getByRole("button", { name: "Unsend" }).click();
  await expect(page.getByText("You unsent a message")).toBeVisible();
});

test("emoji button, photos and files: send, preview, and open large", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  await page.getByLabel("Search emoji").fill("horse");
  await page.getByRole("button", { name: "horse", exact: true }).click();
  await expect(page.getByLabel("Write a message")).toHaveValue("🐎");
  // The panel stays open for more picks (like Messenger); Escape closes it.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Emoji" })).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles([
    { name: "paddock.png", mimeType: "image/png", buffer: PNG },
    { name: "card.csv", mimeType: "", buffer: Buffer.from("Odds,Horse\n3-1,Ridge\n") },
  ]);
  const photo = page.getByRole("button", { name: "Photo: paddock.png. Open larger" });
  await expect(photo).toBeEnabled();
  await expect(page.getByRole("button", { name: /Download card\.csv/ })).toBeVisible();
  const uploads = server.posts.filter((p) => p.path.includes("/attachments?"));
  expect(uploads.map((p) => new URL("http://x" + p.path).searchParams.get("name")).sort()).toEqual(["card.csv", "paddock.png"]);
  expect(server.threads[ANN].messages.find((m) => m.attachment?.name === "card.csv")?.attachment?.type).toBe("text/csv");
  await photo.click();
  await expect(page.getByRole("dialog", { name: "Photo: paddock.png" })).toBeVisible();
});

test("chat list: pin, mute, folders, and day dividers", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[ANN].messages.unshift(msg("Ann Ames", "Yesterday's note", false, 60 * 24 + 30));
  await page.goto(`/messages/${ANN}`);
  await expect(page.getByRole("separator").filter({ hasText: "Yesterday" })).toBeVisible();
  await expect(page.getByRole("separator").filter({ hasText: "Today" })).toBeVisible();

  const item = page.locator(".mx-item-wrap", { hasText: "Saturday syndicate" });
  await item.hover();
  await item.getByRole("button", { name: "Options for Saturday syndicate" }).click();
  await page.getByRole("menuitem", { name: "Pin chat" }).click();
  await expect(page.locator(".mx-list-label", { hasText: "Pinned" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Saturday syndicate.*pinned/ })).toBeVisible();

  await item.hover();
  await item.getByRole("button", { name: "Options for Saturday syndicate" }).click();
  await page.getByRole("menuitem", { name: "Mute" }).click();
  await expect(page.getByRole("link", { name: /Saturday syndicate.*muted/ })).toBeVisible();

  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Trainers");
  await page.getByRole("button", { name: "Create folder" }).click();
  const annItem = page.locator(".mx-item-wrap", { hasText: "Ann Ames" });
  await annItem.hover();
  await annItem.getByRole("button", { name: "Options for Ann Ames" }).click();
  await page.getByRole("menuitemradio", { name: "Trainers" }).click();
  await page.locator(".mx-filters").getByRole("button", { name: "Trainers" }).click();
  await expect(page.locator(".mx-side .mx-items").getByRole("link")).toHaveCount(1);
  await expect(page.locator(".mx-side .mx-items").getByRole("link", { name: /Ann Ames/ })).toBeVisible();
  expect(server.posts.filter((p) => p.path.endsWith("/settings")).map((p) => p.body)).toEqual([
    { pinned: true },
    { muted: true },
    { folder: "f0000000-0000-4000-8000-000000000001" },
  ]);
});

test("Seen, typing, live updates, read receipts, and the info panel", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  await expect(page.locator(".mx-status").filter({ hasText: "Seen" })).toBeVisible();
  const listCalls = server.listCalls;
  await page.getByRole("link", { name: /Saturday syndicate/ }).click();
  await expect(page.locator(".mx-thread-head")).toContainText("You, Bo Burke, Cy Cole");
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await expect(page.getByText("Gallops at six?")).toBeVisible();
  expect(server.listCalls).toBe(listCalls);

  server.typing = ["Ann Ames"];
  await expect(page.locator(".mx-thread-title p")).toHaveText("typing…", { timeout: 10_000 });
  await expect(page.locator(".mx-typing")).toBeVisible();
  server.typing = [];
  server.incoming.push(msg("Ann Ames", "Track is fast today", false, 0));
  await expect(page.getByText("Track is fast today")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => server.posts.some((p) => p.path === `/api/messages/${ANN}/read`)).toBe(true);

  await page.getByRole("button", { name: "Chat info" }).click();
  const info = page.getByRole("complementary", { name: "Chat info" });
  await expect(info.getByRole("heading", { name: "Ann Ames" })).toBeVisible();
  await info.getByText("Privacy & support").click();
  await info.getByRole("button", { name: "Block Ann Ames" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Block" }).click();
  await expect(page.getByText("You blocked Ann Ames.")).toBeVisible();
  await expect(page.getByLabel("Write a message")).toHaveCount(0);
});

test("phones: full-screen chat with Back; no sideways scrolling at any width or theme", async ({ page }) => {
  await fakeServer(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/messages");
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  const pane = page.locator(".mx-thread-pane");
  await expect(pane).toBeVisible();
  await expect.poll(async () => (await pane.boundingBox())?.x).toBe(0);
  expect((await pane.boundingBox())!.width).toBe(375);
  await page.getByRole("button", { name: "Back to chats" }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(pane).toBeHidden();

  for (const width of [320, 375, 768, 1024, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/messages/${ANN}`);
    await expect(page.getByText("Gallops at six?")).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${theme}`).toBe(true);
    }
  }
});

test("removing a friend asks first", async ({ page }) => {
  const server = await fakeServer(page);
  server.friends.friends.push({ id: "a0000000-0000-4000-8000-00000000000a", name: "Ann Ames", role: "trainer", status: "friends" });
  await page.goto("/messages");
  await page.getByRole("tab", { name: "People" }).click();
  await page.getByRole("button", { name: "Remove Ann Ames as a friend" }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText("Remove Ann Ames as a friend?");
  await ask.getByRole("button", { name: "Remove friend" }).click();
  await expect.poll(() => server.posts.some((p) => p.path.endsWith("/friends/a0000000-0000-4000-8000-00000000000a/remove"))).toBe(true);
});
