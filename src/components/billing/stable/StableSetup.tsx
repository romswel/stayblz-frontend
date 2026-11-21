import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CardFields, { cardPayload, emptyCard } from "../CardFields";
import TestModeNotice from "../TestModeNotice";
import { useLoad } from "../useLoad";
import { useStableBilling } from "./stableBillingApi";

/** Payments setup for the stable (owner only): who the money goes to, how invoices look, the payout bank. */
export default function StableSetup({ role, onSaved }: { role: string; onSaved: () => void }) {
  const billing = useStableBilling();
  const setup = useLoad(() => billing.setup(), [billing]);
  const [form, setForm] = useState<null | { legalName: string; businessType: "individual" | "company"; email: string; phone: string; statementName: string; invoicePrefix: string; termsDays: string; defaultMemo: string; acceptCard: boolean; acceptBank: boolean }>(null);
  const [bank, setBank] = useState(emptyCard("bank"));
  const [changeBank, setChangeBank] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bankField, setBankField] = useState<string>();
  const [notice, setNotice] = useState("");
  const owner = role === "owner";

  useEffect(() => {
    if (!setup.data || form) return;
    const m = setup.data.merchant;
    const s = setup.data.suggested;
    setForm({
      legalName: m?.legal_name ?? s.legalName,
      businessType: m?.business_type ?? "company",
      email: m?.email ?? "",
      phone: m?.phone ?? "",
      statementName: m?.statement_name ?? s.statementName,
      invoicePrefix: m?.invoice_prefix ?? s.invoicePrefix,
      termsDays: String(m?.terms_days ?? 15),
      defaultMemo: m?.default_memo ?? "",
      acceptCard: m?.accept_card ?? true,
      acceptBank: m?.accept_bank ?? true,
    });
    setChangeBank(!m?.payout?.last4);
  }, [setup.data, form]);

  if (setup.error && !setup.data) return <p className="bl-error" role="alert">{setup.error}</p>;
  if (!setup.data || !form) return <p className="bl-muted" role="status">Loading…</p>;
  const merchant = setup.data.merchant;
  const set = (patch: Partial<NonNullable<typeof form>>) => setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <section className="bl-card gx-glass" aria-labelledby="sb-setup-h">
      <h2 id="sb-setup-h">{merchant ? "Payments settings" : "Set up payments"}</h2>
      {!owner && <p className="bl-muted">Only the stable's owner can change these.</p>}
      <TestModeNotice />
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      <form
        className="bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBankField(undefined);
          let payoutToken: string | undefined;
          let payoutHolder: string | undefined;
          if (changeBank && (bank.routing || bank.account || !merchant?.payout?.last4)) {
            const check = cardPayload(bank);
            if (!check.payload) {
              setBankField(check.field);
              return setError(check.error ?? "Check the payout bank account.");
            }
            payoutToken = check.payload.token;
            payoutHolder = check.payload.holderName;
          }
          if (!merchant && !terms) return setError("Agree to the payments terms first.");
          const termsDays = Number(form.termsDays);
          if (!Number.isInteger(termsDays) || termsDays < 0 || termsDays > 120) return setError("Payment terms are 0 to 120 days.");
          setBusy(true);
          try {
            await billing.saveSetup({ ...form, termsDays, payoutToken, payoutHolder, acceptTerms: terms || !!merchant });
            setNotice(merchant ? "Saved." : "Payments are set up. You can send invoices now.");
            setChangeBank(false);
            setBank(emptyCard("bank"));
            await setup.reload();
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : "The settings couldn't be saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="bl-form" disabled={!owner || busy}>
          <legend className="bl-label">Business</legend>
          <div className="bl-row2">
            <label className="bl-field">
              <span>Business or trading name</span>
              <input value={form.legalName} maxLength={120} onChange={(e) => set({ legalName: e.target.value })} />
            </label>
            <label className="bl-field">
              <span>Type</span>
              <select value={form.businessType} onChange={(e) => set({ businessType: e.target.value as "individual" | "company" })}>
                <option value="company">Company or partnership</option>
                <option value="individual">Individual (sole trainer)</option>
              </select>
            </label>
          </div>
          <div className="bl-row2">
            <label className="bl-field">
              <span className="ld-label">Email on invoices <em>Optional</em></span>
              <input type="email" value={form.email} maxLength={254} onChange={(e) => set({ email: e.target.value })} />
            </label>
            <label className="bl-field">
              <span className="ld-label">Phone on invoices <em>Optional</em></span>
              <input type="tel" value={form.phone} maxLength={40} onChange={(e) => set({ phone: e.target.value })} />
            </label>
          </div>
          <label className="bl-field">
            <span>Name on card statements (up to 22 characters)</span>
            <input value={form.statementName} maxLength={22} onChange={(e) => set({ statementName: e.target.value.toUpperCase() })} />
          </label>
        </fieldset>
        <fieldset className="bl-form" disabled={!owner || busy}>
          <legend className="bl-label">Invoices</legend>
          <div className="bl-row3">
            <label className="bl-field">
              <span>Number prefix</span>
              <input value={form.invoicePrefix} maxLength={8} onChange={(e) => set({ invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
            </label>
            <label className="bl-field">
              <span>Due after (days)</span>
              <input inputMode="numeric" value={form.termsDays} onChange={(e) => set({ termsDays: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
            </label>
            <div className="bl-field">
              <span>Next number</span>
              <strong className="bl-amount">
                {form.invoicePrefix || "XX"}-{String(merchant?.next_number ?? 1).padStart(4, "0")}
              </strong>
            </div>
          </div>
          <label className="bl-check">
            <input type="checkbox" checked={form.acceptCard} onChange={(e) => set({ acceptCard: e.target.checked })} />
            <span>Accept cards</span>
          </label>
          <label className="bl-check">
            <input type="checkbox" checked={form.acceptBank} onChange={(e) => set({ acceptBank: e.target.checked })} />
            <span>Accept bank transfers (ACH): the lowest fee, best for big bills</span>
          </label>
          <label className="bl-field">
            <span className="ld-label">Note on every invoice <em>Optional</em></span>
            <textarea value={form.defaultMemo} maxLength={1000} onChange={(e) => set({ defaultMemo: e.target.value })} placeholder="Payment is due within 15 days. Thank you for your business." />
          </label>
        </fieldset>
        <fieldset className="bl-form" disabled={!owner || busy}>
          <legend className="bl-label">Payout bank account</legend>
          {merchant?.payout?.last4 && !changeBank ? (
            <div className="bl-actions">
              <span className="bl-amount">
                {merchant.payout.bankName} •••• {merchant.payout.last4}
              </span>
              <button type="button" className="btn btn-quiet" onClick={() => setChangeBank(true)}>
                Change
              </button>
            </div>
          ) : (
            <CardFields value={bank} onChange={setBank} allowCard={false} errorField={bankField} disabled={!owner || busy} />
          )}
        </fieldset>
        {!merchant && owner && (
          <label className="bl-check">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              I'm allowed to take payments for this stable, and I agree to Stayblz's fees on payments made through Stayblz and to the <Link to="/legal">Terms of Use</Link>.
            </span>
          </label>
        )}
        <p className="bl-hint">When live payments are connected, the payment processor will also ask the owner to confirm identity and business details before money can be paid out.</p>
        {error && <p className="bl-error" role="alert">{error}</p>}
        {owner && (
          <div className="bl-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : merchant ? "Save settings" : "Set up payments"}
            </button>
          </div>
        )}
      </form>
      <div className="bl-actions bl-export">
        <span className="bl-muted">For your accountant or QuickBooks:</span>
        <button type="button" className="btn btn-quiet" onClick={() => void billing.exportCsv("payments")}>
          Payments (CSV)
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void billing.exportCsv("invoices")}>
          Invoices (CSV)
        </button>
      </div>
    </section>
  );
}
