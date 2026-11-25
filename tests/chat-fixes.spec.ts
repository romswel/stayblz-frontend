import { expect, test, type Page } from "@playwright/test";
import { ANN, GRP, PNG, fakeServer, msg } from "./messenger-fixture";

// Stayblz Chat fixes (2026-11-24): opening a chat lands on the newest message; dropped / pasted / picked files wait in
// the box until Send; formatting preview + symbols that stay as typed; the unread highlight and badge clear at once;
// Back goes to the chat list in one step on phones.

const box = (page: Page) => page.getByLabel("Write a message");
const row = (page: Page, text: string) => page.locator(".mx-row", { hasText: text }).last();
const distanceFromBottom = (page: Page) => page.locator(".mx-scroll").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
const uploads = (server: Awaited<ReturnType<typeof fakeServer>>) => server.posts.filter((p) => p.path.includes("/attachments?"));

async function dropFiles(page: Page, files: { name: string; type: string; size?: number; base64?: string }[]) {
  await page.evaluate((list) => {
    const data = new DataTransfer();
    for (const f of list) {
      const bytes = f.base64 ? Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0)) : new Uint8Array(f.size ?? 68);
      data.items.add(new File([bytes], f.name, { type: f.type }));
    }
    const target = document.querySelector(".mx-thread")!;
    target.dispatchEvent(new DragEvent("dragover", { dataTransfer: data, bubbles: true, cancelable: true }));
    target.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
  }, files);
}

test("switching chats lands on the newest message, even when the other person wrote it last", async ({ page }) => {
  const server = await fakeServer(page);
  const long = (who: string, count: number) =>
    Array.from({ length: count }, (_, i) => msg(i % 2 ? who : "", `${who} line ${i}`, i % 2 === 0, count - i + 5));
  server.threads[ANN].messages = [...long("Ann Ames", 40), msg("Ann Ames", "Ann's newest", false, 1)];
  server.threads[GRP].messages = [...long("Bo Burke", 40), msg("Bo Burke", "Bo's newest", false, 2)];
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/messages/${ANN}`);
  await expect(page.getByText("Ann's newest")).toBeVisible();
  await expect.poll(() => distanceFromBottom(page)).toBeLessThan(4);

  await page.getByRole("link", { name: /Saturday syndicate/ }).click();
  await expect(page.getByText("Bo's newest")).toBeInViewport();
  await expect.poll(() => distanceFromBottom(page)).toBeLessThan(4);
  // The chat's own messages aren't "new while you were scrolled up".
  await expect(page.locator(".mx-jump")).toHaveCount(0);

  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await expect(page.getByText("Ann's newest")).toBeInViewport();
  await expect.poll(() => distanceFromBottom(page)).toBeLessThan(4);
  await expect(page.locator(".mx-jump")).toHaveCount(0);
});

test("dragged-in, pasted and picked files wait in the box with a preview; nothing is sent until Send", async ({ page }) => {
  const server = await fakeServer(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/messages/${ANN}`);
  await expect(box(page)).toBeVisible();

  await dropFiles(page, [{ name: "gallop.png", type: "image/png", base64: PNG.toString("base64") }]);
  const waiting = page.locator(".mx-staged");
  const ready = (n: number) => page.getByRole("group", { name: `${n} ${n === 1 ? "file" : "files"} ready to send` });
  await expect(ready(1)).toBeVisible();
  await expect(waiting.locator("img")).toHaveCount(1);
  // Pasting a file adds it too.
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["Odds,Horse\n"], "card.csv", { type: "text/csv" }));
    document.querySelector("textarea")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(ready(2)).toBeVisible();
  // A file that can't be sent is said at once, and never waits in the box.
  await dropFiles(page, [{ name: "clip.mov", type: "video/quicktime", size: 4 * 1024 * 1024 + 10 }]);
  await expect(page.getByRole("alert")).toContainText("“clip.mov” is over 4 MB");
  await expect(ready(2)).toBeVisible();
  // × takes one out.
  await waiting.getByRole("button", { name: "Remove card.csv" }).click();
  await expect(ready(1)).toBeVisible();

  await page.waitForTimeout(600);
  expect(uploads(server)).toHaveLength(0); // still nothing sent

  // Send sends the words, then the file.
  await box(page).fill("From this morning");
  await page.keyboard.press("Enter");
  await expect(waiting).toHaveCount(0);
  await expect.poll(() => uploads(server).length).toBe(1);
  const order = () => server.threads[ANN].messages.map((m) => m.attachment?.name ?? m.body).slice(-2);
  await expect.poll(order).toEqual(["From this morning", "gallop.png"]);
  expect(new URL("http://x" + uploads(server)[0].path).searchParams.get("name")).toBe("gallop.png");
  await expect(page.getByRole("button", { name: "Photo: gallop.png. Open larger" })).toBeVisible();

  // Files only (no words): Send still sends them; the mic comes back once the box is empty.
  await page.locator('input[type="file"]').first().setInputFiles([{ name: "paddock.png", mimeType: "image/png", buffer: PNG }]);
  await expect(page.getByRole("button", { name: "Record a voice clip" })).toHaveCount(0);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => uploads(server).length).toBe(2);
});

