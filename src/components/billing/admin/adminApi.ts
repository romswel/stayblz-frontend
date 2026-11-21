import { api } from "../../../api";
import type { Payment, Subscription } from "../billingApi";

export interface Rate {
  bps: number;
  fixed: number;
  cap: number;
}
export type Rates = Record<"card" | "bank" | "keyed" | "reader", Rate>;
export interface AdminSettings {
  mode: "test" | "live";
  enforcePaywalls: boolean;
  fees: Rates;
  costs: Rates;
  payoutDelayDays: number;
  bankSettleMinutes: number;
  updatedAt: string;
}
export interface Summary {
  sales: number;
  feeIncome: number;
  refunds: number;
  estimatedCost: number;
  stableVolume: number;
  offlineVolume: number;
  mrr: number;
  subscriptions: { planId: string; name: string; active: number; trialing: number; pastDue: number; canceled: number }[];
  payments: { succeeded: number; failed: number; processing: number };
  stables: number;
  months: { month: string; sales: number; feeIncome: number; refunds: number; stableVolume: number }[];
}
export interface AdminCatalogItem {
  id: string;
  kind: "plan" | "product";
  family: string;
  name: string;
  description: string;
  amount: number;
  interval: "month" | "year" | null;
  trialDays: number;
  features: string[];
  effect: string | null;
  effectDays: number | null;
  status: "draft" | "active" | "retired";
  sort: number;
}
export interface Coupon {
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | null;
  appliesTo: string[];
  maxRedemptions: number | null;
  redeemed: number;
  expiresAt: string | null;
  active: boolean;
  note: string;
}
export interface Grant {
  id: string;
  account: { id: string; email: string; name: string };
  feature: string;
  reason: string;
  endsAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
export type AdminPayment = Payment & { stableId: string | null; payer: { id: string; email: string; name: string } | null };
export type AdminSubscription = Subscription & { account: { id: string; email: string; name: string } };

const B = "/api/admin/billing";
export const adminApi = {
  summary: () => api.get<{ summary: Summary; settings: AdminSettings; provider: { name: string; live: boolean; liveAvailable: boolean } }>(`${B}/summary`),
  saveSettings: (s: Partial<AdminSettings>) => api.put<{ ok: true }>(`${B}/settings`, s),
  run: () => api.post<{ report: Record<string, number> }>(`${B}/run`, {}),
  payments: (status = "") => api.get<{ payments: AdminPayment[] }>(`${B}/payments${status ? `?status=${status}` : ""}`),
  refund: (id: string, body: Record<string, unknown>) => api.post<unknown>(`${B}/payments/${id}/refund`, body),
  subscriptions: (status = "") => api.get<{ subscriptions: AdminSubscription[] }>(`${B}/subscriptions${status ? `?status=${status}` : ""}`),
  cancelSubscription: (id: string, now: boolean) => api.post<unknown>(`${B}/subscriptions/${id}/cancel`, { now }),
  advance: (id: string) => api.post<{ report: Record<string, number> }>(`${B}/subscriptions/${id}/advance`, {}),
  catalog: () => api.get<{ catalog: AdminCatalogItem[] }>(`${B}/catalog`),
  createItem: (body: Record<string, unknown>) => api.post<{ item: AdminCatalogItem }>(`${B}/catalog`, body),
  updateItem: (id: string, body: Record<string, unknown>) => api.patch<{ item: AdminCatalogItem }>(`${B}/catalog/${id}`, body),
  coupons: () => api.get<{ coupons: Coupon[] }>(`${B}/coupons`),
  createCoupon: (body: Record<string, unknown>) => api.post<{ coupon: Coupon }>(`${B}/coupons`, body),
  setCouponActive: (code: string, active: boolean) => api.post<{ coupon: Coupon }>(`${B}/coupons/${encodeURIComponent(code)}/active`, { active }),
  grants: () => api.get<{ grants: Grant[] }>(`${B}/grants`),
  createGrant: (body: Record<string, unknown>) => api.post<{ id: string }>(`${B}/grants`, body),
  revokeGrant: (id: string) => api.post<{ ok: true }>(`${B}/grants/${id}/revoke`, {}),
};

/** Fee for an amount under a rate table (same rounding as the server). */
export function feeFor(r: Rate, amount: number) {
  let v = Math.floor((amount * r.bps + 5000) / 10000) + r.fixed;
  if (r.cap) v = Math.min(v, r.cap);
  return Math.max(0, Math.min(v, amount));
}
