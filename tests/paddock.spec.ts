import { test, expect, type Browser, type Page } from "@playwright/test";
import { FAKE_MEDIA, HANA, IVY, paddockServer, type FakeUser } from "./paddock-fixture";

// Real calls between pages: Chromium's fake camera/mic, a fake Paddock API shared by every page.
test.use({ launchOptions: FAKE_MEDIA.launchOptions, permissions: FAKE_MEDIA.permissions });
test.describe.configure({ timeout: 90_000 });

type Server = ReturnType<typeof paddockServer>;
async function open(browser: Browser, server: Server, who: FakeUser | null, path: string, viewport = { width: 1280, height: 820 }) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:5178", permissions: FAKE_MEDIA.permissions, viewport });
  const page = await context.newPage();
  await server.attach(page, who);
  await page.goto(path);
  return page;
}
const tile = (page: Page, name: RegExp) => page.getByRole("group", { name });
/** Frames from the other browser are arriving in this tile. */
async function expectVideo(page: Page, name: RegExp) {
  await expect
    .poll(async () => tile(page, name).locator("video").first().evaluate((v: HTMLVideoElement) => v.videoWidth).catch(() => 0), {
      timeout: 25_000,
      message: `video from ${name}`,
    })
    .toBeGreaterThan(0);
}
async function joinNow(page: Page) {
  await expect(page.getByText("Ready to join?")).toBeVisible();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("region", { name: /^Call:/ })).toBeVisible();
}

