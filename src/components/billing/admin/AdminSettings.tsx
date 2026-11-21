import { useState } from "react";
import { useConfirm } from "../../ui/Confirm";
import { money, percent } from "../billingApi";
import { adminApi, feeFor, type AdminSettings as Settings, type Rate, type Rates } from "./adminApi";

const CHANNELS = [
  { id: "card", label: "Card (online, pay link)" },
  { id: "bank", label: "Bank transfer (ACH)" },
  { id: "keyed", label: "Card typed in (phone)" },
  { id: "reader", label: "Card reader (in person)" },
] as const;
const SAMPLES = [1000, 5000, 10000, 50000, 100000, 500000];

type Draft = Record<string, { pct: string; fixed: string; cap: string }>;
const toDraft = (r: Rates): Draft =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { pct: String(v.bps / 100), fixed: v.fixed ? (v.fixed / 100).toFixed(2) : "", cap: v.cap ? (v.cap / 100).toFixed(2) : "" }]));
function fromDraft(d: Draft): Rates {
  const out = {} as Rates;
  for (const c of CHANNELS) {
    const v = d[c.id];
    out[c.id] = { bps: Math.round(Number(v.pct || 0) * 100), fixed: Math.round(Number(v.fixed || 0) * 100), cap: Math.round(Number(v.cap || 0) * 100) };
  }
  return out;
}
const rateText = (r: Rate) => `${percent(r.bps)}${r.fixed ? ` + ${money(r.fixed)}` : ""}${r.cap ? `, max ${money(r.cap)}` : ""}`;

/**
 * Fees Stayblz takes on stable payments, what the processor is expected to cost, and the margin on typical
 * amounts (red = Stayblz loses money). Also the paid-access switch. Changing them needs a superadmin.
 */
