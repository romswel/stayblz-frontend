import { api, apiRaw, ApiError } from "../../api";

/**
 * Stayblz Billing on the page: shapes from the API (backend routes/billing.ts, stableBilling.ts, pay.ts,
 * adminBilling.ts) and small helpers. Money is always whole cents; only `money()` turns it into words.
 */

export type Interval = "month" | "year";
export interface CatalogItem {
  id: string;
  kind: "plan" | "product";
  family: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: Interval | null;
  trialDays: number;
  features: string[];
  effect: string | null;
  effectDays: number | null;
}
export interface Method {
  id: string;
  type: "card" | "bank";
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  bankName: string;
  holderName: string;
  test: boolean;
}
export type SubStatus = "incomplete" | "trialing" | "active" | "past_due" | "canceled";
export interface Subscription {
  id: string;
  planId: string;
  family: string;
  status: SubStatus;
  plan: { name: string; features: string[]; interval: Interval } | null;
  amount: number;
  interval: Interval;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  cancelReason: string | null;
  pendingPlanId: string | null;
  pendingPlan: { name: string; amount: number; interval: Interval } | null;
  methodId: string | null;
  couponCode: string | null;
  discountLeft: number | null;
  openInvoice: Invoice | null;
}
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export interface InvoiceLine {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: number;
  shareBps: number | null;
  taxable: boolean;
  amount: number;
  horseId: string | null;
  horseName: string;
  serviceOn: string | null;
  chargeId: string | null;
}
export type Channel = "card" | "bank" | "keyed" | "reader" | "offline";
export interface Payment {
  id: string;
  invoiceId: string;
  channel: Channel;
  method: { type?: string; brand?: string; last4?: string; bankName?: string };
  offlineKind?: string | null;
  reference?: string;
  amount: number;
  fee?: number;
  net?: number;
  refunded: number;
  status: "pending" | "processing" | "succeeded" | "failed";
  failureCode?: string | null;
  failureMessage?: string | null;
  test?: boolean;
  auto?: boolean;
  createdAt: string;
  settlesAt?: string | null;
  invoiceNumber?: string;
  stableName?: string | null;
  client?: string;
  kind?: string;
}
export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  note: string;
  status: string;
  createdAt: string;
}
export interface Invoice {
  id: string;
  number: string | null;
  issuer: "stayblz" | "stable";
  kind: "subscription" | "purchase" | "stable";
  status: InvoiceStatus;
  stableId: string | null;
  stableName: string | null;
  from: { name: string; email: string; phone: string } | null;
  billTo: { name?: string; email?: string; company?: string; phone?: string; line1?: string; city?: string; region?: string; postal?: string; country?: string };
  clientId?: string | null;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  taxRateBps: number;
  tax: number;
  total: number;
  paid: number;
  refunded: number;
  due: number;
  allowCard: boolean;
  allowBank: boolean;
  memo: string;
  dueOn: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  autoCollect?: boolean;
  attempts?: number;
  nextAttemptAt?: string | null;
  inFlight: boolean;
  createdAt: string;
  lines?: InvoiceLine[];
  payments?: Payment[];
  refunds?: Refund[];
  payToken?: string | null;
  autopay?: boolean;
  events?: { event: string; at: string; detail: Record<string, unknown> }[];
}
export interface Overview {
  settings: { mode: "test" | "live"; enforcePaywalls: boolean };
  provider: { name: string; live: boolean };
  profile: { name: string; email: string; line1: string; line2: string; city: string; region: string; postal: string; country: string; defaultMethodId: string | null } | null;
  methods: Method[];
  subscriptions: Subscription[];
  features: string[];
  /** Plan families you've had before: no second free trial there. */
  trialUsed: string[];
  bills: Invoice[];
  autopay: { stableId: string; stableName: string; methodId: string }[];
  billers: { stableId: string; stableName: string }[];
  catalog: CatalogItem[];
}

/* ---------- Helpers ---------- */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (cents: number | null | undefined) => usd.format((cents ?? 0) / 100);
export const percent = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
export const per = (interval: Interval | null | undefined) => (interval === "year" ? "/year" : interval === "month" ? "/month" : "");
export const dateText = (iso: string | null | undefined, withYear = true) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "numeric" } : {}),
      })
    : "";
/** Dollars typed by a person → whole cents (null when it isn't a valid amount). */
export function parseDollars(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(clean) || clean === "" || clean === "-" || clean === ".") return null;
  const [whole, frac = ""] = clean.replace("-", "").split(".");
  const cents = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  return clean.startsWith("-") ? -cents : cents;
}
export const centsToInput = (cents: number) => (cents / 100).toFixed(2);

/** One key per payment attempt: retrying the same attempt (after a network error) can't charge twice. */
export function newKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
/** A result we don't know yet (connection lost, processor unconfirmed): keep the key for the retry. */
export const unknownOutcome = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.code === "payment_unconfirmed" || error.code === "refund_unconfirmed" || error.code === "payout_unconfirmed");

