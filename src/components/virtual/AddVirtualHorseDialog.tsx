import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../api";
import { formFav, type HorseRow, type IndexCode } from "../stayblz-data/formfavApi";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { TopLayer } from "../community/HorseShare";
import { community, horseImageUrl, type PublicHorse } from "../community/api";
import { LOCKED_BY_RACE_DATA, type AddInput, type ManualInput, type VirtualApi, type VirtualHorse } from "./api";

type Mode = "stayblz" | "racing" | "manual";

/**
 * Add a horse to a Virtual Stayblz list: search Stayblz members' public horses, search US and Canada race data
 * (those go to the Racing horses tab), or type one in by hand. `onAdded` gets the saved horse (or the existing one
 * when it was already there), with its source when known.
 */
export default function AddVirtualHorseDialog({
  client,
  listName,
  onClose,
  onAdded,
}: {
  client: VirtualApi;
  listName: string;
  onClose: () => void;
  onAdded: (horse: { id: string; source?: string }) => void;
}) {
  const [mode, setMode] = useState<Mode>("stayblz");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function add(input: AddInput, key: string) {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      const r = await client.add(input);
      onAdded(r.horse);
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_added" && input.source !== "manual") {
        const s = await client
          .state(
            input.source === "community"
              ? { communityHorseId: input.communityHorseId }
              : input.source === "formfav"
                ? { formfav: { name: input.formfavName, code: input.formfavCode } }
                : { racingHorseId: input.racingHorseId },
          )
          .catch(() => null);
        if (s?.id) return onAdded({ id: s.id, source: input.source });
      }
      setError(e instanceof Error ? e.message : "This horse couldn't be added.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <TopLayer>
      <Modal label="Add a horse to Virtual Stayblz" className="gx-layer vs-dialog" onClose={onClose}>
        <DialogHead kicker={listName} title="Add a horse" onClose={onClose} />
        <div className="vs-seg" role="tablist" aria-label="Where the horse comes from">
          {(
            [
              ["stayblz", "Stayblz horses"],
              ["racing", "US & Canada racing"],
              ["manual", "Enter by hand"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} className="vs-seg-btn" onClick={() => { setMode(key); setError(""); }}>
              {label}
            </button>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {mode === "stayblz" ? (
          <StayblzSearch busy={busy} onAdd={(h) => void add({ source: "community", communityHorseId: h.id }, h.id)} />
        ) : mode === "racing" ? (
          <RaceDataSearch busy={busy} onAdd={(h) => void add({ source: "formfav", formfavName: h.name, formfavCode: h.code }, `${h.code}|${h.name}`)} />
        ) : (
          <ManualHorseForm busy={!!busy} submitLabel="Add horse" onSubmit={(input) => void add({ source: "manual", ...input }, "manual")} />
        )}
      </Modal>
    </TopLayer>
  );
}

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function StayblzSearch({ busy, onAdd }: { busy: string | null; onAdd: (h: PublicHorse) => void }) {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const [horses, setHorses] = useState<PublicHorse[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setError("");
    community
      .publicHorses({ q }, null, c.signal)
      .then((r) => !c.signal.aborted && setHorses(r.horses))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Horses couldn't be loaded."));
    return () => c.abort();
  }, [q]);
  return (
    <div className="vs-search">
      <label className="vs-field">
        <span>Search horses shared by Stayblz members</span>
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Horse name" maxLength={60} data-autofocus />
      </label>
      {error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : horses === null ? (
        <p className="vs-muted" aria-busy="true">Loading…</p>
      ) : horses.length === 0 ? (
        <p className="vs-muted">{q ? `No public horses match “${q}”.` : "No public horses yet."}</p>
      ) : (
        <ul className="vs-results">
          {horses.map((h) => (
            <li key={h.id}>
              <span className="vs-thumb" aria-hidden="true">
                {h.coverImageId ? <img src={horseImageUrl(h.coverImageId)} alt="" loading="lazy" /> : initials(h.name)}
              </span>
              <span className="vs-result-text">
                <strong>{h.name}</strong>
                <small>{[h.breed, h.sire && h.dam ? `${h.sire} – ${h.dam}` : h.sire, `Owner: ${h.owner.name}`].filter(Boolean).join(" · ")}</small>
              </span>
              <button type="button" className="vs-btn vs-btn-primary" disabled={!!busy} onClick={() => onAdd(h)}>
                {busy === h.id ? "Adding…" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CODE_LABEL: Record<IndexCode, string> = { gallops: "Thoroughbred", harness: "Harness" };
const COUNTRY_LABEL: Record<string, string> = { us: "United States", ca: "Canada" };
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * US and Canada race data (FormFav race cards, about the last 30 days and the next 1–2), the same horses as the
 * Racing horses tab. Only these racing horses can be tracked; added ones live in Racing horses.
 */
function RaceDataSearch({ busy, onAdd }: { busy: string | null; onAdd: (h: HorseRow) => void }) {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const [horses, setHorses] = useState<HorseRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (q.length < 2) {
      setHorses(null);
      setError("");
      return;
    }
    const c = new AbortController();
    setError("");
    formFav
      .horses({ offset: 0, limit: 20, q, codes: ["gallops", "harness"], countries: ["us", "ca"] }, c.signal)
      .then((r) => !c.signal.aborted && setHorses(Array.isArray(r.records) ? r.records : []))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Race data couldn't be searched."));
    return () => c.abort();
  }, [q]);
  return (
    <div className="vs-search">
      <label className="vs-field">
        <span>Search US and Canada race cards (last 30 days and upcoming)</span>
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="At least 2 letters" maxLength={60} data-autofocus />
      </label>
      {error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : q.length < 2 ? (
        <p className="vs-muted">Type a horse's name. Added racing horses go to the Racing horses tab, with alerts when they're entered or have run.</p>
      ) : horses === null ? (
        <p className="vs-muted" aria-busy="true">Searching…</p>
      ) : horses.length === 0 ? (
        <p className="vs-muted">No horse called “{q}” raced or was entered in the US or Canada lately. You can enter it by hand instead.</p>
      ) : (
        <ul className="vs-results">
          {horses.map((h) => {
            const key = `${h.code}|${h.name}`;
            return (
              <li key={key}>
                <span className="vs-thumb" aria-hidden="true">{initials(h.name)}</span>
                <span className="vs-result-text">
                  <strong>{h.name}</strong>
                  <small>
                    {[CODE_LABEL[h.code] ?? h.code, h.countries.map((c) => COUNTRY_LABEL[c] ?? c.toUpperCase()).join(" · "), h.trainer && `Trainer ${h.trainer}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <small>
                    {[
                      `${h.starts} ${h.starts === 1 ? "start" : "starts"}`,
                      h.lastStart && `last at ${h.lastStart.track ?? h.lastStart.slug}, ${shortDay(h.lastStart.date)}`,
                      h.nextEntry && `entered ${h.nextEntry.track ?? h.nextEntry.slug} ${shortDay(h.nextEntry.date)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <button type="button" className="vs-btn vs-btn-primary" disabled={!!busy} onClick={() => onAdd(h)} aria-label={`Add ${h.name}`}>
                  {busy === key ? "Adding…" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Details of a horse typed in by hand (also used to edit one). */
export function ManualHorseForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  locked = false,
}: {
  initial?: Partial<VirtualHorse>;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: ManualInput) => void;
  /** Linked to race data: those details can't be changed here. */
  locked?: boolean;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    breed: initial?.breed ?? "",
    sex: initial?.sex ?? "",
    foaledYear: initial?.foaledYear ? String(initial.foaledYear) : "",
    color: initial?.color ?? "",
    sire: initial?.sire ?? "",
    dam: initial?.dam ?? "",
    trainer: initial?.trainer ?? "",
    ownerName: initial?.ownerName ?? "",
    location: initial?.location ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const isLocked = (k: string) => locked && RACE_DATA_FIELDS.includes(k);
  function submit(e: FormEvent) {
    e.preventDefault();
    const input: Record<string, unknown> = { ...f, foaledYear: f.foaledYear ? Number(f.foaledYear) : null };
    if (locked) for (const k of RACE_DATA_FIELDS) delete input[k];
    onSubmit(input as ManualInput);
  }
  const text = (k: keyof typeof f, label: string, max: number, extra: Record<string, unknown> = {}) => (
    <label className="vs-field">
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} maxLength={max} disabled={isLocked(k)} {...extra} />
    </label>
  );
  return (
    <form className="vs-form" onSubmit={submit}>
      {locked && <p className="vs-muted">{LOCKED_BY_RACE_DATA}</p>}
      <div className="vs-grid">
        {text("name", "Name *", 80, { required: true, "data-autofocus": true })}
        {text("breed", "Breed", 60, { placeholder: "Thoroughbred" })}
        <label className="vs-field">
          <span>Sex</span>
          <select value={f.sex} onChange={set("sex")} disabled={isLocked("sex")}>
            <option value="">—</option>
            {["colt", "filly", "mare", "stallion", "gelding", "ridgling"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </label>
        {text("foaledYear", "Foaled (year)", 4, { inputMode: "numeric", pattern: "\\d{4}", placeholder: "2022" })}
        {text("color", "Colour", 40)}
        {text("sire", "Sire", 80)}
        {text("dam", "Dam", 80)}
        {text("trainer", "Trainer", 80)}
        {text("ownerName", "Owner", 80)}
        {text("location", "Location", 80)}
      </div>
      <div className="vs-form-actions">
        <button type="submit" className="vs-btn vs-btn-primary" disabled={busy || !f.name.trim()}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Kept up to date by race data while a horse is linked. */
const RACE_DATA_FIELDS = ["breed", "sex", "foaledYear", "sire", "dam", "trainer"];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";
