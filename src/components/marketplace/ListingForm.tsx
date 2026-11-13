import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import {
  AGE_MAX,
  BREEDS,
  COLORS,
  DISCIPLINES,
  GENDERS,
  HEIGHTS,
  PRICE_MAX,
  TYPES,
  type Listing,
  type ListingInput,
  type Option,
} from "./options";

type Fields = Record<
  "name" | "price" | "breed" | "discipline" | "type" | "gender" | "color" | "age" | "heightIn" | "location",
  string
>;
const EMPTY: Fields = {
  name: "",
  price: "",
  breed: "",
  discipline: "",
  type: "",
  gender: "",
  color: "",
  age: "",
  heightIn: "",
  location: "",
};
const fromListing = (l: Listing): Fields => ({
  name: l.name,
  price: l.price.toLocaleString("en-US"),
  breed: l.breed,
  discipline: l.discipline,
  type: l.type,
  gender: l.gender,
  color: l.color,
  age: String(l.age),
  heightIn: String(l.heightIn),
  location: l.location,
});
const digits = (value: string) => value.replace(/[^\d]/g, "");

/** Turns the form into what the server expects, or says what to fix. */
function check(f: Fields): ListingInput | string {
  if (!f.name.trim()) return "Enter the horse's name.";
  const price = Number(digits(f.price));
  if (!digits(f.price) || price < 1 || price > PRICE_MAX) return "Enter a price in whole US dollars.";
  for (const [key, label] of [
    ["breed", "breed"],
    ["discipline", "discipline"],
    ["type", "type"],
    ["gender", "gender"],
    ["color", "colour"],
  ] as const)
    if (!f[key]) return `Choose a ${label}.`;
  const age = Number(f.age);
  if (f.age.trim() === "" || !Number.isInteger(age) || age < 0 || age > AGE_MAX)
    return `Enter the age in whole years (0 to ${AGE_MAX}).`;
  if (!f.heightIn) return "Choose a height.";
  if (f.location.trim().length < 2) return "Enter where the horse is located.";
  return {
    name: f.name.trim(),
    price,
    breed: f.breed,
    discipline: f.discipline,
    type: f.type,
    gender: f.gender,
    color: f.color,
    age,
    heightIn: Number(f.heightIn),
    location: f.location.trim(),
  };
}

function Select({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <select id={id} required value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Add a horse to the marketplace, or edit one of your listings. */
export default function ListingForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: Listing | null;
  onClose: () => void;
  onSaved: (listing: Listing, created: boolean) => void;
}) {
  const { user } = useAuth();
  // A new listing is kept on this device until it's saved (cleared on log out). Edits are not.
  const [draft, setDraft, clearDraft, restored] = useDraft<Fields>(
    editing ? null : accountDraftKey(user?.id, "marketplace.listing"),
    EMPTY,
  );
  const [edit, setEdit] = useState<Fields>(() => (editing ? fromListing(editing) : EMPTY));
  const fields = editing ? edit : draft;
  const set = (key: keyof Fields) => (value: string) =>
    (editing ? setEdit : setDraft)((current) => ({ ...current, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = check(fields);
    if (typeof input === "string") {
      setError(input);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = editing
        ? await api.patch<{ listing: Listing }>(`/api/marketplace/listings/${editing.id}`, input)
        : await api.post<{ listing: Listing }>("/api/marketplace/listings", input);
      if (!data?.listing?.id) throw new Error("The listing could not be saved. Please try again.");
      if (!editing) clearDraft();
      onSaved(data.listing, !editing);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The listing could not be saved. Please try again.");
      setBusy(false);
    }
  }

  const title = editing ? `Edit ${editing.name}` : "List a horse";
  return (
    <Modal label={title} className="modal-wide" onClose={busy ? () => undefined : onClose}>
      <DialogHead kicker="Marketplace" title={title} onClose={busy ? undefined : onClose} />
      <form className="dlg mk-form" onSubmit={submit} noValidate>
        {restored && !editing && (
          <p className="ws-notice" role="status">
            We kept what you typed last time.
          </p>
        )}
        <div className="mk-form-grid">
          <label htmlFor="mk-name" className="mk-span">
            Horse name
            <input
              id="mk-name"
              data-autofocus
              required
              maxLength={80}
              autoComplete="off"
              value={fields.name}
              disabled={busy}
              onChange={(e) => set("name")(e.target.value)}
            />
          </label>
          <label htmlFor="mk-price">
            Price (USD)
            <span className="mk-money">
              <span aria-hidden="true">$</span>
              <input
                id="mk-price"
                required
                inputMode="numeric"
                autoComplete="off"
                placeholder="25,000"
                maxLength={13}
                value={fields.price}
                disabled={busy}
                onChange={(e) => {
                  const d = digits(e.target.value).slice(0, 9);
                  set("price")(d ? Number(d).toLocaleString("en-US") : "");
                }}
              />
            </span>
          </label>
          <Select id="mk-breed" label="Breed" value={fields.breed} options={BREEDS} disabled={busy} onChange={set("breed")} />
          <Select
            id="mk-discipline"
            label="Discipline"
            value={fields.discipline}
            options={DISCIPLINES}
            disabled={busy}
            onChange={set("discipline")}
          />
          <Select id="mk-type" label="Type" value={fields.type} options={TYPES} disabled={busy} onChange={set("type")} />
          <Select id="mk-gender" label="Gender" value={fields.gender} options={GENDERS} disabled={busy} onChange={set("gender")} />
          <Select id="mk-color" label="Color" value={fields.color} options={COLORS} disabled={busy} onChange={set("color")} />
          <label htmlFor="mk-age">
            Age (years)
            <input
              id="mk-age"
              required
              type="number"
              inputMode="numeric"
              min={0}
              max={AGE_MAX}
              step={1}
              placeholder="0 for foals"
              value={fields.age}
              disabled={busy}
              onChange={(e) => set("age")(e.target.value)}
            />
          </label>
          <Select
            id="mk-height"
            label="Height (hands)"
            value={fields.heightIn}
            options={HEIGHTS}
            disabled={busy}
            onChange={set("heightIn")}
          />
          <label htmlFor="mk-location" className="mk-span">
            Location
            <input
              id="mk-location"
              required
              maxLength={80}
              placeholder="City, State or Country"
              value={fields.location}
              disabled={busy}
              onChange={(e) => set("location")(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="mk-form-note">
          Your listing is shown to signed-in Stayblz members with your display name. You can edit or remove it at any
          time.
        </p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Publish listing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
