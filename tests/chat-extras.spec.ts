import { expect, test, type Page } from "@playwright/test";
import { ANN, GRP, PNG, fakeServer, msg } from "./messenger-fixture";

// Stayblz Chat additions (2026-11-20): formatting, formatted paste, commands, @everyone / @highlight, GIFs, the media
// viewer (prev / next / zoom), Online / Away / Offline, People contacts, the long-poll, and the phone keyboard rules.

const box = (page: Page) => page.getByLabel("Write a message");
const row = (page: Page, text: string) => page.locator(".mx-row", { hasText: text }).last();
const lastSent = (server: Awaited<ReturnType<typeof fakeServer>>, id = ANN) => server.threads[id].messages.at(-1)!;

test("formatting: bold, italic, strike, code, quotes, lists and tap-to-show spoilers", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[ANN].messages.push(
    msg("Ann Ames", "**Ridge** won by _a length_, ~~Bolt~~ `3-1` and ||Storm|| second\n> trainer says\n- dry track\n- good draw", false, 1),
  );
  await page.goto(`/messages/${ANN}`);
  const r = row(page, "won by");
  await expect(r.locator("strong", { hasText: "Ridge" })).toBeVisible();
  await expect(r.locator("em", { hasText: "a length" })).toBeVisible();
  await expect(r.locator("s", { hasText: "Bolt" })).toBeVisible();
  await expect(r.locator("code", { hasText: "3-1" })).toBeVisible();
  await expect(r.locator("blockquote", { hasText: "trainer says" })).toBeVisible();
  await expect(r.locator("ul li")).toHaveText(["dry track", "good draw"]);
  // No raw marks left; snake_case and links are left alone elsewhere.
  await expect(r).not.toContainText("**");
  const spoiler = r.getByRole("button", { name: "Spoiler: tap to show" });
  await spoiler.click();
  await expect(r.locator(".mx-spoiler.is-shown")).toHaveText("Storm");
  // The chat list preview reads as plain words.
  await page.goto("/messages");
  await expect(page.locator(".mx-item", { hasText: "Ann Ames" }).locator(".mx-item-preview")).not.toContainText("**");
});

test("pasting formatted text from a website keeps bold, italic, lists and paragraph breaks", async ({ page }) => {
  await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  await box(page).click();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/html", "<p><b>Gallops</b> at <i>six</i></p><p>Bring:</p><ul><li>Saddle</li><li>Boots</li></ul>");
    data.setData("text/plain", "Gallops at six\n\nBring:\n\nSaddle\nBoots");
    document.querySelector("textarea")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(box(page)).toHaveValue("**Gallops** at _six_\n\nBring:\n\n- Saddle\n- Boots");
  // Google Docs wraps everything in a "not bold" <b>: that isn't bold.
  await box(page).fill("");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/html", '<b style="font-weight:normal" id="docs-internal-guid-1"><span>Plain words</span></b>');
    data.setData("text/plain", "Plain words");
    document.querySelector("textarea")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(box(page)).toHaveValue("");
});

test("commands: / lists them; /shrug, /mute 1h, /search, an unknown one, and /help", async ({ page }) => {
  const server = await fakeServer(page);
  await page.goto(`/messages/${ANN}`);
  await box(page).fill("/");
  const list = page.getByRole("listbox", { name: "Commands" });
  await expect(list.getByRole("option", { name: /\/shrug/ })).toBeVisible();
  await expect(list.getByRole("option", { name: /\/everyone/ })).toHaveCount(0); // groups only
  await box(page).fill("/shr");
  await page.keyboard.press("Enter");
  await expect(box(page)).toHaveValue("/shrug ");
  await box(page).pressSequentially("no idea");
  await page.keyboard.press("Enter");
  await expect.poll(() => lastSent(server).body).toBe("no idea ¯\\_(ツ)_/¯");
  await expect(box(page)).toHaveValue("");

  await box(page).fill("/mute 1h");
  await page.keyboard.press("Enter");
  await expect.poll(() => server.posts.find((p) => p.path.endsWith("/settings"))?.body).toEqual({ muteMinutes: 60 });

  await box(page).fill("/search gallops");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Search in this chat")).toHaveValue("gallops");
  await page.getByRole("button", { name: "Close search" }).click();

  await box(page).fill("/nope");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("There's no /nope command");
  await expect(box(page)).toHaveValue("/nope"); // kept, nothing sent

  await box(page).fill("/help");
  await page.keyboard.press("Enter");
  const help = page.getByRole("dialog", { name: "Chat commands and formatting" });
  await expect(help.getByText("/paddock")).toBeVisible();
  await expect(help.getByText("Ctrl/⌘ + B")).toBeVisible();
});