test("formatting: a preview while typing and editing; symbols that aren't formatting stay as typed", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  const preview = page.locator(".mx-format-preview");

  await box(page).fill("plain words");
  await expect(preview).toHaveCount(0);
  await box(page).fill("**Ridge** is _fast_");
  await expect(preview.locator("strong")).toHaveText("Ridge");
  await expect(preview.locator("em")).toHaveText("fast");
  await page.keyboard.press("Enter");
  await expect(preview).toHaveCount(0);
  await expect(row(page, "Ridge").locator("strong")).toHaveText("Ridge");

  // Plain symbols are never eaten or left blank.
  for (const text of ["****", "```", ">", "2*3*4"]) {
    await box(page).fill(text);
    await expect(preview).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect.poll(() => server.threads[ANN].messages.at(-1)?.body).toBe(text);
    await expect(page.locator(".mx-row.is-mine .mx-text").last()).toHaveText(text);
  }
  // A phone keyboard's space after a suggested word still makes it bold.
  await box(page).fill("**gallops **");
  await page.keyboard.press("Enter");
  await expect(row(page, "gallops").locator("strong")).toHaveText("gallops");

  // Editing: the banner reads as plain words; the preview shows the formatting.
  const target = row(page, "Ridge");
  await target.hover();
  await target.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.locator(".mx-replying.is-editing .mx-replying-text")).toHaveText("Ridge is fast");
  await expect(preview.locator("strong")).toHaveText("Ridge");
  await page.getByRole("button", { name: "Cancel editing" }).click();

  // Ctrl+B on a selection that took the space after the word keeps the space outside the marks.
  await box(page).fill("go now ");
  await box(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 7));
  await page.keyboard.press("Control+b");
  await expect(box(page)).toHaveValue("go **now** ");

  // Replying quotes the plain words.
  await box(page).fill("");
  await row(page, "Ridge").hover();
  await row(page, "Ridge").getByRole("button", { name: "Reply" }).click();
  await expect(page.locator(".mx-replying .mx-replying-text")).toHaveText("Ridge is fast");
});

test("opening an unread chat clears its highlight and the menu badge at once, before the chat has even loaded", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[GRP].unread = true;
  const counts = { personal: 1, requests: 0, team: 0 };
  const unreadAsked: string[] = [];
  // A newer server: the badge poll waits on the server (long-poll) while nothing changes.
  await page.route("**/api/messages/unread**", async (route) => {
    const url = new URL(route.request().url());
    unreadAsked.push(url.search);
    if (url.searchParams.get("wait")) await new Promise((r) => setTimeout(r, 10_000));
    await route.fulfill({ json: { ...counts, alerts: [], alertsUnread: 0, now: new Date().toISOString(), uv: 1 } }).catch(() => undefined);
  });
  await page.route(`**/api/messages/${GRP}/read`, async (route) => {
    counts.personal = 0;
    server.threads[GRP].unread = false;
    await route.fallback();
  });
  // A slow server: the chat itself takes a while to load.
  await page.route(`**/api/messages/${GRP}`, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.fallback();
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/messages");
  const item = page.locator(".mx-item", { hasText: "Saturday syndicate" });
  await expect(item).toHaveClass(/is-unread/);
  await expect(page.getByRole("link", { name: "Stayblz Chat (1 unread)" })).toBeVisible();

  await item.click();
  await expect(item).not.toHaveClass(/is-unread/, { timeout: 1500 });
  await expect(page.getByRole("link", { name: "Stayblz Chat (1 unread)" })).toHaveCount(0, { timeout: 1500 });
  // The server hears about it once the chat has loaded (so the chat can open at the first unread message).
  await expect(page.getByText("Who's driving?")).toBeVisible({ timeout: 6000 });
  await expect.poll(() => server.posts.some((p) => p.path === `/api/messages/${GRP}/read`), { timeout: 3000 }).toBe(true);
  // After the read, the badge asks for the real numbers straight away (not a 15-second wait).
  await expect.poll(() => unreadAsked.filter((q) => !q.includes("wait=")).length, { timeout: 3000 }).toBeGreaterThan(1);
  // Loading the chat (with the list refreshing) never brought the highlight or the badge back.
  await expect(item).not.toHaveClass(/is-unread/);
  await expect(page.getByRole("link", { name: "Stayblz Chat (1 unread)" })).toHaveCount(0);
});