test("start a meeting, check devices, join, browse Stayblz with the mini window, leave", async ({ browser }) => {
  const server = paddockServer();
  const page = await open(browser, server, HANA, "/paddock");
  await expect(page.getByRole("heading", { name: "Stayblz Paddock", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stayblz Paddock" })).toBeVisible(); // sidebar
  await expect(page.getByRole("heading", { name: "No meetings yet" })).toBeVisible();

  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: "Start a meeting now" }).click();
  await expect(page).toHaveURL(/\/paddock\/[a-z]{4}-[a-z]{4}$/);
  await expect(page.getByRole("heading", { name: "Hana's meeting" })).toBeVisible();
  await expect(page.getByText("No one is in the call yet.")).toBeVisible();
  // The camera preview runs before joining; switching the camera off releases it.
  await expect.poll(() => page.locator(".pd-preview video").evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Turn off camera" }).click();
  await expect(page.getByText("Camera is off")).toBeVisible();
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(page.locator(".pd-preview video")).toBeVisible();

  await joinNow(page);
  await expect(page.getByText("You're the only one here")).toBeVisible();
  await expect(tile(page, /^Hana Host \(you\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Turn off microphone/ })).toBeVisible();

  // Keep the call going while browsing.
  await page.getByRole("button", { name: /Browse Stayblz/ }).click();
  await expect(page).toHaveURL(/\/paddock$/);
  const mini = page.getByRole("region", { name: "Call in progress" });
  await expect(mini).toBeVisible();
  await expect(page.getByText("You're in a call right now.")).toBeVisible();
  await mini.getByRole("button", { name: /Return to the call/ }).first().click();
  await expect(page.getByRole("region", { name: /^Call:/ })).toBeVisible();

  await page.getByRole("button", { name: "Leave or end the call" }).click();
  await page.getByRole("menuitem", { name: "Leave the call" }).click();
  await expect(page.getByRole("heading", { name: "You left the call" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Stayblz Paddock" }).click();
  await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hana's meeting" })).toBeVisible();
  await page.context().close();
});

test("two people: video both ways, mute, chat, hands, reactions and host tools", async ({ browser }) => {
  const server = paddockServer();
  const meeting = server.addMeeting({ hostId: HANA.id, hostName: HANA.displayName, title: "Saturday gallops", invitees: [IVY.id] });
  const hana = await open(browser, server, HANA, `/paddock/${meeting.code}`);
  await joinNow(hana);
  const ivy = await open(browser, server, IVY, `/paddock/${meeting.code}`);
  await expect(ivy.getByText(/Hana Host is in the call/)).toBeVisible();
  await joinNow(ivy);

  // Real video in both directions, with sound playing from a hidden audio element.
  await expectVideo(hana, /^Ivy Invitee/);
  await expectVideo(ivy, /^Hana Host(?! \(you\))/);
  await expect.poll(() => hana.locator(".pd-audio audio").count()).toBe(1);

  // Muting shows for the other person.
  await ivy.getByRole("button", { name: /Turn off microphone/ }).click();
  await expect(tile(hana, /^Ivy Invitee, muted/)).toBeVisible();
  await ivy.keyboard.press("Control+d");
  await expect(tile(hana, /^Ivy Invitee(?!, muted)/)).toBeVisible();

  // Chat: a toast for the other person, who opens it.
  await hana.getByRole("button", { name: "Chat", exact: true }).click();
  await hana.getByLabel("Message everyone").fill("Morning, all");
  await hana.keyboard.press("Enter");
  await expect(hana.locator(".pd-msg", { hasText: "Morning, all" })).toBeVisible();
  await ivy.getByRole("button", { name: "Hana Host: Morning, all" }).click();
  await expect(ivy.locator(".pd-chat-list")).toContainText("Morning, all");

  // A raised hand shows in the host's people list; reactions float up.
  await ivy.getByRole("button", { name: /Raise your hand/ }).click();
  await expect(tile(hana, /hand raised/)).toBeVisible();
  await hana.getByRole("tab", { name: /People/ }).click();
  await expect(hana.getByRole("region", { name: "Raised hands" })).toContainText("Ivy Invitee");
  await ivy.getByRole("button", { name: "Send a reaction" }).click();
  await ivy.getByRole("button", { name: "React with 🐎" }).click();
  await expect(hana.locator(".pd-floater-emoji", { hasText: "🐎" })).toBeVisible();

  // Host mutes Ivy: her own browser turns the mic off and says why.
  await hana.getByRole("button", { name: "Options for Ivy Invitee" }).last().click();
  await hana.getByRole("menuitem", { name: "Mute" }).click();
  await expect(ivy.getByText("A host muted your microphone.", { exact: false })).toBeVisible();
  await expect(ivy.getByRole("button", { name: /Turn on microphone/ })).toBeVisible();

  // Ivy leaves: the host is told and sees the "alone" card again.
  await ivy.getByRole("button", { name: "Leave call" }).click();
  await expect(ivy.getByRole("heading", { name: "You left the call" })).toBeVisible();
  await expect(hana.getByText("Ivy Invitee left")).toBeVisible();
  await expect(hana.getByText("You're the only one here")).toBeVisible();
  await ivy.context().close();
  await hana.context().close();
});

test("guests ask to join with a name; the host lets them in, and can remove them", async ({ browser }) => {
  const server = paddockServer();
  const meeting = server.addMeeting({ hostId: HANA.id, hostName: HANA.displayName, title: "Vet check-in" });
  const hana = await open(browser, server, HANA, `/paddock/${meeting.code}`);
  await joinNow(hana);

  const guest = await open(browser, server, null, `/paddock/${meeting.code}`);
  await expect(guest.getByRole("heading", { name: "Vet check-in" })).toBeVisible();
  await expect(guest.getByText("1 person is in the call.")).toBeVisible(); // no names for guests
  await guest.getByRole("button", { name: "Ask to join" }).click();
  await expect(guest.getByText(/Enter your name/)).toBeVisible();
  await guest.getByLabel("Your name").fill("Gail Guest");
  await guest.getByRole("button", { name: "Ask to join" }).click();
  await expect(guest.getByText("Waiting for someone to let you in…")).toBeVisible();

  const ask = hana.getByRole("alert").filter({ hasText: "Gail Guest (guest) wants to join" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Admit" }).click();
  await expect(guest.getByRole("region", { name: /^Call: Vet check-in/ })).toBeVisible();
  await expectVideo(guest, /^Hana Host/);
  await expectVideo(hana, /^Gail Guest/);
  await expect(tile(hana, /^Gail Guest/).getByText("Guest", { exact: true })).toBeVisible();

  await hana.getByRole("button", { name: "Options for Gail Guest" }).last().click();
  await hana.getByRole("menuitem", { name: "Remove from call" }).click();
  await hana.getByRole("alertdialog", { name: "Remove Gail Guest?" }).getByRole("button", { name: "Remove" }).click();
  await expect(guest.getByRole("heading", { name: "You were removed from the call" })).toBeVisible();
  await expect(guest.getByRole("button", { name: "Rejoin" })).toHaveCount(0);
  await guest.context().close();
  await hana.context().close();
});

test("schedule a meeting with a calendar file; wrong codes are explained", async ({ browser }) => {
  const server = paddockServer();
  const page = await open(browser, server, HANA, "/paddock");
  await page.getByRole("button", { name: "New meeting" }).click();
  await page.getByRole("menuitem", { name: "Schedule for later" }).click();
  const dialog = page.getByRole("dialog", { name: "Schedule a meeting" });
  await dialog.getByLabel("Meeting name").fill("Breeze-up review");
  const tomorrow = new Date(Date.now() + 86_400_000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel("Date").fill(day);
  await dialog.getByLabel("Start time").fill("09:30");
  await dialog.getByLabel("Length").selectOption("45");
  await dialog.getByText("Any Stayblz member with the link").click();
  await dialog.getByRole("button", { name: "Schedule meeting" }).click();
  const ready = page.getByRole("dialog", { name: "Your meeting is ready" });
  await expect(ready.getByLabel("Meeting link")).toHaveValue(/\/paddock\/[a-z]{4}-[a-z]{4}$/);
  const sent = server.posts.find((p) => p.path === "/api/paddock")!.body;
  expect(sent).toMatchObject({ title: "Breeze-up review", durationMinutes: 45, access: "open", guestsAllowed: true, inviteeIds: [] });
  expect(new Date(sent.scheduledFor).getHours()).toBe(9);
  await ready.locator(".dlg-actions").getByRole("button", { name: "Close" }).click();

  await expect(page.getByRole("heading", { name: "Live and upcoming" })).toBeVisible();
  await expect(page.getByText(/Tomorrow at 9:30/)).toBeVisible();
  await page.getByRole("button", { name: "More for Breeze-up review" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Add to calendar (.ics)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Breeze-up review.ics");
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString("utf8"));
  expect(text).toContain("SUMMARY:Breeze-up review");
  expect(text).toMatch(/URL:http:\/\/127\.0\.0\.1:5178\/paddock\/[a-z]{4}-[a-z]{4}/);

  await page.getByLabel("Meeting code or link").fill("not a code");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByText(/Enter a meeting code like abcd-efgh/)).toBeVisible();
  await page.getByLabel("Meeting code or link").fill("https://stayblz-app.com/paddock/zzzz-zzzz");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page).toHaveURL(/\/paddock\/zzzz-zzzz$/);
  await expect(page.getByRole("heading", { name: "We couldn't find that meeting" })).toBeVisible();
  await page.context().close();
});

test("phones: compact controls, panels open as a sheet, nothing scrolls sideways", async ({ browser }) => {
  const server = paddockServer();
  const meeting = server.addMeeting({ hostId: HANA.id, hostName: HANA.displayName, title: "Barn huddle" });
  const page = await open(browser, server, HANA, `/paddock/${meeting.code}`, { width: 375, height: 740 });
  await expect(page.getByRole("heading", { name: "Barn huddle" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await joinNow(page);
  const dock = page.locator(".pd-dock");
  await expect(dock.getByRole("button", { name: "Microphone options" })).toHaveCount(0);
  await expect(dock.getByRole("button", { name: /^People/ })).toHaveCount(0);
  await dock.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "People (1)" }).click();
  await expect(page.getByRole("tab", { name: /People/ })).toHaveAttribute("aria-selected", "true");
  const box = await page.locator(".pd-panel").boundingBox();
  expect(box!.width).toBeGreaterThan(340);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.locator(".pd-panel")).toHaveCount(0);
  await page.context().close();
});
