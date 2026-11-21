import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConfirm } from "../../ui/Confirm";
import { categoryLabel, dateText, invoiceStatusLabel, money, percent } from "../billingApi";
import { useLoad } from "../useLoad";
import ClientDialog from "./ClientDialog";
import { useStableBilling } from "./stableBillingApi";

/**
 * One customer (an owner, partnership or breeder the stable bills): contact details, what they owe and have paid,
 * their horses and shares, every invoice, and charges still waiting to be billed — with quick actions.
 */
export default function ClientDetail({ id }: { id: string }) {
  const billing = useStableBilling();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const page = useLoad(() => billing.client(id), [billing, id]);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (page.error && !page.data)
    return (
      <section className="bl-card gx-glass" role="alert">
        <p className="bl-error">{page.error}</p>
        <div className="bl-actions">
          <Link className="btn btn-quiet" to="/workspace/billing/clients">
            All clients
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => void page.reload()}>
            Try again
          </button>
        </div>
      </section>
    );
  if (!page.data) return <p className="bl-muted" role="status">Loading the client…</p>;
  const { client, horses, invoices, charges, totals } = page.data;
  const waiting = charges.reduce((n, c) => n + c.amount, 0);
  const issuedCount = invoices.filter((i) => i.status !== "draft" && i.status !== "void").length;

  return (
    <>
      <section className="bl-card gx-glass" aria-labelledby="sb-client-h">
        <div className="bl-card-head">
          <div>
            <span className="bl-kicker">CLIENT</span>
            <h2 id="sb-client-h">
              {client.name} {client.archived && <span className="bl-pill">Archived</span>}
            </h2>
          </div>
          <div className="bl-actions">
            <Link className="btn btn-primary" to={`/workspace/billing/invoices/new?clientId=${client.id}`}>
              New invoice
            </Link>
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={async () => {
                const ok = await confirm({
                  title: client.archived ? `Bring back ${client.name}?` : `Archive ${client.name}?`,
                  message: client.archived ? undefined : "They're hidden from lists and new bills. Their invoices and history stay.",
                  confirmLabel: client.archived ? "Bring back" : "Archive",
                });
                if (!ok) return;
                try {
                  await billing.archiveClient(client.id, !client.archived);
                  if (client.archived) void page.reload();
                  else navigate("/workspace/billing/clients");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "That didn't work.");
                }
              }}
            >
              {client.archived ? "Bring back" : "Archive"}
            </button>
          </div>
        </div>
        {notice && <p className="bl-ok" role="status">{notice}</p>}
        {error && <p className="bl-error" role="alert">{error}</p>}
        <p className="bl-muted">
          {[client.company, client.email, client.phone].filter(Boolean).join(" · ") || "No contact details yet."}
        </p>
        {client.notes && <p className="bl-memo">{client.notes}</p>}
      </section>

      <section className="bl-stats" aria-label="Account">
        <div className={`bl-stat${totals.overdue ? " is-warn" : ""}`}>
          <span>Owes now</span>
          <strong>{money(totals.owed)}</strong>
          <small>{totals.overdue ? `${money(totals.overdue)} overdue` : "Nothing overdue"}</small>
        </div>
        <div className="bl-stat">
          <span>Paid to date</span>
          <strong>{money(totals.paid)}</strong>
          <small>{totals.lastPaidAt ? `Last paid ${dateText(totals.lastPaidAt)}` : "No payments yet"}</small>
        </div>
        <div className="bl-stat">
          <span>Billed to date</span>
          <strong>{money(totals.billed)}</strong>
          <small>
            {issuedCount} invoice{issuedCount === 1 ? "" : "s"}
          </small>
        </div>
        <div className="bl-stat">
          <span>Waiting to be billed</span>
          <strong>{money(waiting)}</strong>
          <small>
            {charges.length} charge{charges.length === 1 ? "" : "s"} for this client
          </small>
        </div>
      </section>

      <div className="bl-two">
        <section className="bl-card gx-glass" aria-labelledby="sb-client-inv-h">
          <div className="bl-card-head">
            <h2 id="sb-client-inv-h">Invoices</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="bl-muted">No invoices yet.</p>
          ) : (
            <div className="bl-table-wrap">
              <table className="bl-table">
                <caption className="sr-only">Invoices for {client.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Due</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const s = invoiceStatusLabel(i);
                    return (
                      <tr key={i.id} className={s.text === "Overdue" ? "is-flag" : undefined}>
                        <td>
                          <Link to={`/workspace/billing/invoices/${i.id}`}>{i.number ?? "Draft"}</Link>
                          <small>{dateText(i.issuedAt ?? i.createdAt)}</small>
                        </td>
                        <td>{i.status === "open" ? dateText(i.dueOn) : ""}</td>
                        <td className="num">{money(i.total)}</td>
                        <td>
                          <span className={`bl-pill is-${s.tone}`}>{s.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="bl-page">
          <section className="bl-card gx-glass" aria-labelledby="sb-client-horses-h">
            <h2 id="sb-client-horses-h">Horses</h2>
            {horses.length === 0 ? (
              <p className="bl-muted">
                Not an owner of any horse here. Set owners in <Link to="/workspace/billing/clients">Clients</Link>.
              </p>
            ) : (
              <ul className="bl-list">
                {horses.map((h) => (
                  <li key={h.horseId}>
                    <span className="bl-list-main">
                      <strong>{h.name}</strong>
                    </span>
                    <span className="bl-amount">{percent(h.shareBps)} share</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="bl-card gx-glass" aria-labelledby="sb-client-charges-h">
            <h2 id="sb-client-charges-h">Charges waiting</h2>
            {charges.length === 0 ? (
              <p className="bl-muted">None billed straight to this client. Horse charges are split at Bill owners.</p>
            ) : (
              <ul className="bl-list">
                {charges.map((c) => (
                  <li key={c.id}>
                    <span className="bl-list-main">
                      <strong>{c.description}</strong>
                      <small>
                        {categoryLabel[c.category]} · {dateText(c.serviceOn)}
                      </small>
                    </span>
                    <span className="bl-amount">{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link className="btn btn-quiet" to="/workspace/billing/charges">
              Charges
            </Link>
          </section>
        </div>
      </div>
      {editing && (
        <ClientDialog
          client={client}
          onClose={() => setEditing(false)}
          onSaved={(c) => {
            setEditing(false);
            setNotice(`${c.name} saved.`);
            void page.reload();
          }}
        />
      )}
    </>
  );
}