export const methodLabel = (m: { type?: string; brand?: string; last4?: string; bankName?: string } | null | undefined) => {
  if (!m || !m.last4) return "";
  const brand = m.type === "bank" ? m.bankName || "Bank account" : ({ visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover" } as Record<string, string>)[m.brand ?? ""] ?? "Card";
  return `${brand} •••• ${m.last4}`;
};
export const channelLabel: Record<Channel, string> = {
  card: "Card",
  bank: "Bank transfer",
  keyed: "Card by phone",
  reader: "Card reader",
  offline: "Recorded",
};
export const offlineLabel: Record<string, string> = { cash: "Cash", check: "Cheque", bank_transfer: "Bank transfer (outside Stayblz)", other: "Other" };
export const categoryLabel: Record<string, string> = {
  training: "Training / day rate",
  board: "Board",
  vet: "Vet",
  farrier: "Farrier",
  transport: "Shipping",
  race_fees: "Entry & race fees",
  jockey: "Jockey fees",
  supplies: "Supplies",
  breeding: "Breeding / stud fee",
  sale: "Sale / deposit",
  other: "Other",
  credit: "Credit",
  subscription: "Plan",
  purchase: "Purchase",
};
export const CHARGE_CATEGORIES = ["training", "board", "vet", "farrier", "transport", "race_fees", "jockey", "supplies", "breeding", "sale", "other", "credit"] as const;

export const invoiceStatusLabel = (i: Pick<Invoice, "status" | "dueOn" | "inFlight" | "paid" | "refunded" | "total">) => {
  if (i.status === "open" && i.inFlight) return { text: "Payment processing", tone: "info" };
  if (i.status === "open" && i.dueOn && i.dueOn < new Date().toISOString().slice(0, 10)) return { text: "Overdue", tone: "danger" };
  if (i.status === "open" && i.paid > 0) return { text: "Part paid", tone: "warn" };
  if (i.status === "paid" && i.refunded > 0) return { text: i.refunded >= i.paid ? "Refunded" : "Part refunded", tone: "muted" };
  return (
    {
      draft: { text: "Draft", tone: "muted" },
      open: { text: "Due", tone: "warn" },
      paid: { text: "Paid", tone: "ok" },
      void: { text: "Cancelled", tone: "muted" },
      uncollectible: { text: "Not collected", tone: "danger" },
    } as Record<string, { text: string; tone: string }>
  )[i.status];
};
export const subStatusLabel = (s: Subscription) => {
  if (s.status === "active" && s.cancelAtPeriodEnd) return { text: "Ending", tone: "warn" };
  if (s.status === "trialing" && s.cancelAtPeriodEnd) return { text: "Trial ending", tone: "warn" };
  return (
    {
      incomplete: { text: "Payment needed", tone: "danger" },
      trialing: { text: "Free trial", tone: "info" },
      active: { text: "Active", tone: "ok" },
      past_due: { text: "Payment failed", tone: "danger" },
      canceled: { text: "Ended", tone: "muted" },
    } as Record<string, { text: string; tone: string }>
  )[s.status];
};

/* ---------- Calls ---------- */

export const billingApi = {
  overview: (signal?: AbortSignal) => api.get<Overview>("/api/billing/overview", { signal }),
  saveProfile: (body: Record<string, string>) => api.put<{ ok: true }>("/api/billing/profile", body),
  addMethod: (body: Record<string, unknown>) => api.post<{ method: Method }>("/api/billing/methods", body),
  setDefault: (id: string) => api.post<{ ok: true }>(`/api/billing/methods/${id}/default`, {}),
  removeMethod: (id: string) => api.post<{ ok: true }>(`/api/billing/methods/${id}/remove`, {}),
  subscribe: (body: { planId: string; methodId: string; coupon?: string; key: string }) =>
    api.post<{ subscription: Subscription; payment: Payment | null }>("/api/billing/subscriptions", body),
  cancel: (id: string) => api.post<{ subscription: Subscription }>(`/api/billing/subscriptions/${id}/cancel`, {}),
  resume: (id: string) => api.post<{ subscription: Subscription }>(`/api/billing/subscriptions/${id}/resume`, {}),
  change: (id: string, body: { planId?: string; methodId?: string }) => api.post<{ subscription: Subscription }>(`/api/billing/subscriptions/${id}/change`, body),
  paySubscription: (id: string, body: { methodId: string; key: string }) => api.post<{ subscription: Subscription; payment: Payment }>(`/api/billing/subscriptions/${id}/pay`, body),
  checkCoupon: (code: string, planId: string) => api.post<{ code: string; discount: number; firstTotal: number; duration: string; durationMonths: number | null; percentOff: number | null; amountOff: number | null }>("/api/billing/coupons/check", { code, planId }),
  purchase: (body: { productId: string; listingId: string; methodId: string; key: string }) => api.post<{ payment: Payment; invoice: Invoice; paid: boolean }>("/api/billing/purchases", body),
  invoices: (before?: string) => api.get<{ invoices: Invoice[] }>(`/api/billing/invoices${before ? `?before=${encodeURIComponent(before)}` : ""}`),
  invoice: (id: string, signal?: AbortSignal) => api.get<{ invoice: Invoice }>(`/api/billing/invoices/${id}`, { signal }),
  payInvoice: (id: string, body: { methodId: string; key: string }) => api.post<{ payment: Payment; invoice: Invoice; paid: boolean }>(`/api/billing/invoices/${id}/pay`, body),
  setAutopay: (stableId: string, methodId: string) => api.put<{ ok: true }>("/api/billing/autopay", { stableId, methodId }),
  removeAutopay: (stableId: string) => api.post<{ ok: true }>("/api/billing/autopay/remove", { stableId }),
};

/** Downloads a CSV the API makes (with the session), as a file. */
export async function downloadCsv(path: string, fallbackName: string, headers?: Record<string, string>) {
  const res = await apiRaw(path, { headers });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