test("phones: Back goes to the chat list in one step, however many chats were opened from inside chats", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[GRP].messages.push(msg("Bo Burke", "Ask Ann: http://127.0.0.1:5178/messages/" + ANN, false, 1));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/messages");
  const pane = page.locator(".mx-thread-pane");

  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await expect(pane).toBeVisible();
  // A notification opens another chat while you're in one.
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent("stayblz:open", { detail: `/messages/${id}` })), GRP);
  await expect(page.locator(".mx-thread-head")).toContainText("Saturday syndicate");
  // A link inside a message opens a third.
  await page.getByRole("link", { name: `http://127.0.0.1:5178/messages/${ANN}` }).click();
  await expect(page.locator(".mx-thread-head")).toContainText("Ann Ames");

  await page.getByRole("button", { name: "Back to chats" }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(pane).toBeHidden();

  // The phone's own back gesture: a chat opened from a notification replaced the one before it.
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent("stayblz:open", { detail: `/messages/${id}` })), GRP);
  await expect(page.locator(".mx-thread-head")).toContainText("Saturday syndicate");
  await page.goBack();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(pane).toBeHidden();
});

test("opening a chat with unread messages starts at the first one you haven't read; a read chat starts at the newest", async ({ page }) => {
  const server = await fakeServer(page);
  const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const older = Array.from({ length: 40 }, (_, i) => msg(i % 2 ? "Ann Ames" : "", `Read line ${i}`, i % 2 === 0, 300 - i));
  const unread = Array.from({ length: 25 }, (_, i) => msg("Ann Ames", `Unread line ${i}`, false, 30 - i));
  Object.assign(server.threads[ANN], { messages: [...older, ...unread], unread: true, readAt: ago(100) });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/messages/${ANN}`);
  const line = page.locator(".mx-unread-line");
  await expect(line).toHaveText("Unread messages");
  await expect(line).toBeInViewport();
  await expect(page.getByText("Unread line 0", { exact: true })).toBeInViewport();
  await expect(page.getByText("Unread line 24", { exact: true })).not.toBeInViewport();
  // The way down is one tap away.
  await expect(page.locator(".mx-jump")).toBeVisible();

  // Already read: no line, straight to the newest message.
  Object.assign(server.threads[GRP], {
    messages: Array.from({ length: 40 }, (_, i) => msg("Bo Burke", `Group line ${i}`, false, 60 - i)),
    unread: false,
    readAt: ago(0),
  });
  await page.getByRole("link", { name: /Saturday syndicate/ }).click();
  await expect(page.getByText("Group line 39", { exact: true })).toBeInViewport();
  await expect(page.locator(".mx-unread-line")).toHaveCount(0);
});

test("the chat list shows reactions: yours at once, and other people's from the server", async ({ page }) => {
  const server = await fakeServer(page);
  // Ann reacted to your message after it was sent.
  Object.assign(server.threads[GRP], {
    lastReaction: { emoji: "👍", mine: false, byName: "Bo Burke", toMe: true, message: null, body: "x", at: new Date().toISOString() },
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/messages/${ANN}`);
  const group = page.locator(".mx-item", { hasText: "Saturday syndicate" }).locator(".mx-item-preview");
  await expect(group).toHaveText("Bo reacted 👍 to your message");
  // Reacting in the open chat shows in its row straight away.
  const target = page.locator(".mx-row", { hasText: "Gallops at six?" }).last();
  await target.hover();
  await target.getByRole("button", { name: "React" }).click();
  await page.getByRole("button", { name: "React ❤️" }).click();
  const ann = page.locator(".mx-item", { hasText: "Ann Ames" }).locator(".mx-item-preview");
  await expect(ann).toHaveText("You reacted ❤️ to “Gallops at six?”");
  // A newer message takes its place.
  await box(page).fill("See you there");
  await page.keyboard.press("Enter");
  await expect(ann).toHaveText("You: See you there");
});

test("files waiting in the box stay with their chat when you switch chats and come back", async ({ page }) => {
  const server = await fakeServer(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/messages/${ANN}`);
  await expect(box(page)).toBeVisible();
  await dropFiles(page, [{ name: "gallop.png", type: "image/png", base64: PNG.toString("base64") }]);
  await expect(page.getByRole("group", { name: "1 file ready to send" })).toBeVisible();
  await page.getByRole("link", { name: /Saturday syndicate/ }).click();
  await expect(page.locator(".mx-thread-head")).toContainText("Saturday syndicate");
  await expect(page.locator(".mx-staged")).toHaveCount(0); // another chat's files aren't shown here
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await expect(page.getByRole("group", { name: "1 file ready to send" })).toBeVisible();
  expect(uploads(server)).toHaveLength(0);
});

test("phones: Back after coming back from another page still goes to the list, without a second copy of it", async ({ page }) => {
  await fakeServer(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/messages");
  const idx = () => page.evaluate(() => (history.state as { idx?: number } | null)?.idx);
  const listIdx = await idx();
  await page.getByRole("link", { name: /Ann Ames/ }).click();
  await expect(page.locator(".mx-thread-pane")).toBeVisible();
  // Off to another page, then the browser's Back to the chat (Chat opens afresh).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("stayblz:open", { detail: "/updates" })));
  await expect(page).toHaveURL(/\/updates$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/messages/${ANN}$`));
  await page.getByRole("button", { name: "Back to chats" }).click();
  await expect(page).toHaveURL(/\/messages$/);
  expect(await idx()).toBe(listIdx);
});
