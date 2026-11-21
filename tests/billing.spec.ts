import { test, expect, type Page, type Route } from "@playwright/test";

// Every API is mocked: these tests prove the pages and flows, not the real backend or a payment processor.
// The backend's own tests (stayblz-backend/tests/billing.test.cjs) prove the money rules against real SQL.
const stable = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TV = { id: "tv_monthly", kind: "plan", family: "tv", name: "STAYBLZ TV Pass", description: "Watch live race telecasts on STAYBLZ TV.", amount: 1200, currency: "usd", interval: "month", trialDays: 0, features: ["tv.watch"], effect: null, effectDays: null };
const FEATURE7 = { id: "listing_feature_7", kind: "product", family: "marketplace", name: "Featured listing - 7 days", description: "Shows first.", amount: 999, currency: "usd", interval: null, trialDays: 0, features: [], effect: "marketplace_feature", effectDays: 7 };
const CARD = { id: "m1111111-1111-4111-8111-111111111111", type: "card", brand: "visa", last4: "4242", expMonth: 12, expYear: 2034, bankName: "", holderName: "Racing Member", test: true };

type Over = Record<string, unknown>;
function overview(extra: Over = {}) {
  return {
    settings: { mode: "test", enforcePaywalls: false },
    provider: { name: "test", live: false },
    profile: null,
    methods: [],
    subscriptions: [],
    features: [],
    trialUsed: [],
    bills: [],
    autopay: [],
    billers: [],
    catalog: [TV, FEATURE7],
    ...extra,
  };
}
const invoice = (over: Over = {}) => ({
  id: "i1111111-1111-4111-8111-111111111111",
  number: "BR-0007",
  issuer: "stable",
  kind: "stable",
  status: "open",
  stableId: stable,
  stableName: "Bishop Racing",
  from: { name: "Bishop Racing LLC", email: "office@bishop.test", phone: "" },
  billTo: { name: "Joe Jones", email: "joe@example.test" },
  subtotal: 143250,
  discount: 0,
  couponCode: null,
  taxRateBps: 0,
  tax: 0,
  total: 143250,
  paid: 0,
  refunded: 0,
  due: 143250,
  allowCard: true,
  allowBank: true,
  memo: "Thank you!",
  dueOn: "2099-12-15",
  issuedAt: "2026-11-30T12:00:00Z",
  paidAt: null,
  voidedAt: null,
  periodStart: null,
  periodEnd: null,
  inFlight: false,
  createdAt: "2026-11-30T12:00:00Z",
  lines: [{ id: "l1", category: "training", description: "Day rate, November", quantity: 30, unit: 9550, shareBps: 5000, taxable: false, amount: 143250, horseId: "h1", horseName: "Golden Gate", serviceOn: "2026-11-01", chargeId: null }],
  payments: [],
  ...over,
});

async function signedIn(page: Page, { role = "member", theme = "light", handle }: { role?: string; theme?: string; handle?: (path: string, route: Route) => Promise<boolean> | boolean } = {}) {
  await page.addInitScript((t) => localStorage.setItem("stayblz.theme", t), theme);
  const calls: { method: string; path: string; body: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    calls.push({ method: req.method(), path, body: req.postDataJSON?.() ?? null });
    if (handle && (await handle(path, route))) return;
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: "m", username: "m", displayName: "Racing Member", role, email: "m@example.test" } } });
    if (path === "/api/workspaces") return route.fulfill({ json: { stables: [] } });
    return route.fulfill({ status: 403, json: { error: "Private workspace" } });
  });
  return calls;
}

