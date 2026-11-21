import { useMemo } from "react";
import { api } from "../../../api";
import { useWorkspace } from "../../../workspace";
import { downloadCsv, type Invoice, type Payment } from "../billingApi";

/** Calls to /api/workspace/billing for the stable picked in the sidebar (owners and managers only). */
export interface Merchant {
  stable_id: string;
  status: "active" | "restricted";
  legal_name: string;
  business_type: "individual" | "company";
  email: string;
  phone: string;
  statement_name: string;
  payout: { bankName?: string; last4?: string; holder?: string };
  invoice_prefix: string;
  next_number: number;
  terms_days: number;
  default_memo: string;
  accept_card: boolean;
  accept_bank: boolean;
  test: boolean;
}
export interface Rate {
  bps: number;
  fixed: number;
  cap: number;
}
export interface StableOverviewData {
  role: "owner" | "manager" | "member";
  stableName: string;
  settings: { mode: string; fees: Record<"card" | "bank" | "keyed" | "reader", Rate>; payoutDelayDays: number };
  merchant: Merchant | null;
  balance: { available: number; pending: number; gross: number; fees: number; refunds: number; paidOut: number };
  invoices: { drafts: number; open: number; openTotal: number; overdue: number; overdueTotal: number; paid30: number };
  charges: { unbilled: number; unbilledTotal: number };
  clients: number;
  recentPayments: Payment[];
}
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  archived: boolean;
  owed?: number;
  overdue?: number;
}
/** One customer's page: horses and shares, every invoice, totals, charges waiting to be billed. */
export interface ClientPage {
  client: Client;
  horses: { horseId: string; name: string; shareBps: number }[];
  invoices: Invoice[];
  charges: Charge[];
  totals: { billed: number; paid: number; owed: number; overdue: number; lastPaidAt: string | null };
}
export interface HorseOwners {
  id: string;
  name: string;
  owners: { clientId: string; name: string; shareBps: number }[];
  billedBps: number;
}
export interface Charge {
  id: string;
  horseId: string | null;
  horseName: string;
  clientId: string | null;
  category: string;
  description: string;
  quantity: number;
  unit: number;
  amount: number;
  serviceOn: string;
  status: "unbilled" | "billed";
}
export interface Payout {
  id: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  destination: { bankName?: string; last4?: string };
  arrivesOn: string | null;
  failureMessage: string | null;
  createdAt: string;
}
export type LineDraft = {
  category: string;
  description: string;
  quantity: number;
  unitCents: number;
  taxable?: boolean;
  horseId?: string | null;
  serviceOn?: string | null;
  shareBps?: number | null;
  chargeId?: string | null;
};

const BASE = "/api/workspace/billing";

export function useStableBilling() {
  const { active } = useWorkspace();
  const stableId = active?.id ?? "";
  return useMemo(() => {
    const headers = { "X-Stayblz-Stable": stableId };
    const get = <T,>(path: string, signal?: AbortSignal) => api.get<T>(BASE + path, { headers, signal });
    const post = <T,>(path: string, body: unknown = {}) => api.post<T>(BASE + path, body, { headers });
    const patch = <T,>(path: string, body: unknown) => api.patch<T>(BASE + path, body, { headers });
    const put = <T,>(path: string, body: unknown) => api.put<T>(BASE + path, body, { headers });
    return {
      stableId,
      overview: (signal?: AbortSignal) => get<StableOverviewData>("/overview", signal),
      setup: () => get<{ merchant: Merchant | null; suggested: { legalName: string; statementName: string; invoicePrefix: string } }>("/setup"),
      saveSetup: (body: Record<string, unknown>) => put<{ ok: true }>("/setup", body),
      clients: (archived = false) => get<{ clients: Client[] }>(`/clients${archived ? "?archived=1" : ""}`),
      client: (id: string, signal?: AbortSignal) => get<ClientPage>(`/clients/${id}`, signal),
      addClient: (body: Partial<Client>) => post<{ client: Client }>("/clients", body),
      editClient: (id: string, body: Partial<Client>) => patch<{ client: Client }>(`/clients/${id}`, body),
      archiveClient: (id: string, archived: boolean) => post<{ ok: true }>(`/clients/${id}/archive`, { archived }),
      horses: () => get<{ horses: HorseOwners[] }>("/horses"),
      setOwners: (horseId: string, owners: { clientId: string; shareBps: number }[]) => put<{ owners: number; totalBps: number }>(`/horses/${horseId}/owners`, { owners }),
      charges: (status: "unbilled" | "billed" | "all" = "unbilled") => get<{ charges: Charge[] }>(`/charges?status=${status}`),
      addCharge: (body: Record<string, unknown>) => post<{ charge: Charge }>("/charges", body),
      editCharge: (id: string, body: Record<string, unknown>) => patch<{ charge: Charge }>(`/charges/${id}`, body),
      removeCharge: (id: string) => post<{ ok: true }>(`/charges/${id}/remove`),
      billOwners: (body: { through?: string | null; horseIds?: string[] }) =>
        post<{ invoices: Invoice[]; skipped: { chargeId: string; horseName: string; description: string; amount: number; reason: string }[] }>("/bill-owners", body),
      invoices: (status = "", clientId = "") => get<{ invoices: Invoice[] }>(`/invoices?${new URLSearchParams({ ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) })}`),
      invoice: (id: string, signal?: AbortSignal) => get<{ invoice: Invoice }>(`/invoices/${id}`, signal),
      createInvoice: (body: Record<string, unknown>) => post<{ invoice: Invoice }>("/invoices", body),
      saveInvoice: (id: string, body: Record<string, unknown>) => put<{ invoice: Invoice }>(`/invoices/${id}`, body),
      sendInvoice: (id: string) => post<{ invoice: Invoice }>(`/invoices/${id}/send`),
      voidInvoice: (id: string) => post<{ invoice?: Invoice; deleted?: boolean }>(`/invoices/${id}/void`),
      newLink: (id: string) => post<{ payToken: string }>(`/invoices/${id}/link`),
      takePayment: (id: string, body: Record<string, unknown>) => post<{ payment: Payment; invoice: Invoice; paid: boolean }>(`/invoices/${id}/payments`, body),
      refund: (paymentId: string, body: Record<string, unknown>) => post<{ refund: { status: string; amount_cents: number } }>(`/payments/${paymentId}/refund`, body),
      payments: () => get<{ payments: Payment[] }>("/payments"),
      payouts: () => get<{ balance: StableOverviewData["balance"]; payouts: Payout[] }>("/payouts"),
      payout: (body: { amountCents?: number; key: string }) => post<{ payout: { status: string; amount_cents: number; arrives_on: string | null } }>("/payouts", body),
      exportCsv: (kind: "payments" | "invoices") => downloadCsv(`${BASE}/export.csv?kind=${kind}`, `stayblz-${kind}.csv`, headers),
    };
  }, [stableId]);
}

export const payLink = (token: string | null | undefined) => (token ? `${window.location.origin}/pay/${token}` : "");
