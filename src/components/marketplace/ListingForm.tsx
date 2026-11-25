import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import {
  AGE_MAX,
  BREEDS,
  COLORS,
  DESCRIPTION_MAX,
  DISCIPLINES,
  GENDERS,
  HEIGHTS,
  PRICE_MAX,
  TYPES,
  type Listing,
  type ListingInput,
  type Option,
} from "./options";
import { DocumentManager, MediaManager, savedDocument, savedMedia, type MediaItem } from "./ListingMedia";
import { getListing, removeUpload } from "./media";
import "./marketplace-media.css";

/** The listing's details; photos, videos and documents are added separately. */
type Basics = Omit<ListingInput, "mediaIds" | "documentIds">;

type Fields = Record<
  "name" | "price" | "breed" | "discipline" | "type" | "gender" | "color" | "age" | "heightIn" | "location" | "description",
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
  description: "",
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
  description: l.description ?? "",
});
const digits = (value: string) => value.replace(/[^\d]/g, "");

/**
 * The price box shows "25,000" while you type. Re-writing the commas used to throw the cursor to the end and made a
 * comma impossible to delete (it came straight back), so changing a price in the middle didn't work. Now the cursor
 * stays after the same digit, and Backspace/Delete next to a comma remove the digit beside it.
 */
function priceInput(input: HTMLInputElement, set: (value: string) => void, previous: string) {
  const raw = input.value;
  let before = digits(raw.slice(0, input.selectionStart ?? raw.length)).length;
  let d = digits(raw).replace(/^0+(?=\d)/, "");
  // Already 9 digits (the most a price can have): a 10th is refused, never pushing a digit off the end.
  if (d.length > 9) {
    d = digits(previous);
    before = Math.max(0, before - 1);
  }
  const next = d ? Number(d).toLocaleString("en-US") : "";
  set(next);
  requestAnimationFrame(() => {
    if (document.activeElement !== input) return;
    let at = 0;
    for (let seen = 0; at < next.length && seen < before; at++) if (/\d/.test(next[at])) seen++;
    input.setSelectionRange(at, at);
  });
}
function priceKey(e: KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const at = el.selectionStart ?? 0;
  if (at !== el.selectionEnd) return;
  if (e.key === "Backspace" && el.value[at - 1] === ",") el.setSelectionRange(at - 1, at - 1);
  if (e.key === "Delete" && el.value[at] === ",") el.setSelectionRange(at + 1, at + 1);
}

/** Turns the form into what the server expects, or says what to fix. */
function check(f: Fields): Basics | string {
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
  if (f.description.trim().length > DESCRIPTION_MAX)
    return `Keep the description to ${DESCRIPTION_MAX.toLocaleString("en-US")} characters.`;
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
    description: f.description.trim(),
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
      {/* The name is just the label: without this, screen readers also hear the option text inside the label. */}
      <select id={id} aria-label={label} required value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
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

  /* ----- Photos, videos and documents ----- */
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [documents, setDocuments] = useState<MediaItem[]>([]);
  // Editing: load the listing's current files first. Saving is blocked until they're in, so a
  // failed load can never save the listing without its photos.
  const [media, setMedia] = useState<{ loading: boolean; error: string }>({ loading: !!editing, error: "" });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!editing) return;
    const c = new AbortController();
    setMedia({ loading: true, error: "" });
    getListing(editing.id, c.signal)
      .then((listing) => {
        if (c.signal.aborted) return;
        setPhotos((listing.media ?? []).map(savedMedia));
        setDocuments((listing.documents ?? []).map(savedDocument));
        // Cards don't carry the description: take the saved one from the full listing.
        setEdit((current) => ({ ...current, description: listing.description ?? "" }));
        setMedia({ loading: false, error: "" });
      })
      .catch((e) => {
        if (!c.signal.aborted) setMedia({ loading: false, error: e instanceof Error ? e.message : "Photos couldn't be loaded." });
      });
    return () => c.abort();
  }, [editing, reload]);

  // Uploads from this form that aren't saved yet: dropped from storage when removed, or on Cancel.
  const saved = useRef(false);
  const fresh = useRef(new Set<string>());
  useEffect(() => {
    const now = new Set([...photos, ...documents].filter((i) => i.fresh && i.id).map((i) => i.id!));
    for (const id of fresh.current) if (!now.has(id)) void removeUpload(id);
    fresh.current = now;
  }, [photos, documents]);
  useEffect(
    () => () => {
      if (!saved.current) for (const id of fresh.current) void removeUpload(id);
    },
    [],
  );
  const uploading = [...photos, ...documents].some((i) => i.status === "uploading");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = check(fields);
    if (typeof input === "string") {
      setError(input);
      return;
    }
    if (media.loading || media.error) {
      setError("The listing's photos and videos haven't loaded yet. Try again in a moment.");
      return;
    }
    if (uploading) {
      setError("Wait for the uploads to finish, then save.");
      return;
    }
    if ([...photos, ...documents].some((i) => i.status === "error")) {
      setError("Remove the files that didn't upload (marked in red), then save.");
      return;
    }
    const mediaIds = photos.filter((p) => p.status === "ready" && p.id).map((p) => p.id!);
    const documentIds = documents.filter((d) => d.status === "ready" && d.id).map((d) => d.id!);
    // Photos and videos are optional (MIN_MEDIA is 0): a listing can be published without any.
    const body: ListingInput = { ...input, mediaIds, documentIds };
    setBusy(true);
    setError("");
    try {
      const data = editing
        ? await api.patch<{ listing: Listing }>(`/api/marketplace/listings/${editing.id}`, body)
        : await api.post<{ listing: Listing }>("/api/marketplace/listings", body);
      if (!data?.listing?.id) throw new Error("The listing could not be saved. Please try again.");
      saved.current = true;
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
        {media.loading ? (
          <div className="mkm-section mkm-loading" role="status">
            <span className="mkm-spinner" aria-hidden="true" /> Loading photos, videos and documents…
          </div>
        ) : media.error ? (
          <div className="mkm-section mkm-load-error" role="alert">
            <span>{media.error}</span>
            <button type="button" className="btn btn-quiet" onClick={() => setReload((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <MediaManager items={photos} setItems={setPhotos} disabled={busy} />
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
                onKeyDown={priceKey}
                onChange={(e) => priceInput(e.target, set("price"), fields.price)}
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
        {!media.loading && !media.error && <DocumentManager items={documents} setItems={setDocuments} disabled={busy} />}
        <label htmlFor="mk-description" className="mk-description">
          <span className="mk-label-row">
            Description <small>Optional</small>
          </span>
          <textarea
            id="mk-description"
            rows={6}
            maxLength={DESCRIPTION_MAX}
            placeholder="Temperament, training, race or show record, health, reason for sale…"
            value={fields.description}
            // While editing, the saved description arrives with the photos.
            disabled={busy || media.loading}
            aria-describedby="mk-description-count"
            onChange={(e) => set("description")(e.target.value)}
          />
          <small id="mk-description-count" className="mk-count" aria-live="polite">
            {fields.description.length.toLocaleString("en-US")} / {DESCRIPTION_MAX.toLocaleString("en-US")}
          </small>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="mk-form-note">
          Your listing, photos, videos and documents are shown to signed-in Stayblz members with your display name. You can edit
          or remove them at any time.
        </p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || media.loading}>
            {busy ? "Saving…" : uploading ? "Uploading…" : editing ? "Save changes" : "Publish listing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