export default function AdminSettings({ settings, superadmin, provider, onSaved }: { settings: Settings; superadmin: boolean; provider: { live: boolean; liveAvailable: boolean }; onSaved: () => void }) {
  const confirm = useConfirm();
  const [fees, setFees] = useState(toDraft(settings.fees));
  const [costs, setCosts] = useState(toDraft(settings.costs));
  const [payoutDelay, setPayoutDelay] = useState(String(settings.payoutDelayDays));
  const [settle, setSettle] = useState(String(settings.bankSettleMinutes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const feeRates = fromDraft(fees);
  const costRates = fromDraft(costs);

  async function save(extra: Partial<Settings> = {}) {
    setBusy(true);
    setError("");
    try {
      await adminApi.saveSettings({
        enforcePaywalls: settings.enforcePaywalls,
        fees: feeRates,
        costs: costRates,
        payoutDelayDays: Number(payoutDelay),
        bankSettleMinutes: Number(settle),
        ...extra,
      });
      setNotice("Saved.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The settings couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  const rateInputs = (draft: Draft, setDraft: (d: Draft) => void, prefix: string) =>
    CHANNELS.map((c) => (
      <div className="bl-fee-box" key={c.id}>
        <h3>{c.label}</h3>
        <div className="bl-row3">
          <label className="bl-field">
            <span>%</span>
            <input inputMode="decimal" value={draft[c.id].pct} disabled={!superadmin || busy} aria-label={`${prefix} ${c.label} percent`} onChange={(e) => setDraft({ ...draft, [c.id]: { ...draft[c.id], pct: e.target.value.replace(/[^\d.]/g, "") } })} />
          </label>
          <label className="bl-field">
            <span>+ $</span>
            <input inputMode="decimal" value={draft[c.id].fixed} placeholder="0.00" disabled={!superadmin || busy} aria-label={`${prefix} ${c.label} fixed`} onChange={(e) => setDraft({ ...draft, [c.id]: { ...draft[c.id], fixed: e.target.value.replace(/[^\d.]/g, "") } })} />
          </label>
          <label className="bl-field">
            <span>Max $</span>
            <input inputMode="decimal" value={draft[c.id].cap} placeholder="none" disabled={!superadmin || busy} aria-label={`${prefix} ${c.label} cap`} onChange={(e) => setDraft({ ...draft, [c.id]: { ...draft[c.id], cap: e.target.value.replace(/[^\d.]/g, "") } })} />
          </label>
        </div>
      </div>
    ));

  return (
    <>
      <section className="bl-card gx-glass" aria-labelledby="ab-mode-h">
        <h2 id="ab-mode-h">Mode and paid access</h2>
        <ul className="bl-list">
          <li>
            <span className="bl-list-main">
              <strong>Payments: {settings.mode === "test" ? "Test mode" : "Live"}</strong>
              <small>
                {provider.liveAvailable
                  ? "A live processor is connected."
                  : "No live payment processor is connected yet, so only Stayblz test cards work and no real money moves. Going live needs a processor account (docs/billing.md)."}
              </small>
            </span>
            <button type="button" className="btn btn-quiet" disabled>
              Go live
            </button>
          </li>
          <li>
            <span className="bl-list-main">
              <strong>Paid access: {settings.enforcePaywalls ? "On" : "Off"}</strong>
              <small>
                {settings.enforcePaywalls
                  ? "STAYBLZ TV live races need the TV Pass (or free access). Staff can always watch."
                  : "Everyone can watch STAYBLZ TV. Plans can still be bought and tested."}
              </small>
            </span>
            {superadmin && (
              <button
                type="button"
                className={settings.enforcePaywalls ? "btn btn-quiet" : "btn btn-primary"}
                disabled={busy}
                onClick={async () => {
                  const on = !settings.enforcePaywalls;
                  const ok = await confirm({
                    title: on ? "Turn paid access on?" : "Turn paid access off?",
                    message: on
                      ? "Members without the STAYBLZ TV Pass (or free access) can no longer watch live races. While billing is in test mode they can subscribe with a test card."
                      : "Everyone can watch STAYBLZ TV again. Subscriptions keep running.",
                    confirmLabel: on ? "Turn on" : "Turn off",
                    tone: on ? "danger" : "default",
                  });
                  // Only the switch changes here: unsaved fee edits stay unsaved.
                  if (ok) await save({ enforcePaywalls: on, fees: settings.fees, costs: settings.costs, payoutDelayDays: settings.payoutDelayDays, bankSettleMinutes: settings.bankSettleMinutes });
                }}
              >
                {settings.enforcePaywalls ? "Turn off" : "Turn on"}
              </button>
            )}
          </li>
        </ul>
      </section>

      <section className="bl-card gx-glass" aria-labelledby="ab-fees-h">
        <h2 id="ab-fees-h">Stayblz fees on stable payments</h2>
        <p className="bl-muted">Taken from each payment a stable's client makes through Stayblz. Cash and cheques a stable records are free. {!superadmin && "Only a superadmin can change these."}</p>
        <div className="bl-fees-grid">{rateInputs(fees, setFees, "Fee")}</div>
        <h2 className="bl-subhead">What the processor is expected to charge Stayblz</h2>
        <p className="bl-muted">Estimates for the margin check (published US list prices: online card 2.9% + $0.30, ACH 0.8% max $5, keyed 3.4% + $0.30, in-person 2.7% + $0.05). Connect payouts add about 0.25% + $0.25 per payout and $2 per active stable each month.</p>
        <div className="bl-fees-grid">{rateInputs(costs, setCosts, "Cost")}</div>
      </section>

      <section className="bl-card gx-glass" aria-labelledby="ab-margin-h">
        <h2 id="ab-margin-h">Margin check</h2>
        <p className="bl-muted">What Stayblz keeps on one payment, after the processor's cost. Red: Stayblz loses money on that payment. Add a fixed part (e.g. $0.30) to fix small card payments.</p>
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="sr-only">Margin per payment</caption>
            <thead>
              <tr>
                <th scope="col">Payment</th>
                {CHANNELS.map((c) => (
                  <th scope="col" className="num" key={c.id}>
                    {c.label.split(" (")[0]}
                    <small>{rateText(feeRates[c.id])}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLES.map((a) => (
                <tr key={a}>
                  <td>{money(a)}</td>
                  {CHANNELS.map((c) => {
                    const m = feeFor(feeRates[c.id], a) - feeFor(costRates[c.id], a);
                    return (
                      <td className={`num ${m < 0 ? "bl-neg" : "bl-pos"}`} key={c.id}>
                        {m < 0 ? "−" : ""}
                        {money(Math.abs(m))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bl-card gx-glass" aria-labelledby="ab-timing-h">
        <h2 id="ab-timing-h">Timing</h2>
        <div className="bl-row2">
          <label className="bl-field">
            <span>Card money ready for payout after (days)</span>
            <input inputMode="numeric" value={payoutDelay} disabled={!superadmin || busy} onChange={(e) => setPayoutDelay(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </label>
          <label className="bl-field">
            <span>Test bank transfers clear after (minutes)</span>
            <input inputMode="numeric" value={settle} disabled={!superadmin || busy} onChange={(e) => setSettle(e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </label>
        </div>
        {error && <p className="bl-error" role="alert">{error}</p>}
        {notice && <p className="bl-ok" role="status">{notice}</p>}
        {superadmin && (
          <div className="bl-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({ title: "Save fees and timing?", message: "New fees apply to payments made from now on. Payments already made keep their fee.", confirmLabel: "Save" });
                if (ok) await save();
              }}
            >
              {busy ? "Saving…" : "Save fees and timing"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
