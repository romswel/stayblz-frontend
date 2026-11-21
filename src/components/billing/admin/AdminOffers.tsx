import { useState } from "react";
import Modal from "../../Modal";
import DialogHead from "../../ui/DialogHead";
import { useConfirm } from "../../ui/Confirm";
import { centsToInput, dateText, money, parseDollars, per } from "../billingApi";
import { useLoad } from "../useLoad";
import { adminApi, type AdminCatalogItem } from "./adminApi";

const STATUS_WORDS = { draft: "Draft (hidden)", active: "On sale", retired: "Retired" } as const;
const FEATURES = [
  { id: "tv.watch", label: "STAYBLZ TV live races" },
  { id: "stallions.list", label: "Stallion Showcase" },
];

/** Plans and products: prices, trials, on sale or hidden. Price changes reach new subscribers only. */
export function AdminCatalog() {
  const list = useLoad(() => adminApi.catalog().then((r) => r.catalog), []);
  const [editing, setEditing] = useState<AdminCatalogItem | "new" | null>(null);
  const [notice, setNotice] = useState("");
  return (
    <section className="bl-card gx-glass" aria-labelledby="ab-cat-h">
      <div className="bl-card-head">
        <h2 id="ab-cat-h">Plans and products</h2>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          New plan
        </button>
      </div>
      <p className="bl-muted">Only "On sale" items are offered. Drafts are suggested prices for review. People already subscribed keep the price they signed up at.</p>
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      {list.error && <p className="bl-error" role="alert">{list.error}</p>}
      {list.data && (
        <ul className="bl-list">
          {list.data.map((c) => (
            <li key={c.id}>
              <span className="bl-list-main">
                <strong>
                  {c.name} <span className={`bl-pill ${c.status === "active" ? "is-ok" : ""}`}>{STATUS_WORDS[c.status]}</span>
                </strong>
                <small>
                  {c.kind === "plan" ? `Plan · ${c.family}${c.trialDays ? ` · ${c.trialDays}-day trial` : ""}` : `One-time · ${c.effectDays} days featured`} · id {c.id}
                </small>
              </span>
              <span className="bl-amount">
                {money(c.amount)}
                {per(c.interval)}
              </span>
              <button type="button" className="btn btn-quiet" onClick={() => setEditing(c)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <CatalogDialog
          item={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            setNotice(m);
            void list.reload();
          }}
        />
      )}
    </section>
  );
}

function CatalogDialog({ item, onClose, onSaved }: { item?: AdminCatalogItem; onClose: () => void; onSaved: (m: string) => void }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({
    id: item?.id ?? "",
    family: item?.family ?? "",
    kind: item?.kind ?? "plan",
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? centsToInput(item.amount) : "",
    interval: item?.interval ?? "month",
    trialDays: String(item?.trialDays ?? 0),
    status: item?.status ?? "draft",
    features: item?.features ?? ["tv.watch"],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Modal label={item ? `Edit ${item.name}` : "New plan"} onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker="CATALOG" title={item ? `Edit ${item.name}` : "New plan"} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const cents = parseDollars(form.price);
          if (cents === null || cents < 50) return setError("The price is at least $0.50.");
          if (item && item.status !== "active" && form.status === "active") {
            const ok = await confirm({ title: `Put ${form.name} on sale?`, message: `Members can buy it for ${money(cents)}${per(item.interval)} (test mode until a live processor is connected).`, confirmLabel: "Put on sale" });
            if (!ok) return;
          }
          if (item && item.status === "active" && cents !== item.amount) {
            const ok = await confirm({ title: `Change the price to ${money(cents)}?`, message: "New subscribers pay the new price. Current subscribers keep theirs.", confirmLabel: "Change price" });
            if (!ok) return;
          }
          setBusy(true);
          setError("");
          try {
            const body = { name: form.name, description: form.description, amount: cents, status: form.status, trialDays: Number(form.trialDays) || 0 };
            if (item) await adminApi.updateItem(item.id, body);
            else await adminApi.createItem({ ...body, id: form.id, family: form.family, kind: "plan", interval: form.interval, features: form.features });
            onSaved(`${form.name} saved.`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "It couldn't be saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {!item && (
          <div className="bl-row2">
            <label className="bl-field">
              <span>Id (lowercase, can't change)</span>
              <input value={form.id} maxLength={40} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} placeholder="barn_pro_monthly" />
            </label>
            <label className="bl-field">
              <span>Family (one plan per family per person)</span>
              <input value={form.family} maxLength={30} onChange={(e) => set({ family: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} placeholder="barn" />
            </label>
          </div>
        )}
        <label className="bl-field">
          <span>Name</span>
          <input value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="bl-field">
          <span className="ld-label">Description <em>Optional</em></span>
          <textarea value={form.description} maxLength={600} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <div className="bl-row3">
          <label className="bl-field">
            <span>Price ($)</span>
            <input inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} />
          </label>
          {form.kind === "plan" && (
            <>
              <label className="bl-field">
                <span>Billed</span>
                <select value={form.interval} onChange={(e) => set({ interval: e.target.value as "month" | "year" })} disabled={!!item}>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
              <label className="bl-field">
                <span>Free trial (days)</span>
                <input inputMode="numeric" value={form.trialDays} onChange={(e) => set({ trialDays: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
              </label>
            </>
          )}
        </div>
        {!item && (
          <fieldset className="bl-form">
            <legend className="bl-label">Unlocks</legend>
            {FEATURES.map((f) => (
              <label key={f.id} className="bl-check">
                <input type="checkbox" checked={form.features.includes(f.id)} onChange={(e) => set({ features: e.target.checked ? [...form.features, f.id] : form.features.filter((x) => x !== f.id) })} />
                <span>{f.label}</span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="bl-field">
          <span>Status</span>
          <select value={form.status} onChange={(e) => set({ status: e.target.value as AdminCatalogItem["status"] })}>
            <option value="draft">Draft (hidden)</option>
            <option value="active">On sale</option>
            <option value="retired">Retired (no new sign-ups; current subscribers stay)</option>
          </select>
        </label>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Promo codes for plans. */
export function AdminCoupons() {
  const confirm = useConfirm();
  const list = useLoad(() => adminApi.coupons().then((r) => r.coupons), []);
  const [form, setForm] = useState({ code: "", kind: "percent", value: "", duration: "once", months: "3", maxUses: "", expiresOn: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <section className="bl-card gx-glass" aria-labelledby="ab-codes-h">
      <h2 id="ab-codes-h">Promo codes</h2>
      <form
        className="bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const value = form.kind === "percent" ? Number(form.value) : parseDollars(form.value);
          if (!value || value <= 0) return setError(form.kind === "percent" ? "Enter a percentage from 1 to 100." : "Enter an amount off.");
          setBusy(true);
          try {
            await adminApi.createCoupon({
              code: form.code,
              percentOff: form.kind === "percent" ? value : null,
              amountOffCents: form.kind === "amount" ? value : null,
              duration: form.duration,
              durationMonths: form.duration === "repeating" ? Number(form.months) : null,
              maxRedemptions: form.maxUses ? Number(form.maxUses) : null,
              expiresOn: form.expiresOn || null,
              note: form.note,
            });
            setNotice(`${form.code.toUpperCase()} created.`);
            setForm((f) => ({ ...f, code: "", value: "", note: "" }));
            void list.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "The code couldn't be made.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="bl-row3">
          <label className="bl-field">
            <span>Code</span>
            <input value={form.code} maxLength={24} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="DERBYDAY" />
          </label>
          <label className="bl-field">
            <span>Discount</span>
            <span className="bl-input-with">
              <select value={form.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Discount type">
                <option value="percent">% off</option>
                <option value="amount">$ off</option>
              </select>
              <input inputMode="decimal" value={form.value} onChange={(e) => set({ value: e.target.value })} aria-label="Discount amount" />
            </span>
          </label>
          <label className="bl-field">
            <span>For</span>
            <select value={form.duration} onChange={(e) => set({ duration: e.target.value })}>
              <option value="once">The first payment</option>
              <option value="repeating">Several months</option>
              <option value="forever">Every payment</option>
            </select>
          </label>
        </div>
        <div className="bl-row3">
          {form.duration === "repeating" && (
            <label className="bl-field">
              <span>Months</span>
              <input inputMode="numeric" value={form.months} onChange={(e) => set({ months: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
            </label>
          )}
          <label className="bl-field">
            <span className="ld-label">Max uses <em>Optional</em></span>
            <input inputMode="numeric" value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value.replace(/\D/g, "") })} />
          </label>
          <label className="bl-field">
            <span className="ld-label">Ends <em>Optional</em></span>
            <input type="date" value={form.expiresOn} onChange={(e) => set({ expiresOn: e.target.value })} />
          </label>
        </div>
        {error && <p className="bl-error" role="alert">{error}</p>}
        {notice && <p className="bl-ok" role="status">{notice}</p>}
        <div className="bl-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !form.code}>
            {busy ? "Creating…" : "Create code"}
          </button>
        </div>
      </form>
      {list.data && list.data.length > 0 && (
        <ul className="bl-list">
          {list.data.map((c) => (
            <li key={c.code}>
              <span className="bl-list-main">
                <strong>
                  {c.code} {!c.active && <span className="bl-pill">Off</span>}
                </strong>
                <small>
                  {c.percentOff ? `${c.percentOff}% off` : `${money(c.amountOff ?? 0)} off`} · {c.duration === "once" ? "first payment" : c.duration === "forever" ? "every payment" : `${c.durationMonths} payments`} · used {c.redeemed}
                  {c.maxRedemptions ? ` of ${c.maxRedemptions}` : ""}
                  {c.expiresAt ? ` · ends ${dateText(c.expiresAt)}` : ""}
                </small>
              </span>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={async () => {
                  if (c.active && !(await confirm({ title: `Switch off ${c.code}?`, message: "Nobody new can use it. People who already used it keep their discount.", confirmLabel: "Switch off" }))) return;
                  try {
                    await adminApi.setCouponActive(c.code, !c.active);
                    void list.reload();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "That didn't work.");
                  }
                }}
              >
                {c.active ? "Switch off" : "Switch on"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Free access for a person (press, partners, the team, testers), with an optional end date. */
export function AdminGrants() {
  const confirm = useConfirm();
  const list = useLoad(() => adminApi.grants().then((r) => r.grants), []);
  const [form, setForm] = useState({ email: "", feature: "tv.watch", reason: "", endsOn: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <section className="bl-card gx-glass" aria-labelledby="ab-grants-h">
      <h2 id="ab-grants-h">Free access</h2>
      <p className="bl-muted">Gives someone a paid feature without a plan. Staff (admins) can always open paid features to check them.</p>
      <form
        className="bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await adminApi.createGrant(form);
            setNotice(`Access given to ${form.email}.`);
            setForm({ email: "", feature: "tv.watch", reason: "", endsOn: "" });
            void list.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "It couldn't be given.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="bl-row2">
          <label className="bl-field">
            <span>Account email</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="bl-field">
            <span>Access to</span>
            <select value={form.feature} onChange={(e) => setForm({ ...form, feature: e.target.value })}>
              {FEATURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="bl-row2">
          <label className="bl-field">
            <span className="ld-label">Reason <em>Optional</em></span>
            <input value={form.reason} maxLength={200} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Press pass" />
          </label>
          <label className="bl-field">
            <span className="ld-label">Ends <em>Optional</em></span>
            <input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
          </label>
        </div>
        {error && <p className="bl-error" role="alert">{error}</p>}
        {notice && <p className="bl-ok" role="status">{notice}</p>}
        <div className="bl-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Giving…" : "Give access"}
          </button>
        </div>
      </form>
      {list.data && list.data.length > 0 && (
        <ul className="bl-list">
          {list.data.map((g) => (
            <li key={g.id}>
              <span className="bl-list-main">
                <strong>
                  {g.account.name || g.account.email} {g.revokedAt && <span className="bl-pill">Ended</span>}
                </strong>
                <small>
                  {FEATURES.find((f) => f.id === g.feature)?.label ?? g.feature}
                  {g.reason ? ` · ${g.reason}` : ""}
                  {g.endsAt ? ` · until ${dateText(g.endsAt)}` : " · no end date"}
                </small>
              </span>
              {!g.revokedAt && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={async () => {
                    if (!(await confirm({ title: `End ${g.account.email}'s free access?`, confirmLabel: "End access", tone: "danger" }))) return;
                    try {
                      await adminApi.revokeGrant(g.id);
                      void list.reload();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "That didn't work.");
                    }
                  }}
                >
                  End
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
