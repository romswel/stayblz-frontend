import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../../Modal";
import DialogHead from "../../ui/DialogHead";
import { useConfirm } from "../../ui/Confirm";
import { money, percent } from "../billingApi";
import { useLoad } from "../useLoad";
import ClientDialog from "./ClientDialog";
import { useStableBilling, type Client, type HorseOwners } from "./stableBillingApi";

/** Clients (owners you bill), what each owes, and who owns what share of each horse. */
export default function StableClients() {
  const billing = useStableBilling();
  const confirm = useConfirm();
  const [archived, setArchived] = useState(false);
  const clients = useLoad(() => billing.clients(archived).then((r) => r.clients), [billing, archived]);
  const horses = useLoad(() => billing.horses().then((r) => r.horses), [billing]);
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [owners, setOwners] = useState<HorseOwners | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return (
    <>
      <section className="bl-card gx-glass" aria-labelledby="sb-clients-h">
        <div className="bl-card-head">
          <h2 id="sb-clients-h">Clients</h2>
          <div className="bl-actions">
            <button type="button" className="btn btn-quiet" aria-pressed={archived} onClick={() => setArchived((a) => !a)}>
              {archived ? "Hide archived" : "Show archived"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              New client
            </button>
          </div>
        </div>
        {notice && <p className="bl-ok" role="status">{notice}</p>}
        {(clients.error || error) && <p className="bl-error" role="alert">{clients.error || error}</p>}
        {!clients.data ? (
          !clients.error && <p className="bl-muted" role="status">Loading clients…</p>
        ) : clients.data.length === 0 ? (
          <div className="bl-empty">
            <strong>No clients yet</strong>
            Add the owners you bill, then give each horse its owners and shares below.
          </div>
        ) : (
          <ul className="bl-list">
            {clients.data.map((c) => (
              <li key={c.id}>
                <span className="bl-list-main">
                  <Link to={`/workspace/billing/clients/${c.id}`}>
                    {c.name} {c.archived && <span className="bl-pill">Archived</span>}
                  </Link>
                  <small>{[c.company, c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}</small>
                </span>
                <span className="bl-amount">
                  {c.owed ? `${money(c.owed)} owed` : "Nothing owed"}
                  {c.overdue ? <small className="bl-error"> · {money(c.overdue)} overdue</small> : null}
                </span>
                <span className="bl-actions">
                  <Link className="btn btn-quiet" to={`/workspace/billing/invoices/new?clientId=${c.id}`}>
                    Invoice
                  </Link>
                  <button type="button" className="btn btn-quiet" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={async () => {
                      const ok = await confirm({
                        title: c.archived ? `Bring back ${c.name}?` : `Archive ${c.name}?`,
                        message: c.archived ? undefined : "They're hidden from lists and new bills. Their invoices and history stay.",
                        confirmLabel: c.archived ? "Bring back" : "Archive",
                      });
                      if (!ok) return;
                      try {
                        await billing.archiveClient(c.id, !c.archived);
                        void clients.reload();
                        void horses.reload();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "That didn't work.");
                      }
                    }}
                  >
                    {c.archived ? "Bring back" : "Archive"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bl-card gx-glass" aria-labelledby="sb-owners-h">
        <h2 id="sb-owners-h">Who pays for each horse</h2>
        <p className="bl-muted">Owner shares split every charge for the horse. Shares under 100% leave the rest unbilled (the stable's own part).</p>
        {horses.error && <p className="bl-error" role="alert">{horses.error}</p>}
        {!horses.data ? (
          !horses.error && <p className="bl-muted" role="status">Loading horses…</p>
        ) : horses.data.length === 0 ? (
          <div className="bl-empty">
            <strong>No horses in this stable</strong>
            Add them in <Link to="/inventory">Inventory</Link>.
          </div>
        ) : (
          <ul className="bl-list">
            {horses.data.map((h) => (
              <li key={h.id}>
                <span className="bl-list-main">
                  <strong>{h.name}</strong>
                  <small>{h.owners.length ? h.owners.map((o) => `${o.name} ${percent(o.shareBps)}`).join(" · ") : "No owners yet: its charges wait"}</small>
                </span>
                <span className={`bl-pill ${h.billedBps === 10000 ? "is-ok" : h.billedBps ? "is-warn" : "is-danger"}`}>{percent(h.billedBps)} billed</span>
                <button type="button" className="btn btn-quiet" onClick={() => setOwners(h)} disabled={!clients.data?.length}>
                  Owners
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <ClientDialog
          client={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            setEditing(null);
            setNotice(`${c.name} saved.`);
            void clients.reload();
          }}
        />
      )}
      {owners && (
        <OwnersDialog
          horse={owners}
          clients={(clients.data ?? []).filter((c) => !c.archived)}
          onClose={() => setOwners(null)}
          onSaved={() => {
            setOwners(null);
            setNotice(`Owners of ${owners.name} saved.`);
            void horses.reload();
          }}
        />
      )}
    </>
  );
}

function OwnersDialog({ horse, clients, onClose, onSaved }: { horse: HorseOwners; clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const billing = useStableBilling();
  const [rows, setRows] = useState(horse.owners.length ? horse.owners.map((o) => ({ clientId: o.clientId, share: String(o.shareBps / 100) })) : [{ clientId: clients[0]?.id ?? "", share: "100" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bps = rows.map((r) => Math.round(Number(r.share) * 100));
  const total = bps.reduce((n, b) => n + (Number.isFinite(b) ? b : 0), 0);
  return (
    <Modal label={`Owners of ${horse.name}`} onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker="OWNERSHIP" title={`Who owns ${horse.name}`} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (rows.some((r) => !r.clientId)) return setError("Choose a client on every row.");
          if (new Set(rows.map((r) => r.clientId)).size !== rows.length) return setError("Each client can be listed once.");
          if (bps.some((b) => !Number.isFinite(b) || b < 1 || b > 10000)) return setError("Each share is between 0.01% and 100%.");
          if (total > 10000) return setError("Shares can't add up to more than 100%.");
          setBusy(true);
          setError("");
          try {
            await billing.setOwners(horse.id, rows.map((r, i) => ({ clientId: r.clientId, shareBps: bps[i] })));
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : "The owners couldn't be saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {rows.map((r, i) => (
          <div className="bl-row3" key={i}>
            <label className="bl-field">
              <span>Owner</span>
              <select value={r.clientId} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, clientId: e.target.value } : x)))}>
                <option value="">Choose</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="bl-field">
              <span>Share %</span>
              <input inputMode="decimal" value={r.share} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, share: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
            </label>
            <button type="button" className="btn btn-quiet bl-row-remove" onClick={() => setRows((all) => all.filter((_, j) => j !== i))} disabled={rows.length === 1 && !horse.owners.length}>
              Remove
            </button>
          </div>
        ))}
        <div className="bl-actions">
          <button type="button" className="btn btn-quiet" onClick={() => setRows((all) => [...all, { clientId: "", share: String(Math.max(0, (10000 - total) / 100)) }])} disabled={rows.length >= 20}>
            Add owner
          </button>
          <span className={total > 10000 ? "bl-error" : "bl-muted"}>
            Total {percent(total)}
            {total < 10000 && total > 0 ? ` · the stable keeps ${percent(10000 - total)}` : ""}
          </span>
        </div>
        <p className="bl-hint">Changes apply to charges billed from now on. Invoices already made keep their shares.</p>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : rows.length ? "Save owners" : "Remove all owners"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
