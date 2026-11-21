import CardFields, { cardPayload, emptyCard, type CardValue } from "./CardFields";
import { billingApi, methodLabel, type Method } from "./billingApi";

/** Pick a saved card / bank account, or add a new one (saved to the account, so renewals can use it). */
export type MethodChoice = { mode: "saved"; id: string } | { mode: "new"; value: CardValue };

export const initialChoice = (methods: Method[], defaultId: string | null | undefined, allow: { card: boolean; bank: boolean } = { card: true, bank: true }): MethodChoice => {
  const usable = methods.filter((m) => (m.type === "card" ? allow.card : allow.bank));
  const preferred = usable.find((m) => m.id === defaultId) ?? usable[0];
  return preferred ? { mode: "saved", id: preferred.id } : { mode: "new", value: emptyCard(allow.card ? "card" : "bank") };
};

/** Turns the choice into a saved method id (adding the new card first). Throws with plain words. */
export async function methodIdFor(choice: MethodChoice): Promise<string> {
  if (choice.mode === "saved") return choice.id;
  const { payload, error } = cardPayload(choice.value);
  if (!payload) throw new Error(error);
  const { method } = await billingApi.addMethod(payload);
  return method.id;
}

const expired = (m: Method) => {
  if (m.type !== "card" || !m.expMonth || !m.expYear) return false;
  const now = new Date();
  return m.expYear < now.getFullYear() || (m.expYear === now.getFullYear() && m.expMonth < now.getMonth() + 1);
};

export default function MethodPicker({
  methods,
  choice,
  onChange,
  allowCard = true,
  allowBank = true,
  disabled = false,
  errorField,
  defaultId,
}: {
  methods: Method[];
  choice: MethodChoice;
  onChange: (c: MethodChoice) => void;
  allowCard?: boolean;
  allowBank?: boolean;
  disabled?: boolean;
  errorField?: string;
  defaultId?: string | null;
}) {
  const usable = methods.filter((m) => (m.type === "card" ? allowCard : allowBank));
  return (
    <fieldset className="bl-picker" disabled={disabled}>
      <legend>Pay with</legend>
      {usable.map((m) => (
        <label key={m.id} className={`bl-pick${choice.mode === "saved" && choice.id === m.id ? " is-on" : ""}${expired(m) ? " is-expired" : ""}`}>
          <input type="radio" name="bl-method" checked={choice.mode === "saved" && choice.id === m.id} onChange={() => onChange({ mode: "saved", id: m.id })} />
          <span className="bl-pick-main">
            <strong>{methodLabel(m)}</strong>
            <small>
              {m.type === "card" ? (expired(m) ? "Expired" : `Expires ${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}`) : "Bank transfer"}
              {m.id === defaultId ? " · Default" : ""}
            </small>
          </span>
        </label>
      ))}
      <label className={`bl-pick${choice.mode === "new" ? " is-on" : ""}`}>
        <input
          type="radio"
          name="bl-method"
          checked={choice.mode === "new"}
          onChange={() => onChange({ mode: "new", value: emptyCard(allowCard ? "card" : "bank") })}
        />
        <span className="bl-pick-main">
          <strong>{usable.length ? "Use a new card or bank account" : "Add a card or bank account"}</strong>
          <small>Saved to your account so renewals and autopay can use it</small>
        </span>
      </label>
      {choice.mode === "new" && (
        <div className="bl-pick-new">
          <CardFields value={choice.value} onChange={(value) => onChange({ mode: "new", value })} allowBank={allowBank} allowCard={allowCard} errorField={errorField} disabled={disabled} />
        </div>
      )}
    </fieldset>
  );
}