test("@everyone and @highlight: suggested while typing; a highlighted message stands out", async ({ page }) => {
  const server = await fakeServer(page);
  server.threads[GRP].messages.push(msg("Bo Burke", "@highlight Race moved to Sunday", false, 1));
  await page.goto(`/messages/${GRP}`);
  const highlighted = page.locator(".mx-row.is-highlight");
  await expect(highlighted).toContainText("Race moved to Sunday");
  await expect(highlighted.locator(".mx-highlight-tag")).toHaveText("Highlight");
  await expect(highlighted).not.toContainText("@highlight");

  await box(page).fill("@ev");
  await page.getByRole("option", { name: /@everyone/ }).click();
  await expect(box(page)).toHaveValue("@everyone ");
  await box(page).pressSequentially("vet at noon");
  await page.keyboard.press("Enter");
  await expect.poll(() => lastSent(server, GRP).body).toBe("@everyone vet at noon");
  await expect(row(page, "vet at noon").locator(".mx-mention")).toHaveText("@everyone");

  // One-to-one chats offer @highlight, not @everyone.
  await page.goto(`/messages/${ANN}`);
  await box(page).fill("@");
  await expect(page.getByRole("option", { name: /@highlight/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /@everyone/ })).toHaveCount(0);
});

test("GIFs: search through our server, send one, and it shows as a moving picture", async ({ page }) => {
  const server = await fakeServer(page);
  const gifUrl = "https://media1.giphy.com/media/g1/giphy.gif";
  await page.route("**/api/gifs**", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        next: null,
        results: [{ id: "g1", title: "Horse run", url: gifUrl, preview: "https://media1.giphy.com/media/g1/100.webp", width: 320, height: 180 }],
      },
    }),
  );
  await page.route("https://*.giphy.com/**", (route) => route.fulfill({ body: PNG, headers: { "Content-Type": "image/png" } }));
  await page.goto(`/messages/${ANN}`);
  await page.getByRole("button", { name: /^Attach/ }).click();
  await page.getByRole("menuitem", { name: "GIF" }).click();
  const picker = page.getByRole("dialog", { name: "GIFs" });
  await expect(picker.getByText("Powered by GIPHY")).toBeVisible();
  await picker.getByRole("button", { name: "Send GIF: Horse run" }).click();
  await expect.poll(() => lastSent(server).body).toBe(gifUrl);
  await expect(page.locator(".mx-gif img").last()).toHaveAttribute("src", gifUrl);
});

