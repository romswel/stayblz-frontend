import { expect, test, type Page } from "@playwright/test";
import { GRP, fakeServer } from "./messenger-fixture";

// Scheduled updates in Stayblz Chat (2026-11-25): hidden unless the server says this account may use it; three notes
// (9 PM, 1 AM, 5 AM Philippine time), pick a chat (or the open one), words save as you type, on/off, Send now.

const choices = [
  { kind: "personal", id: GRP, stableId: null, stableName: null, title: "Saturday syndicate", group: true },
  { kind: "personal", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", stableId: null, stableName: null, title: "Ann Ames", group: false },
];

async function scheduleServer(page: Page) {
  const later = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  const state = {
    notes: [
      { slot: 1, body: "", enabled: true, sendAt: "21:00", chat: null as any, keepAfterSend: false, nextAt: later(3), skippingAt: null, updatedAt: null },
      { slot: 2, body: "", enabled: true, sendAt: "01:00", chat: null as any, keepAfterSend: false, nextAt: later(7), skippingAt: null, updatedAt: null },
      { slot: 3, body: "", enabled: true, sendAt: "05:00", chat: null as any, keepAfterSend: false, nextAt: later(11), skippingAt: null, updatedAt: null },
    ],
    history: [] as any[],
    saves: [] as { slot: number; body: any }[],
    sent: [] as number[],
  };
  await page.route("**/api/messages/people/profile", (route) =>
    route.fulfill({ json: { profile: { discoverable: true, showActive: true, storageUsed: 0 }, scheduledUpdates: true } }),
  );
  await page.route("**/api/messages/scheduled**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === "/api/messages/scheduled")
      return route.fulfill({ json: { zone: "Asia/Manila", lateMinutes: 30, now: new Date().toISOString(), notes: state.notes, chats: choices, history: state.history } });
    const m = path.match(/\/scheduled\/(\d)(?:\/(send|skip))?$/);
    const note = m && state.notes.find((n) => n.slot === Number(m[1]));
    if (!m || !note) return route.fulfill({ status: 404, json: { error: "Route not found." } });
    const body = req.postDataJSON() ?? {};
    if (!m[2]) {
      state.saves.push({ slot: note.slot, body });
      Object.assign(note, body);
      return route.fulfill({ json: { note } });
    }
    if (m[2] === "send") {
      state.sent.push(note.slot);
      const entry = { id: String(state.history.length + 1), slot: note.slot, dueAt: null, status: "sent", chat: note.chat, preview: note.body, detail: null, at: new Date().toISOString() };
      state.history.unshift(entry);
      if (!note.keepAfterSend) note.body = "";
      return route.fulfill({ status: 201, json: { note, entry } });
    }
    note.skippingAt = body.skip ? note.nextAt : null;
    return route.fulfill({ json: { note } });
  });
  return state;
}

test("hidden for everyone the server doesn't allow", async ({ page }) => {
  await fakeServer(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const profile = page.waitForResponse("**/api/messages/people/profile");
  await page.goto("/messages");
  await profile;
  await expect(page.getByRole("button", { name: "Chat settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scheduled updates" })).toHaveCount(0);
});

test("three notes: pick the open chat, words save as you type, turn one off, send now", async ({ page }) => {
  await fakeServer(page);
  const server = await scheduleServer(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/messages/${GRP}`);
  await page.getByRole("button", { name: "Scheduled updates" }).click();
  const dialog = page.getByRole("dialog", { name: "Scheduled updates" });
  await expect(dialog.getByRole("heading", { name: /9:00 PM/ })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /1:00 AM/ })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /5:00 AM/ })).toBeVisible();
  const nine = dialog.locator(".sched-note").first();
  await expect(nine).toContainText("Pick a chat to send it to.");

  await nine.getByRole("button", { name: "Use the open chat (Saturday syndicate)" }).click();
  await expect(nine.getByLabel("Send to")).toHaveValue(`personal::${GRP}`);
  await nine.getByLabel(/Update/).fill("Progress: chat fixes done, QA can test the composer.");
  await expect.poll(() => server.saves.some((s) => s.slot === 1 && s.body.body === "Progress: chat fixes done, QA can test the composer.")).toBe(true);
  await expect(nine.getByText("Saved")).toBeVisible();
  await expect(nine).toContainText(/Sends .* PH \(in \d h/);

  // Same chat for all three.
  await nine.getByRole("button", { name: "Use this chat for all three" }).click();
  await expect(dialog.locator(".sched-note").nth(2).getByLabel("Send to")).toHaveValue(`personal::${GRP}`);

  // 1 AM off.
  const one = dialog.locator(".sched-note").nth(1);
  await one.getByRole("switch", { name: "Send the 1:00 AM note" }).uncheck({ force: true });
  await expect(one).toContainText("Off. Nothing is sent at this time.");
  expect(server.saves.some((s) => s.slot === 2 && s.body.enabled === false)).toBe(true);

  // Send now asks first, then shows in Recent and empties the note.
  await nine.getByRole("button", { name: "Send now" }).click();
  await page.getByRole("button", { name: "Send now" }).last().click();
  await expect(dialog.locator(".sched-history")).toContainText("Sent");
  await expect(dialog.locator(".sched-history")).toContainText("Progress: chat fixes done");
  expect(server.sent).toEqual([1]);
  await expect(nine.getByLabel(/Update/)).toHaveValue("");
});

test("fits a phone screen", async ({ page }) => {
  await fakeServer(page);
  await scheduleServer(page);
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/messages");
  await page.getByRole("button", { name: "Scheduled updates" }).click();
  const dialog = page.getByRole("dialog", { name: "Scheduled updates" });
  await expect(dialog.getByRole("heading", { name: /5:00 AM/ })).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await dialog.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 376).toBe(true);
});
