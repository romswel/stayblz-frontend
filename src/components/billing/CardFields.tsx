import { useId, useState } from "react";
import { TEST_BANKS, TEST_CARDS, bankToken, brandOf, cardToken, digitsOnly, formatCardNumber, luhn } from "./testCards";

/**
 * Card or bank account fields. Test mode: only Stayblz test numbers are accepted, and the number is turned
 * into a test token right here: the number, expiry check digits and security code never leave the page.
 * Never kept in a draft (site rule: no payment details in drafts).
 */
export type CardValue = {
  kind: "card" | "bank";
  name: string;
  number: string;
  expiry: string;
  cvc: string;
  postal: string;
  routing: string;
  account: string;
  accountType: "checking" | "savings";
};
export const emptyCard = (kind: "card" | "bank" = "card"): CardValue => ({
  kind,
  name: "",
  number: "",
  expiry: "",
  cvc: "",
  postal: "",
  routing: "",
  account: "",
  accountType: "checking",
});
export type CardPayload =
  | { type: "card"; token: string; holderName: string; expMonth: number; expYear: number }
  | { type: "bank"; token: string; holderName: string };

export function cardPayload(v: CardValue, now = new Date()): { payload?: CardPayload; error?: string; field?: string } {
  const name = v.name.trim();
  if (v.kind === "bank") {
    if (!name) return { error: "Enter the account holder's name.", field: "name" };
    const routing = digitsOnly(v.routing);
    if (routing.length !== 9) return { error: "A routing number has 9 digits.", field: "routing" };
    const account = digitsOnly(v.account);
    if (account.length < 4 || account.length > 17) return { error: "Check the account number.", field: "account" };
    const token = bankToken(routing, account);
    if (!token) return { error: "Test mode: use one of the Stayblz test bank accounts below. Real accounts can't be used yet.", field: "account" };
    return { payload: { type: "bank", token, holderName: name } };
  }
  const digits = digitsOnly(v.number);
  if (digits.length < 12) return { error: "Enter the card number.", field: "number" };
  if (!luhn(digits)) return { error: "Check the card number.", field: "number" };
  const token = cardToken(digits);
  if (!token) return { error: "Test mode: that isn't a Stayblz test card. Real cards can't be used yet, and nothing was sent.", field: "number" };
  const m = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(v.expiry.trim());
  if (!m) return { error: "Enter the expiry as MM/YY.", field: "expiry" };
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return { error: "Check the expiry month.", field: "expiry" };
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return { error: "This card has expired.", field: "expiry" };
  const cvcLen = /^3[47]/.test(digits) ? 4 : 3;
  if (digitsOnly(v.cvc).length !== cvcLen) return { error: `Enter the ${cvcLen}-digit security code.`, field: "cvc" };
  if (!name) return { error: "Enter the name on the card.", field: "name" };
  return { payload: { type: "card", token, holderName: name, expMonth: month, expYear: year } };
}

