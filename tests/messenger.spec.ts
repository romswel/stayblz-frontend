import { test, expect } from "@playwright/test";
import { ANN, NEW, REQ, chat, fakeServer, msg } from "./messenger-fixture";

test("the free-plan notice is honest and remembered; the menu shows unread chats", async ({ page }) => {
  await fakeServer(page, { personal: 2, requests: 1, team: 0 });
  await page.goto("/messages");
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Messages (3 unread)" })).toBeVisible();
  await expect(page.getByText("Chat runs on a free database plan.")).toBeVisible();
  await page.getByRole("button", { name: "What this means" }).click();
  const about = page.getByRole("dialog", { name: "About chat storage" });
  await expect(about.getByText("Messages can go missing.")).toBeVisible();
  await expect(about.getByText("Text only.")).toBeVisible();
  await about.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Dismiss notice" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
  await expect(page.getByText("Chat runs on a free database plan.")).toHaveCount(0);
  // Still one tap away.
  await page.getByRole("button", { name: "Free plan" }).click();
  await expect(page.getByRole("dialog", { name: "About chat storage" })).toBeVisible();
});

test("start a chat by email; an unknown email offers a group instead", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto("/messages");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "New chat" });
  await dialog.getByLabel("To").fill("nobody@example.test");
  await dialog.getByRole("button", { name: "Start chat" }).click();
  await expect(dialog.getByText("No Stayblz account uses that email.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Start a group with an invite link instead" })).toBeVisible();
  await dialog.getByLabel("To").fill("friend@example.test");
  await dialog.getByRole("button", { name: "Start chat" }).click();
  await expect(page).toHaveURL(new RegExp(`/messages/${NEW}$`));
  await expect(page.locator(".mx-thread-head")).toContainText("Waiting for them to accept your request");
  await expect(page.getByRole("link", { name: /Friend Person/ })).toBeVisible();
  const starts = server.posts.filter((p) => p.path === "/api/messages/direct");
  expect(starts.at(-1)?.body).toEqual({ email: "friend@example.test" });
});

test("message requests can be read first, then accepted before replying", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[REQ] = chat(REQ, "Sam Stable", [msg("Sam Stable", "Is your filly for sale?", false, 3)], {
    request: true,
  });
  await page.goto("/messages");
  // Requests are kept apart from your chats.
  await expect(page.getByRole("link", { name: /Sam Stable/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Requests/ }).click();
  await page.getByRole("link", { name: /Sam Stable, message request/ }).click();
  await expect(page.getByText("Is your filly for sale?")).toBeVisible();
  await expect(page.getByText(/wants to message you/)).toBeVisible();
  await expect(page.getByLabel("Write a message")).toHaveCount(0);
  expect(server.posts.some((p) => p.path.endsWith("/read"))).toBe(false);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByLabel("Write a message")).toBeVisible();
  expect(server.posts.some((p) => p.path === `/api/messages/${REQ}/accept`)).toBe(true);
});

test("react, reply and unsend from the message itself", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  const theirs = page.locator(".mx-row", { hasText: "Gallops at six?" });
  await theirs.hover();
  await theirs.getByRole("button", { name: "React" }).click();
  await theirs.getByRole("button", { name: "React ❤️" }).click();
  await expect(theirs.getByRole("button", { name: "❤️ 1, including you" })).toBeVisible();
  expect(server.posts.find((p) => p.path.endsWith("/react"))?.body).toEqual({ emoji: "❤️" });

  await theirs.hover();
  await theirs.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText("Replying to")).toBeVisible();
  await page.getByLabel("Write a message").fill("See you at the barn");
  await page.keyboard.press("Enter");
  const reply = page.locator(".mx-row", { hasText: "See you at the barn" });
  await expect(reply.locator(".mx-quote")).toContainText("Gallops at six?");
  const sent = server.posts.find((p) => p.path === `/api/messages/${ANN}/messages`)!.body;
  expect(sent.replyTo).toBe(server.threads[ANN].messages[0].id);
  await expect(page.getByLabel("Write a message")).toHaveValue("");

  const mine = page.locator(".mx-row", { hasText: "I'll be there" });
  await mine.hover();
  await mine.getByRole("button", { name: "Unsend" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Unsend" }).click();
  await expect(page.getByText("You unsent a message")).toBeVisible();
});

test("new messages arrive while a chat is open; Seen shows; switching chats doesn't reload the list", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  await expect(page.locator(".mx-seen")).toHaveText("Seen");
  // (Dev mode runs effects twice, so compare before/after rather than expecting exactly 1.)
  const listCalls = server.listCalls;
  await page.getByRole("link", { name: /Saturday syndicate/ }).click();
  await expect(page.locator(".mx-thread-head")).toContainText("You, Bo Burke, Cy Cole");
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await expect(page.getByText("Gallops at six?")).toBeVisible();
  expect(server.listCalls).toBe(listCalls);

  server.incoming.push(msg("Ann Ames", "Track is fast today", false, 0));
  await expect(page.getByText("Track is fast today")).toBeVisible({ timeout: 10_000 });
  // Reading it sends a read receipt.
  await expect.poll(() => server.posts.some((p) => p.path === `/api/messages/${ANN}/read`)).toBe(true);
});

test("phones open the chat full screen with Back; no sideways scrolling at any width or theme", async ({ page }) => {
  await fakeServer(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/messages");
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  const pane = page.locator(".mx-thread-pane");
  await expect(pane).toBeVisible();
  // After the short slide-in, it covers the whole screen.
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