test("Billing is in the Support menu; the old Subscription address opens Plans with the $12/month TV Pass", async ({ page }) => {
  await signedIn(page, { handle: (p, r) => (p === "/api/billing/overview" ? (r.fulfill({ json: overview() }), true) : false) });
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Billing", exact: true }).click();
  await expect(page).toHaveURL(/\/billing$/);
  await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible();
  await expect(page.getByText("Test mode", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plans" })).toBeVisible();
  await page.goto("/subscription");
  await expect(page).toHaveURL(/\/billing\/plans$/);
  await expect(page.getByRole("heading", { name: "STAYBLZ TV Pass" })).toBeVisible();
  await expect(page.getByText("$12.00").first()).toBeVisible();
});

test("subscribe: a test card is turned into a token in the browser; the card number is never sent", async ({ page }) => {
  let added = 0;
  let subscribed: Record<string, unknown> | null = null;
  const calls = await signedIn(page, {
    handle: (p, r) => {
      if (p === "/api/billing/overview") return r.fulfill({ json: overview() }), true;
      if (p === "/api/billing/methods") {
        added++;
        return r.fulfill({ status: 201, json: { method: CARD } }), true;
      }
      if (p === "/api/billing/subscriptions") {
        subscribed = r.request().postDataJSON();
        return (
          r.fulfill({
            status: 201,
            json: { subscription: { id: "s1", status: "active", planId: "tv_monthly", currentPeriodEnd: "2026-12-21T00:00:00Z" }, payment: { id: "p1", status: "succeeded", amount: 1200 } },
          }),
          true
        );
      }
      return false;
    },
  });
  await page.goto("/billing/plans");
  await page.getByRole("button", { name: "Subscribe" }).click();
  const dialog = page.getByRole("dialog", { name: "Subscribe to STAYBLZ TV Pass" });
  await expect(dialog.getByText(/then \$12\.00\/month on the same day each month until you cancel/)).toBeVisible();
  // A real-looking card that isn't a test card: refused here, nothing sent.
  await dialog.getByLabel("Card number").fill("4111 1111 1111 1111");
  await dialog.getByLabel("Expiry").fill("1234");
  await dialog.getByLabel("Security code").fill("123");
  await dialog.getByLabel("Name on the card").fill("Racing Member");
  await dialog.getByRole("button", { name: /Pay \$12\.00 and subscribe/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("isn't a Stayblz test card");
  expect(added).toBe(0);
  // The test card works.
  await dialog.getByLabel("Card number").fill("4242424242424242");
  await dialog.getByRole("button", { name: /Pay \$12\.00 and subscribe/ }).click();
  await expect(page.getByText(/You're subscribed/)).toBeVisible();
  const sent = JSON.stringify(calls.map((c) => c.body));
  expect(sent).not.toContain("4242424242424242");
  expect(sent).not.toContain("4111111111111111");
  expect(sent).not.toContain("4111 1111");
  expect(sent).toContain("tok_visa");
  expect(subscribed).toMatchObject({ planId: "tv_monthly", methodId: CARD.id });
  expect(typeof (subscribed as unknown as { key: string }).key).toBe("string");
});

test("a declined card shows why; the next try uses a new key; a retry after a lost connection reuses it", async ({ page }) => {
  const keys: string[] = [];
  let attempt = 0;
  await signedIn(page, {
    handle: (p, r) => {
      if (p === "/api/billing/overview") return r.fulfill({ json: overview({ methods: [CARD], profile: { defaultMethodId: CARD.id } }) }), true;
      if (p === "/api/billing/subscriptions") {
        keys.push((r.request().postDataJSON() as { key: string }).key);
        attempt++;
        if (attempt === 1) return r.fulfill({ status: 402, json: { code: "card_declined", error: "The card was declined." } }), true;
        if (attempt === 2) return r.abort("connectionreset"), true;
        return r.fulfill({ status: 201, json: { subscription: { id: "s1", status: "active" }, payment: { status: "succeeded", amount: 1200 } } }), true;
      }
      return false;
    },
  });
  await page.goto("/billing/plans");
  await page.getByRole("button", { name: "Subscribe" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Visa •••• 4242")).toBeVisible();
  const pay = dialog.getByRole("button", { name: /Pay \$12\.00/ });
  await pay.click();
  await expect(dialog.getByRole("alert")).toContainText("The card was declined.");
  await pay.click();
  await expect(dialog.getByRole("alert")).toContainText("don't pay again");
  await pay.click();
  await expect(page.getByText(/You're subscribed/)).toBeVisible();
  expect(keys[0]).not.toBe(keys[1]);
  expect(keys[2]).toBe(keys[1]);
});

test("your plan: renewal date, cancel at the end of the period (confirmed), then keep it", async ({ page }) => {
  let state: "active" | "ending" = "active";
  const sub = () => ({
    id: "s1",
    planId: "tv_monthly",
    family: "tv",
    status: "active",
    plan: { name: "STAYBLZ TV Pass", features: ["tv.watch"], interval: "month" },
    amount: 1200,
    interval: "month",
    currentPeriodStart: "2026-11-21T00:00:00Z",
    currentPeriodEnd: "2026-12-21T00:00:00Z",
    trialEnd: null,
    cancelAtPeriodEnd: state === "ending",
    canceledAt: null,
    endedAt: null,
    cancelReason: null,
    pendingPlanId: null,
    pendingPlan: null,
    methodId: CARD.id,
    couponCode: null,
    discountLeft: 0,
    openInvoice: null,
  });
  await signedIn(page, {
    handle: (p, r) => {
      if (p === "/api/billing/overview") return r.fulfill({ json: overview({ methods: [CARD], subscriptions: [sub()], features: ["tv.watch"] }) }), true;
      if (p === "/api/billing/subscriptions/s1/cancel") return (state = "ending"), r.fulfill({ json: { subscription: sub() } }), true;
      if (p === "/api/billing/subscriptions/s1/resume") return (state = "active"), r.fulfill({ json: { subscription: sub() } }), true;
      return false;
    },
  });
  await page.goto("/billing");
  await expect(page.getByText(/\$12\.00\/month · renews Dec 21, 2026/)).toBeVisible();
  await expect(page.getByText("Paid with Visa •••• 4242")).toBeVisible();
  await page.getByRole("button", { name: "Cancel plan" }).click();
  const ask = page.getByRole("alertdialog", { name: "Cancel STAYBLZ TV Pass?" });
  await expect(ask).toContainText("You keep access until Dec 21, 2026");
  await ask.getByRole("button", { name: "Cancel plan" }).click();
  await expect(page.getByText("Ends Dec 21, 2026. You won't be charged again.")).toBeVisible();
  await page.getByRole("button", { name: "Keep my plan" }).click();
  await expect(page.getByText(/renews Dec 21, 2026/)).toBeVisible();
});

test("pay link, signed out: see the bill and pay it with a test card; declines say why", async ({ page }) => {
  let attempts = 0;
  const token = "a".repeat(64);
  await page.addInitScript(() => localStorage.setItem("stayblz.theme", "dark"));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/pay/${token}`) return route.fulfill({ json: { invoice: invoice(), signedIn: false } });
    if (path === `/api/pay/${token}/pay`) {
      attempts++;
      const body = route.request().postDataJSON() as { token: string };
      if (body.token === "tok_declined") return route.fulfill({ status: 402, json: { code: "card_declined", error: "The card was declined.", invoice: invoice() } });
      return route.fulfill({ json: { payment: { id: "p1", status: "succeeded", amount: 143250, channel: "card", method: {}, refunded: 0, createdAt: "2026-11-30T12:00:00Z" }, invoice: invoice({ status: "paid", paid: 143250, due: 0 }), paid: true } });
    }
    return route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
  });
  await page.goto(`/pay/${token}`);
  await expect(page.getByRole("heading", { name: "Bishop Racing LLC", level: 1 })).toBeVisible();
  await expect(page.getByText("Day rate, November")).toBeVisible();
  await expect(page.getByText("50%")).toBeVisible();
  const box = page.getByRole("complementary", { name: "Payment" });
  await box.getByLabel("Card number").fill("4000 0000 0000 0002");
  await box.getByLabel("Expiry").fill("12/34");
  await box.getByLabel("Security code").fill("123");
  await box.getByLabel("Name on the card").fill("Joe Jones");
  await box.getByRole("button", { name: "Pay $1,432.50" }).click();
  await expect(box.getByRole("alert")).toContainText("The card was declined.");
  await box.getByLabel("Card number").fill("4242 4242 4242 4242");
  await box.getByRole("button", { name: "Pay $1,432.50" }).click();
  await expect(box.getByText("Paid. Thank you.")).toBeVisible();
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("a pay link that was replaced or cancelled says so", async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/pay/")) return route.fulfill({ status: 404, json: { code: "link_not_found", error: "This pay link isn't valid or is no longer active." } });
    return route.fulfill({ status: 401, json: { error: "Sign in to continue." } });
  });
  await page.goto(`/pay/${"b".repeat(64)}`);
  await expect(page.getByText("This pay link isn't active")).toBeVisible();
});

test("Barn office: members are told it's for owners and managers; a manager sees the money and the fees", async ({ page }) => {
  const overviewData = {
    role: "manager",
    stableName: "Bishop Racing",
    settings: { mode: "test", payoutDelayDays: 2, fees: { card: { bps: 299, fixed: 0, cap: 0 }, bank: { bps: 100, fixed: 0, cap: 0 }, keyed: { bps: 350, fixed: 0, cap: 0 }, reader: { bps: 250, fixed: 0, cap: 0 } } },
    merchant: { stable_id: stable, status: "active", legal_name: "Bishop Racing LLC", business_type: "company", email: "", phone: "", statement_name: "BISHOP", payout: { bankName: "Stayblz Test Bank", last4: "6789" }, invoice_prefix: "BR", next_number: 8, terms_days: 15, default_memo: "", accept_card: true, accept_bank: true, test: true },
    balance: { available: 110543, pending: 2000, gross: 113950, fees: 3407, refunds: 0, paidOut: 0 },
    invoices: { drafts: 1, open: 2, openTotal: 202500, overdue: 1, overdueTotal: 59300, paid30: 113950 },
    charges: { unbilled: 3, unbilledTotal: 120000 },
    clients: 3,
    recentPayments: [],
  };
  let role = "member";
  await signedIn(page, {
    handle: (p, r) => {
      if (p === "/api/workspaces") return r.fulfill({ json: { stables: [{ id: stable, name: "Bishop Racing", role }] } }), true;
      if (p === "/api/workspace/billing/overview") return r.fulfill({ json: overviewData }), true;
      return false;
    },
  });
  await page.goto("/workspace/billing");
  await expect(page.getByText(/is for its owner and managers/)).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Barn office" })).toHaveCount(0);
  role = "manager";
  await page.reload();
  await expect(page.getByRole("heading", { name: "Barn office", level: 1 })).toBeVisible();
  await expect(page.getByText("$1,105.43")).toBeVisible();
  await expect(page.getByText(/1 overdue \(\$593\.00\)/)).toBeVisible();
  await expect(page.getByText("2.99%")).toBeVisible();
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
});

test("Barn office invoice: the editor totals lines with owner shares; sending asks first", async ({ page }) => {
  let saved: Record<string, unknown> | null = null;
  let sent = false;
  await signedIn(page, {
    handle: (p, r) => {
      const method = r.request().method();
      if (p === "/api/workspaces") return r.fulfill({ json: { stables: [{ id: stable, name: "Bishop Racing", role: "owner" }] } }), true;
      if (p === "/api/workspace/billing/overview") return r.fulfill({ status: 503, json: { error: "Billing is temporarily unavailable." } }), true;
      if (p === "/api/workspace/billing/clients") return r.fulfill({ json: { clients: [{ id: "c1", name: "Eve Evans", email: "eve@example.test", phone: "", company: "", notes: "", archived: false }] } }), true;
      if (p === "/api/workspace/billing/horses") return r.fulfill({ json: { horses: [{ id: "h1", name: "Golden Gate", owners: [], billedBps: 0 }] } }), true;
      if (p === "/api/workspace/billing/invoices" && method === "POST") {
        saved = r.request().postDataJSON();
        return r.fulfill({ status: 201, json: { invoice: invoice({ status: "draft", number: null }) } }), true;
      }
      if (p.endsWith("/send")) return (sent = true), r.fulfill({ json: { invoice: invoice() } }), true;
      if (p === `/api/workspace/billing/invoices/${invoice().id}`) return r.fulfill({ json: { invoice: invoice({ payToken: "c".repeat(64) }) } }), true;
      return false;
    },
  });
  await page.goto("/workspace/billing/invoices/new");
  await page.getByLabel("Bill to").selectOption("c1");
  await page.getByLabel("Description").fill("Day rate, December");
  await page.getByLabel("Qty").fill("31");
  await page.getByLabel("Price ($)").fill("95.50");
  await expect(page.locator(".bl-totals .is-total")).toContainText("$2,960.50");
  await page.getByRole("button", { name: "Save and send" }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText("Send $2,960.50 invoice to Eve Evans?");
  await ask.getByRole("button", { name: "Send invoice" }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/billing/invoices/${invoice().id}$`));
  expect(sent).toBe(true);
  expect(saved).toMatchObject({ clientId: "c1", lines: [{ category: "training", description: "Day rate, December", quantity: 31, unitCents: 9550 }] });
  await expect(page.getByRole("button", { name: "Take a payment" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Pay link" })).toHaveValue(/\/pay\/c{64}$/);
});

test("admin fees: the margin check shows where Stayblz would lose money (in-person at 2.50%)", async ({ page }) => {
  const rates = (bps: number, fixed = 0, cap = 0) => ({ bps, fixed, cap });
  await signedIn(page, {
    role: "admin",
    handle: (p, r) => {
      if (p === "/api/admin/billing/summary")
        return (
          r.fulfill({
            json: {
              summary: { sales: 0, feeIncome: 0, refunds: 0, estimatedCost: 0, stableVolume: 0, offlineVolume: 0, mrr: 0, subscriptions: [], payments: { succeeded: 0, failed: 0, processing: 0 }, stables: 0, months: [] },
              settings: { mode: "test", enforcePaywalls: false, payoutDelayDays: 2, bankSettleMinutes: 3, updatedAt: "x", fees: { card: rates(299), bank: rates(100), keyed: rates(350), reader: rates(250) }, costs: { card: rates(290, 30), bank: rates(80, 0, 500), keyed: rates(340, 30), reader: rates(270, 5) } },
              provider: { name: "test", live: false, liveAvailable: false },
            },
          }),
          true
        );
      return false;
    },
  });
  await page.goto("/admin/billing/settings");
  await expect(page.getByRole("heading", { name: "Margin check" })).toBeVisible();
  const row = page.getByRole("row", { name: /^\$100\.00/ });
  // Card $100: fee 2.99, cost 3.20 → −$0.21. Reader $100: fee 2.50, cost 2.75 → −$0.25. Bank $100: +$0.20.
  await expect(row.locator("td.bl-neg").first()).toHaveText("−$0.21");
  await expect(row.locator("td").nth(4)).toHaveText("−$0.25");
  await expect(row.locator("td").nth(2)).toHaveText("$0.20");
  await expect(page.getByRole("button", { name: "Go live" })).toBeDisabled();
  await expect(page.getByLabel(/Fee Card \(online, pay link\) percent/)).toBeDisabled();
});

test("STAYBLZ TV with paid access on: no pass shows the TV Pass offer instead of the player", async ({ page }) => {
  await signedIn(page, {
    handle: (p, r) => {
      if (p === "/api/tv/status") return r.fulfill({ json: { state: "live", title: "Keeneland Race 7", startsAt: null, access: { allowed: false, reason: "required", plan: "tv_monthly" } } }), true;
      if (p === "/api/tv/youtube") return r.fulfill({ json: { channels: [], videos: [] } }), true;
      if (p === "/api/tv/playback") return r.fulfill({ status: 402, json: { code: "subscription_required", error: "Live races need the STAYBLZ TV Pass." } }), true;
      if (p === "/api/billing/overview") return r.fulfill({ json: overview() }), true;
      return false;
    },
  });
  await page.goto("/tv");
  const offer = page.getByRole("region", { name: "STAYBLZ TV Pass" });
  await expect(offer.getByRole("heading", { name: "Live now: Keeneland Race 7" })).toBeVisible();
  await expect(offer.getByText("Watch every live race for $12.00/month. Cancel any time.")).toBeVisible();
  await offer.getByRole("button", { name: "Get the TV Pass" }).click();
  await expect(page.getByRole("dialog", { name: "Subscribe to STAYBLZ TV Pass" })).toBeVisible();
});

test("phone 320px dark: Billing fits, sections scroll inside, and the menu has Billing", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page, { theme: "dark", handle: (p, r) => (p === "/api/billing/overview" ? (r.fulfill({ json: overview({ methods: [CARD] }) }), true) : false) });
  for (const path of ["/billing", "/billing/plans", "/billing/methods"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Billing", exact: true }).first()).toBeVisible();
});

test("signed-out visitors opening /billing are sent to log in", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { error: "Sign in to continue." } }));
  await page.goto("/billing");
  await expect(page).toHaveURL(/\/login/);
});

test("Barn office customers: the client list opens each customer's page with what they owe, paid, horses and invoices", async ({ page }) => {
  const client = { id: "c1111111-1111-4111-8111-111111111111", name: "Eve Evans", email: "eve@example.test", phone: "(859) 555-0101", company: "Evans Partners", notes: "Prefers bank transfer", archived: false };
  await signedIn(page, {
    handle: (p, r) => {
      if (p === "/api/workspaces") return r.fulfill({ json: { stables: [{ id: stable, name: "Bishop Racing", role: "manager" }] } }), true;
      if (p === "/api/workspace/billing/overview") return r.fulfill({ status: 503, json: { error: "busy" } }), true;
      if (p === "/api/workspace/billing/clients") return r.fulfill({ json: { clients: [{ ...client, owed: 59300, overdue: 59300 }] } }), true;
      if (p === "/api/workspace/billing/horses") return r.fulfill({ json: { horses: [] } }), true;
      if (p === `/api/workspace/billing/clients/${client.id}`)
        return (
          r.fulfill({
            json: {
              client,
              horses: [{ horseId: "h1", name: "Golden Gate", shareBps: 5000 }],
              invoices: [invoice({ number: "BR-0003", dueOn: "2026-01-02", billTo: { name: "Eve Evans" }, total: 59300, due: 59300 })],
              charges: [{ id: "ch1", horseId: null, horseName: "", clientId: client.id, category: "transport", description: "Van to Keeneland", quantity: 1, unit: 25000, amount: 25000, serviceOn: "2026-11-03", status: "unbilled" }],
              totals: { billed: 202550, paid: 143250, owed: 59300, overdue: 59300, lastPaidAt: "2026-11-30T12:00:00Z" },
            },
          }),
          true
        );
      return false;
    },
  });
  await page.goto("/workspace/billing/clients");
  await expect(page.getByText("$593.00 owed")).toBeVisible();
  await page.getByRole("link", { name: "Eve Evans" }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/billing/clients/${client.id}$`));
  await expect(page.getByRole("heading", { name: /Eve Evans/ })).toBeVisible();
  await expect(page.getByText("Evans Partners · eve@example.test · (859) 555-0101")).toBeVisible();
  await expect(page.getByText("Prefers bank transfer")).toBeVisible();
  const stats = page.getByRole("region", { name: "Account" });
  await expect(stats.getByText("$593.00 overdue")).toBeVisible();
  await expect(stats.getByText("$1,432.50")).toBeVisible();
  await expect(page.getByText("50% share")).toBeVisible();
  await expect(page.getByRole("link", { name: "BR-0003" })).toBeVisible();
  await expect(page.getByText("Van to Keeneland")).toBeVisible();
  await expect(page.getByRole("link", { name: "New invoice" }).last()).toHaveAttribute("href", `/workspace/billing/invoices/new?clientId=${client.id}`);
});
