import { useState } from "react";
import { useAuth } from "../../auth";
import { useConfirm } from "../ui/Confirm";
import { accountDraftKey, clearDraft, useDraft } from "../ui/useDraft";
import AddMethodDialog from "./AddMethodDialog";
import { billingApi, methodLabel, type Overview } from "./billingApi";

/** Saved cards and bank accounts, billing details, and autopay for stables that bill you. */
export default function PaymentMethods({ data, onChanged, notify }: { data: Overview; onChanged: () => void; notify: (t: string) => void }) {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const defaultId = data.profile?.defaultMethodId ?? null;
  const usedBy = (id: string) => data.subscriptions.filter((s) => s.methodId === id && ["trialing", "active", "past_due"].includes(s.status));

  async function run(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    setError("");
    try {
      await fn();
      notify(done);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy("");
    }
  }

  const draftKey = accountDraftKey(user?.id, "billing-details");
  const initial = {
    name: data.profile?.name ?? "",
    email: data.profile?.email ?? "",
    line1: data.profile?.line1 ?? "",
    line2: data.profile?.line2 ?? "",
    city: data.profile?.city ?? "",
    region: data.profile?.region ?? "",
    postal: data.profile?.postal ?? "",
    country: data.profile?.country ?? "US",
  };
  const [details, setDetails, discardDetails, restored] = useDraft(draftKey, initial);
  const [savedOnce, setSavedOnce] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState("");

  return (
    <>
      <section className="bl-card gx-glass" aria-labelledby="bl-methods-title">
        <div className="bl-card-head">
          <h2 id="bl-methods-title">Cards and bank accounts</h2>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            Add
          </button>
        </div>
        {error && <p className="bl-error" role="alert">{error}</p>}
        {data.methods.length === 0 ? (
          <div className="bl-empty">
            <strong>Nothing saved</strong>
            Add a card or bank account to subscribe or pay bills.
          </div>
        ) : (
          <ul className="bl-list">
            {data.methods.map((m) => {
              const subs = usedBy(m.id);
              return (
                <li key={m.id}>
                  <span className="bl-list-main">
                    <strong>
                      {methodLabel(m)} {m.id === defaultId && <span className="bl-pill is-ok">Default</span>} {m.test && <span className="bl-pill is-test">Test</span>}
                    </strong>
                    <small>
                      {m.type === "card" ? `Expires ${String(m.expMonth).padStart(2, "0")}/${m.expYear}` : "Bank account (ACH)"}
                      {m.holderName ? ` · ${m.holderName}` : ""}
                      {subs.length ? ` · pays ${subs.map((s) => s.plan?.name).join(", ")}` : ""}
                    </small>
                  </span>
                  <span className="bl-actions">
                    {m.id !== defaultId && (
                      <button type="button" className="btn btn-quiet" disabled={!!busy} onClick={() => run(m.id, () => billingApi.setDefault(m.id), `${methodLabel(m)} is now your default.`)}>
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={!!busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove ${methodLabel(m)}?`,
                          message: subs.length ? "Your plans move to your other saved card. Autopay that uses it is switched off." : "Autopay that uses it is switched off.",
                          confirmLabel: "Remove",
                          tone: "danger",
                        });
                        if (ok) await run(m.id, () => billingApi.removeMethod(m.id), `${methodLabel(m)} was removed.`);
                      }}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="bl-hint">Stayblz keeps only the last 4 digits and the expiry date. Full card numbers and security codes are never stored.</p>
      </section>

      {data.billers.length > 0 && (
        <section className="bl-card gx-glass" id="autopay" aria-labelledby="bl-autopay-title">
          <h2 id="bl-autopay-title">Autopay</h2>
          <p className="bl-muted">Pay a stable's bills automatically on their due date. You hear about every payment, and can switch it off any time.</p>
          <ul className="bl-list">
            {data.billers.map((b) => {
              const on = data.autopay.find((a) => a.stableId === b.stableId);
              return (
                <AutopayRow key={b.stableId} stable={b} current={on?.methodId ?? null} data={data} busy={busy === b.stableId} disabled={!!busy}
                  onSave={(methodId) => run(b.stableId, () => billingApi.setAutopay(b.stableId, methodId), `Autopay is on for ${b.stableName}.`)}
                  onOff={async () => {
                    const ok = await confirm({ title: `Turn off autopay for ${b.stableName}?`, message: "Their bills will wait for you to pay them.", confirmLabel: "Turn off" });
                    if (ok) await run(b.stableId, () => billingApi.removeAutopay(b.stableId), `Autopay is off for ${b.stableName}.`);
                  }}
                />
              );
            })}
          </ul>
        </section>
      )}

      <section className="bl-card gx-glass" aria-labelledby="bl-details-title">
        <h2 id="bl-details-title">Billing details</h2>
        <p className="bl-muted">Shown on your invoices and receipts.</p>
        {restored && !savedOnce && (
          <p className="bl-hint" role="status">
            We kept what you typed.{" "}
            <button type="button" className="bl-link" onClick={discardDetails}>
              Discard
            </button>
          </p>
        )}
        <form
          className="bl-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSavingDetails(true);
            setDetailsMsg("");
            try {
              await billingApi.saveProfile(details);
              clearDraft(draftKey);
              setSavedOnce(true);
              setDetailsMsg("Saved.");
              onChanged();
            } catch (err) {
              setDetailsMsg(err instanceof Error ? err.message : "They couldn't be saved.");
            } finally {
              setSavingDetails(false);
            }
          }}
        >
          <div className="bl-row2">
            <label className="bl-field">
              <span>Name or business</span>
              <input value={details.name} maxLength={120} onChange={(e) => setDetails({ ...details, name: e.target.value })} autoComplete="name" />
            </label>
            <label className="bl-field">
              <span className="ld-label">Receipt email <em>Optional</em></span>
              <input type="email" value={details.email} maxLength={254} onChange={(e) => setDetails({ ...details, email: e.target.value })} autoComplete="email" />
            </label>
          </div>
          <label className="bl-field">
            <span className="ld-label">Address <em>Optional</em></span>
            <input value={details.line1} maxLength={120} onChange={(e) => setDetails({ ...details, line1: e.target.value })} autoComplete="address-line1" />
          </label>
          <div className="bl-row3">
            <label className="bl-field">
              <span>City</span>
              <input value={details.city} maxLength={80} onChange={(e) => setDetails({ ...details, city: e.target.value })} autoComplete="address-level2" />
            </label>
            <label className="bl-field">
              <span>State</span>
              <input value={details.region} maxLength={80} onChange={(e) => setDetails({ ...details, region: e.target.value })} autoComplete="address-level1" />
            </label>
            <label className="bl-field">
              <span>ZIP</span>
              <input value={details.postal} maxLength={20} onChange={(e) => setDetails({ ...details, postal: e.target.value })} autoComplete="postal-code" />
            </label>
          </div>
          <div className="bl-actions">
            <button type="submit" className="btn btn-primary" disabled={savingDetails}>
              {savingDetails ? "Saving…" : "Save details"}
            </button>
            {detailsMsg && <span className="bl-muted" role="status">{detailsMsg}</span>}
          </div>
        </form>
      </section>

      {adding && (
        <AddMethodDialog
          first={data.methods.length === 0}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            notify("Saved.");
            onChanged();
          }}
        />
      )}
    </>
  );
}

function AutopayRow({
  stable,
  current,
  data,
  busy,
  disabled,
  onSave,
  onOff,
}: {
  stable: { stableId: string; stableName: string };
  current: string | null;
  data: Overview;
  busy: boolean;
  disabled: boolean;
  onSave: (methodId: string) => void;
  onOff: () => void;
}) {
  const [methodId, setMethodId] = useState(current ?? data.profile?.defaultMethodId ?? data.methods[0]?.id ?? "");
  return (
    <li>
      <span className="bl-list-main">
        <strong>{stable.stableName}</strong>
        <small>{current ? `On · ${methodLabel(data.methods.find((m) => m.id === current))}` : "Off"}</small>
      </span>
      {data.methods.length > 0 ? (
        <span className="bl-actions">
          <label className="bl-field">
            <span className="sr-only">Pay {stable.stableName} with</span>
            <select value={methodId} onChange={(e) => setMethodId(e.target.value)} disabled={disabled}>
              {data.methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={disabled || !methodId || methodId === current} onClick={() => onSave(methodId)}>
            {busy ? "Saving…" : current ? "Change" : "Turn on"}
          </button>
          {current && (
            <button type="button" className="btn btn-quiet" disabled={disabled} onClick={onOff}>
              Turn off
            </button>
          )}
        </span>
      ) : (
        <small className="bl-muted">Add a card first.</small>
      )}
    </li>
  );
}
