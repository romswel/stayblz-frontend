import type { ReactNode } from "react";
import { categoryLabel, channelLabel, dateText, invoiceStatusLabel, methodLabel, money, offlineLabel, percent, type Invoice } from "./billingApi";

/** The invoice / receipt itself: who it's from and to, every line, totals, payments and refunds. Prints cleanly. */
export default function InvoiceView({ invoice, actions, showFees = false }: { invoice: Invoice; actions?: ReactNode; showFees?: boolean }) {
  const status = invoiceStatusLabel(invoice);
  const lines = invoice.lines ?? [];
  const showShare = lines.some((l) => l.shareBps !== null && l.shareBps !== undefined);
  const showHorse = lines.some((l) => l.horseName);
  const payments = (invoice.payments ?? []).filter((p) => p.status !== "pending");
  return (
    <article className="bl-invoice gx-glass" aria-labelledby="bl-invoice-title">
      <header className="bl-invoice-head">
        <div>
          <span className="bl-kicker">{invoice.status === "paid" ? "RECEIPT" : invoice.status === "draft" ? "DRAFT INVOICE" : "INVOICE"}</span>
          <h2 id="bl-invoice-title">{invoice.number ?? "Draft"}</h2>
          <span className={`bl-pill is-${status.tone}`}>{status.text}</span>
          <span className="bl-pill is-test">Test</span>
        </div>
        <dl className="bl-invoice-dates">
          {invoice.issuedAt && (
            <div>
              <dt>Issued</dt>
              <dd>{dateText(invoice.issuedAt)}</dd>
            </div>
          )}
          {invoice.dueOn && invoice.status !== "paid" && (
            <div>
              <dt>Due</dt>
              <dd>{dateText(invoice.dueOn)}</dd>
            </div>
          )}
          {invoice.paidAt && (
            <div>
              <dt>Paid</dt>
              <dd>{dateText(invoice.paidAt)}</dd>
            </div>
          )}
          {invoice.voidedAt && (
            <div>
              <dt>Cancelled</dt>
              <dd>{dateText(invoice.voidedAt)}</dd>
            </div>
          )}
        </dl>
      </header>
      <div className="bl-invoice-parties">
        <div>
          <span className="bl-label">From</span>
          <strong>{invoice.from?.name || invoice.stableName || "Stayblz"}</strong>
          {invoice.from?.email && <span>{invoice.from.email}</span>}
          {invoice.from?.phone && <span>{invoice.from.phone}</span>}
        </div>
        <div>
          <span className="bl-label">Bill to</span>
          <strong>{invoice.billTo?.name || "—"}</strong>
          {invoice.billTo?.company && <span>{invoice.billTo.company}</span>}
          {invoice.billTo?.email && <span>{invoice.billTo.email}</span>}
          {invoice.billTo?.line1 && <span>{invoice.billTo.line1}</span>}
          {(invoice.billTo?.city || invoice.billTo?.postal) && <span>{[invoice.billTo.city, invoice.billTo.region, invoice.billTo.postal].filter(Boolean).join(", ")}</span>}
        </div>
      </div>
      <div className="bl-table-wrap">
        <table className="bl-table bl-lines">
          <caption className="sr-only">Invoice lines</caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              {showHorse && <th scope="col">Horse</th>}
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">Price</th>
              {showShare && <th scope="col" className="num">Share</th>}
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <span className="bl-line-desc">{l.description}</span>
                  <small>
                    {categoryLabel[l.category] ?? l.category}
                    {l.serviceOn ? ` · ${dateText(l.serviceOn)}` : ""}
                    {l.taxable ? " · Taxed" : ""}
                  </small>
                </td>
                {showHorse && <td>{l.horseName}</td>}
                <td className="num">{Number(l.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="num">{money(l.unit)}</td>
                {showShare && <td className="num">{l.shareBps ? percent(l.shareBps) : "100%"}</td>}
                <td className="num">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="bl-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{money(invoice.subtotal)}</dd>
        </div>
        {invoice.discount > 0 && (
          <div>
            <dt>Discount{invoice.couponCode ? ` (${invoice.couponCode})` : ""}</dt>
            <dd>−{money(invoice.discount)}</dd>
          </div>
        )}
        {invoice.tax > 0 && (
          <div>
            <dt>Tax ({percent(invoice.taxRateBps)})</dt>
            <dd>{money(invoice.tax)}</dd>
          </div>
        )}
        <div className="is-total">
          <dt>Total</dt>
          <dd>{money(invoice.total)}</dd>
        </div>
        {invoice.paid > 0 && (
          <div>
            <dt>Paid</dt>
            <dd>−{money(invoice.paid)}</dd>
          </div>
        )}
        {invoice.refunded > 0 && (
          <div>
            <dt>Refunded</dt>
            <dd>{money(invoice.refunded)}</dd>
          </div>
        )}
        {invoice.status === "open" && (
          <div className="is-due">
            <dt>Amount due</dt>
            <dd>{money(invoice.due)}</dd>
          </div>
        )}
      </dl>
      {invoice.memo && <p className="bl-memo">{invoice.memo}</p>}
      {invoice.periodStart && invoice.periodEnd && (
        <p className="bl-muted">
          Covers {dateText(invoice.periodStart)} to {dateText(invoice.periodEnd)}.
        </p>
      )}
      {payments.length > 0 && (
        <section className="bl-invoice-payments" aria-label="Payments">
          <h3>Payments</h3>
          <ul>
            {payments.map((p) => (
              <li key={p.id}>
                <span>
                  {dateText(p.createdAt)} · {p.channel === "offline" ? offlineLabel[p.offlineKind ?? ""] ?? "Recorded" : `${channelLabel[p.channel]}${methodLabel(p.method) ? ` · ${methodLabel(p.method)}` : ""}`}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className={`bl-pay-status is-${p.status}`}>
                  {p.status === "succeeded" ? "Paid" : p.status === "processing" ? "Clearing" : "Failed"}
                  {p.status === "failed" && p.failureMessage ? `: ${p.failureMessage}` : ""}
                </span>
                <strong>{money(p.amount)}</strong>
                {showFees && p.status === "succeeded" && p.fee !== undefined && p.fee > 0 && <small>Stayblz fee {money(p.fee)} · you get {money(p.amount - p.fee)}</small>}
                {p.refunded > 0 && <small>Refunded {money(p.refunded)}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {actions && <div className="bl-invoice-actions">{actions}</div>}
      <p className="bl-fineprint">Test mode: this {invoice.status === "paid" ? "receipt" : "invoice"} is from Stayblz's billing test. No real money moved.</p>
    </article>
  );
}
