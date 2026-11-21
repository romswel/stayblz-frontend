import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { billingApi, dateText, downloadCsv, invoiceStatusLabel, money, type Invoice } from "./billingApi";

/** Your invoices and receipts (Stayblz plans and purchases, and bills from stables), newest first. */
export default function BillingHistory() {
  const [items, setItems] = useState<Invoice[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvError, setCsvError] = useState("");
  const generation = useRef(0);

  const load = useCallback(async (before?: string) => {
    const mine = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const { invoices } = await billingApi.invoices(before);
      if (mine !== generation.current) return;
      setItems((old) => (before ? [...(old ?? []), ...invoices] : invoices));
      setMore(invoices.length === 30);
    } catch (e) {
      if (mine === generation.current) setError(e instanceof Error ? e.message : "Your invoices couldn't be loaded.");
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="bl-card gx-glass" aria-labelledby="bl-history-h">
      <div className="bl-card-head">
        <h2 id="bl-history-h">Invoices and receipts</h2>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => downloadCsv("/api/billing/payments.csv", "stayblz-payments.csv").then(() => setCsvError("")).catch((e) => setCsvError(e instanceof Error ? e.message : "The file couldn't be made."))}
        >
          Download payments (CSV)
        </button>
      </div>
      {csvError && <p className="bl-error" role="alert">{csvError}</p>}
      {error && (
        <p className="bl-error" role="alert">
          {error}{" "}
          <button type="button" className="bl-link" onClick={() => load()}>
            Try again
          </button>
        </p>
      )}
      {items === null ? (
        !error && <p role="status" className="bl-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bl-empty">
          <strong>No invoices yet</strong>
          Receipts for plans and bills you pay appear here.
        </div>
      ) : (
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="sr-only">Your invoices and receipts</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Invoice</th>
                <th scope="col">From</th>
                <th scope="col" className="num">Total</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const s = invoiceStatusLabel(i);
                return (
                  <tr key={i.id}>
                    <td>{dateText(i.issuedAt ?? i.createdAt)}</td>
                    <td>
                      <Link to={`/billing/invoices/${i.id}`}>{i.number}</Link>
                    </td>
                    <td>{i.issuer === "stable" ? i.stableName : "Stayblz"}</td>
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
      {more && (
        <button type="button" className="btn btn-quiet" disabled={loading} onClick={() => load(items?.[items.length - 1]?.createdAt)}>
          {loading ? "Loading…" : "Show older"}
        </button>
      )}
    </section>
  );
}
