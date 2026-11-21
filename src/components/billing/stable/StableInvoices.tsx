import { useState } from "react";
import { Link } from "react-router-dom";
import { dateText, invoiceStatusLabel, money } from "../billingApi";
import { useLoad } from "../useLoad";
import { useStableBilling } from "./stableBillingApi";

const FILTERS = [
  { id: "", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "open", label: "Due" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Cancelled" },
];

export default function StableInvoices() {
  const billing = useStableBilling();
  const [filter, setFilter] = useState("");
  const list = useLoad(() => billing.invoices(filter).then((r) => r.invoices), [billing, filter]);
  return (
    <section className="bl-card gx-glass" aria-labelledby="sb-inv-h">
      <div className="bl-card-head">
        <h2 id="sb-inv-h">Invoices</h2>
        <div className="bl-actions">
          <button type="button" className="btn btn-quiet" onClick={() => void billing.exportCsv("invoices")}>
            Export (CSV)
          </button>
          <Link className="btn btn-primary" to="/workspace/billing/invoices/new">
            New invoice
          </Link>
        </div>
      </div>
      <div className="bl-chips" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {list.error && (
        <p className="bl-error" role="alert">
          {list.error}{" "}
          <button type="button" className="bl-link" onClick={() => void list.reload()}>
            Try again
          </button>
        </p>
      )}
      {!list.data ? (
        !list.error && <p className="bl-muted" role="status">Loading invoices…</p>
      ) : list.data.length === 0 ? (
        <div className="bl-empty">
          <strong>{filter ? "No invoices here" : "No invoices yet"}</strong>
          Add charges and use <Link to="/workspace/billing/charges">Bill owners</Link>, or make a <Link to="/workspace/billing/invoices/new">new invoice</Link>.
        </div>
      ) : (
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="sr-only">Invoices</caption>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Client</th>
                <th scope="col">Due</th>
                <th scope="col" className="num">Total</th>
                <th scope="col" className="num">Balance</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((i) => {
                const s = invoiceStatusLabel(i);
                return (
                  <tr key={i.id} className={s.text === "Overdue" ? "is-flag" : undefined}>
                    <td>
                      <Link to={`/workspace/billing/invoices/${i.id}`}>{i.number ?? "Draft"}</Link>
                      <small>{dateText(i.issuedAt ?? i.createdAt)}</small>
                    </td>
                    <td>{i.billTo?.name}</td>
                    <td>{i.status === "open" ? dateText(i.dueOn) : ""}</td>
                    <td className="num">{money(i.total)}</td>
                    <td className="num">{i.status === "open" ? money(i.due) : ""}</td>
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
  );
}