export default function CardFields({
  value,
  onChange,
  allowBank = true,
  allowCard = true,
  errorField,
  disabled = false,
}: {
  value: CardValue;
  onChange: (next: CardValue) => void;
  allowBank?: boolean;
  allowCard?: boolean;
  errorField?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [showTests, setShowTests] = useState(false);
  const set = (patch: Partial<CardValue>) => onChange({ ...value, ...patch });
  const brand = brandOf(digitsOnly(value.number));
  const nextYear = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");
  const invalid = (f: string) => (errorField === f ? { "aria-invalid": true as const } : {});

  return (
    <div className="bl-card-fields">
      {allowBank && allowCard && (
        <div className="bl-seg" role="radiogroup" aria-label="Pay with">
          {(["card", "bank"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={value.kind === k} className={value.kind === k ? "is-on" : ""} onClick={() => set({ kind: k })} disabled={disabled}>
              {k === "card" ? "Card" : "Bank account (ACH)"}
            </button>
          ))}
        </div>
      )}
      {value.kind === "card" ? (
        <>
          <label className="bl-field">
            <span>Card number</span>
            <span className="bl-input-with">
              <input
                id={`${id}-number`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="4242 4242 4242 4242"
                value={value.number}
                onChange={(e) => set({ number: formatCardNumber(e.target.value) })}
                maxLength={23}
                disabled={disabled}
                {...invalid("number")}
              />
              {brand && <small className="bl-brand">{brand}</small>}
            </span>
          </label>
          <div className="bl-row3">
            <label className="bl-field">
              <span>Expiry</span>
              <input inputMode="numeric" autoComplete="off" placeholder={`12/${nextYear}`} value={value.expiry} maxLength={7} disabled={disabled} {...invalid("expiry")}
                onChange={(e) => {
                  const d = digitsOnly(e.target.value).slice(0, 4);
                  set({ expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d });
                }}
              />
            </label>
            <label className="bl-field">
              <span>Security code</span>
              <input inputMode="numeric" autoComplete="off" placeholder="123" value={value.cvc} maxLength={4} disabled={disabled} {...invalid("cvc")} onChange={(e) => set({ cvc: digitsOnly(e.target.value).slice(0, 4) })} />
            </label>
            <label className="bl-field">
              <span className="ld-label">ZIP <em>Optional</em></span>
              <input autoComplete="off" value={value.postal} maxLength={10} disabled={disabled} onChange={(e) => set({ postal: e.target.value.slice(0, 10) })} />
            </label>
          </div>
          <label className="bl-field">
            <span>Name on the card</span>
            <input autoComplete="off" value={value.name} maxLength={120} disabled={disabled} {...invalid("name")} onChange={(e) => set({ name: e.target.value })} />
          </label>
        </>
      ) : (
        <>
          <label className="bl-field">
            <span>Account holder</span>
            <input autoComplete="off" value={value.name} maxLength={120} disabled={disabled} {...invalid("name")} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <div className="bl-row2">
            <label className="bl-field">
              <span>Routing number</span>
              <input inputMode="numeric" autoComplete="off" placeholder="110000000" value={value.routing} maxLength={9} disabled={disabled} {...invalid("routing")} onChange={(e) => set({ routing: digitsOnly(e.target.value).slice(0, 9) })} />
            </label>
            <label className="bl-field">
              <span>Account number</span>
              <input inputMode="numeric" autoComplete="off" placeholder="000123456789" value={value.account} maxLength={17} disabled={disabled} {...invalid("account")} onChange={(e) => set({ account: digitsOnly(e.target.value).slice(0, 17) })} />
            </label>
          </div>
          <div className="bl-seg bl-seg-sm" role="radiogroup" aria-label="Account type">
            {(["checking", "savings"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={value.accountType === k} className={value.accountType === k ? "is-on" : ""} onClick={() => set({ accountType: k })} disabled={disabled}>
                {k === "checking" ? "Checking" : "Savings"}
              </button>
            ))}
          </div>
          <p className="bl-hint">Bank payments take a few days to clear (minutes in test mode). They cost the least to accept.</p>
        </>
      )}
      <div className="bl-testbox">
        <button type="button" className="bl-link" aria-expanded={showTests} onClick={() => setShowTests((s) => !s)}>
          {showTests ? "Hide" : "Show"} test {value.kind === "card" ? "cards" : "bank accounts"}
        </button>
        {!showTests && value.kind === "card" && !value.number && (
          <button
            type="button"
            className="bl-link"
            disabled={disabled}
            onClick={() => set({ number: TEST_CARDS[0].number, expiry: `12/${nextYear}`, cvc: "123", name: value.name || "Test Customer" })}
          >
            Fill in a test card
          </button>
        )}
        {showTests && (
          <ul className="bl-testlist">
            {value.kind === "card"
              ? TEST_CARDS.map((c) => (
                  <li key={c.token}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => set({ number: c.number, expiry: `12/${nextYear}`, cvc: /^3[47]/.test(digitsOnly(c.number)) ? "1234" : "123", name: value.name || "Test Customer" })}
                    >
                      <code>{c.number}</code> <span>{c.result}</span>
                    </button>
                  </li>
                ))
              : TEST_BANKS.map((b) => (
                  <li key={b.token}>
                    <button type="button" disabled={disabled} onClick={() => set({ routing: b.routing, account: b.account, name: value.name || "Test Customer" })}>
                      <code>
                        {b.routing} / {b.account}
                      </code>{" "}
                      <span>{b.result}</span>
                    </button>
                  </li>
                ))}
          </ul>
        )}
      </div>
    </div>
  );
}