test("GIF search stays hidden while the server has no GIPHY key", async ({ page }) => {
  await fakeServer(page);
  await page.route("**/api/gifs**", (route) => route.fulfill({ json: { enabled: false, results: [], next: null } }));
  await page.goto(`/messages/${ANN}`);
  await page.getByRole("button", { name: /^Attach/ }).click();
  await expect(page.getByRole("menuitem", { name: "Photos or videos" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "GIF" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Start a Paddock" })).toBeVisible();
});

test("media viewer: previous / next through the chat's photos, zoom with buttons and keys, drag when zoomed", async ({ page }) => {
  const server = await fakeServer(page);
  const photo = (name: string, minutes: number) =>
    msg("Ann Ames", "", false, minutes, { attachment: { name, size: 70, type: "image/png", width: 400, height: 300 } });
  server.threads[ANN].messages.push(photo("first.png", 3), photo("second.png", 2));
  // A real-sized picture (the shared fixture's file is 1×1, too small to have anything to drag around).
  const big = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#3a7"/></svg>`;
  await page.route(`**/api/messages/${ANN}/files/**`, (route) => route.fulfill({ body: big, headers: { "Content-Type": "image/svg+xml" } }));
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`/messages/${ANN}`);
  await page.getByRole("button", { name: "Photo: first.png. Open larger" }).click();
  let viewer = page.getByRole("dialog", { name: /^Photo 1 of 2/ });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Previous" })).toBeDisabled();
  await viewer.getByRole("button", { name: "Next" }).click();
  viewer = page.getByRole("dialog", { name: /^Photo 2 of 2/ });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  viewer = page.getByRole("dialog", { name: /^Photo 1 of 2/ });
  await expect(viewer).toBeVisible();

  await viewer.getByRole("button", { name: "Zoom in" }).click();
  await expect(viewer.locator(".mx-viewer-pct")).toHaveText("150%");
  await page.keyboard.press("+");
  await expect(viewer.locator(".mx-viewer-pct")).not.toHaveText("150%");
  const img = viewer.locator("img.mx-viewer-media");
  const before = await img.evaluate((el) => (el as HTMLElement).style.transform);
  const stage = viewer.locator(".mx-viewer-stage");
  const b = (await stage.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => img.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  await page.keyboard.press("0");
  await expect(viewer.locator(".mx-viewer-pct")).toHaveText("100%");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
});

test("presence: Online, Away and Offline dots and words, steady across updates", async ({ page }) => {
  const server = await fakeServer(page);
  Object.assign(server.threads[ANN], { presence: "away", active: false });
  server.threads[ANN].members[1] = { ...server.threads[ANN].members[1], presence: "away" } as never;
  Object.assign(server.threads[GRP], { presence: null });
  await page.goto(`/messages/${ANN}`);
  await expect(page.locator(".mx-thread-sub")).toHaveText(/^Away/);
  const item = page.locator(".mx-item", { hasText: "Ann Ames" });
  await expect(item.locator(".mx-av-dot.is-away")).toBeVisible();
  // The open chat's updates must not wipe the list's dot (the old blink).
  await page.waitForTimeout(4500);
  await expect(item.locator(".mx-av-dot.is-away")).toBeVisible();

  server.threads[ANN].members[1] = { ...server.threads[ANN].members[1], presence: "offline", seenAt: new Date(Date.now() - 5 * 60_000).toISOString() } as never;
  await page.reload();
  await expect(page.locator(".mx-thread-sub")).toHaveText(/Offline · active 5m ago/);
  await expect(page.locator(".mx-thread-head .mx-av-dot.is-offline")).toBeVisible();
});

test("People: friends first, then everyone you share a chat with, with presence; Add people opens search", async ({ page }) => {
  const server = await fakeServer(page);
  server.friends.friends = [{ id: "f1", name: "Fay Field", status: "friends" }];
  await page.route("**/api/messages/people/contacts**", (route) =>
    route.fulfill({
      json: {
        people: [
          { id: "f1", name: "Fay Field", status: "friends", presence: "online", sharedChats: 1 },
          { id: "bo", name: "Bo Burke", status: "none", presence: "offline", seenAt: new Date(Date.now() - 2 * 3600_000).toISOString(), sharedChats: 1 },
        ],
      },
    }),
  );
  await page.goto("/messages?people=1");
  const people = page.locator(".mx-people");
  await expect(people.getByText("Friends (1)")).toBeVisible();
  await expect(people.getByText("People in your chats (1)")).toBeVisible();
  await expect(people.getByText("1 online now")).toBeVisible();
  const bo = people.locator(".mx-person", { hasText: "Bo Burke" });
  await expect(bo).toContainText("Offline · active 2h ago");
  await expect(bo.getByRole("button", { name: "Add Bo Burke as a friend" })).toBeVisible();
  await expect(people.locator(".mx-person", { hasText: "Fay Field" }).locator(".mx-av-dot.is-online")).toBeVisible();
  await people.getByRole("button", { name: /Add people/ }).click();
  await expect(people.getByLabel("Find people by name")).toBeFocused();
});

test("live: once the server sends a version, the open chat waits on it (long-poll) instead of re-asking", async ({ page }) => {
  const server = await fakeServer(page);
  const asked: string[] = [];
  let v = 7;
  await page.route(`**/api/messages/${ANN}/updates**`, async (route) => {
    asked.push(route.request().url());
    const changed = server.incoming.splice(0);
    server.threads[ANN].messages.push(...changed);
    await route.fulfill({ json: { conversation: { ...server.threads[ANN], messages: changed }, before: null, now: new Date().toISOString(), v: v++ } });
  });
  await page.route(`**/api/messages/${ANN}`, (route) =>
    route.fulfill({ json: { conversation: server.threads[ANN], before: null, now: new Date().toISOString(), v: 6 } }),
  );
  await page.goto(`/messages/${ANN}`);
  await expect.poll(() => asked.length).toBeGreaterThan(1);
  const first = new URL(asked[0]);
  expect(first.searchParams.get("v")).toBe("6");
  expect(first.searchParams.get("wait")).toBe("15");
  expect(first.searchParams.get("presence")).toMatch(/^(active|idle)$/);
  server.incoming.push(msg("Ann Ames", "On my way", false, 0));
  await expect(page.getByText("On my way")).toBeVisible();
  // A held request is never reported as a slow connection.
  await expect(page.getByText("Still working…")).toHaveCount(0);
});

test("phones: the chat follows the visible area above the keyboard; the tab bar steps aside while typing", async ({ page }) => {
  await fakeServer(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/messages");
  const tabbar = page.locator(".gx-tabbar");
  await expect(tabbar).toBeVisible();
  // What src/viewport.ts sets when the iPhone keyboard is up: a shorter visible area.
  await page.evaluate(() => {
    document.documentElement.classList.add("kb-open");
  });
  await expect(tabbar).toBeHidden();
  await page.evaluate(() => document.documentElement.classList.remove("kb-open"));
  await expect(tabbar).toBeVisible();

  await page.goto(`/messages/${ANN}`);
  await expect(page.locator(".mx-composer")).toBeVisible();
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty("--vvh", "420px");
    root.setProperty("--vv-offset", "0px");
  });
  const pane = page.locator(".mx-thread-pane");
  await expect.poll(async () => Math.round((await pane.boundingBox())!.height)).toBe(420);
  // The message box sits at the bottom of that visible area, not behind the keyboard.
  await expect
    .poll(async () => {
      const composer = (await page.locator(".mx-composer").boundingBox())!;
      return Math.round(composer.y + composer.height);
    })
    .toBeLessThanOrEqual(421);

  // Tapping anywhere in the box (not only the words) puts the cursor in it.
  await page.evaluate(() => document.documentElement.style.removeProperty("--vvh"));
  const field = (await page.locator(".mx-compose-field").boundingBox())!;
  await page.mouse.click(field.x + field.width - 60, field.y + field.height - 4);
  await expect(box(page)).toBeFocused();
});
