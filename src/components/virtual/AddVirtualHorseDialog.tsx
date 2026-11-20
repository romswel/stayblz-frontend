import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { TopLayer } from "../community/HorseShare";
import { community, horseImageUrl, type PublicHorse } from "../community/api";
import type { AddInput, ManualInput, VirtualApi, VirtualHorse } from "./api";

type Mode = "stayblz" | "racing" | "manual";
type RacingHit = { id: string; name: string; country: string; sire: string; dam: string };

/**
 * Add a horse to a Virtual Stayblz list: search Stayblz members' public horses, search the racing data,
 * or type one in by hand. `onAdded` gets the saved horse (or the existing one when it was already there).
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
  onAdded: (horse: { id: string }) => void;
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
          .state(input.source === "community" ? { communityHorseId: input.communityHorseId } : { racingHorseId: input.racingHorseId })
          .catch(() => null);
        if (s?.id) return onAdded({ id: s.id });
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
              ["racing", "Racing data"],
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
          <RacingSearch busy={busy} onAdd={(h) => void add({ source: "racing", racingHorseId: h.id }, h.id)} />
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

function RacingSearch({ busy, onAdd }: { busy: string | null; onAdd: (h: RacingHit) => void }) {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const [horses, setHorses] = useState<RacingHit[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (q.length < 2) {
      setHorses(null);
      setError("");
      return;
    }
    const c = new AbortController();
    setError("");
    api
      .get<{ horses: RacingHit[] }>(`/api/public/racing/search?q=${encodeURIComponent(q)}`, { signal: c.signal })
      .then((r) => !c.signal.aborted && setHorses(Array.isArray(r.horses) ? r.horses : []))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Racing data couldn't be searched."));
    return () => c.abort();
  }, [q]);
  return (
    <div className="vs-search">
      <label className="vs-field">
        <span>Search horses in published racing (entries, results, workouts)</span>
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="At least 2 letters" maxLength={60} data-autofocus />
      </label>
      {error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : q.length < 2 ? (
        <p className="vs-muted">Type a horse's name to search.</p>
      ) : horses === null ? (
        <p className="vs-muted" aria-busy="true">Searching…</p>
      ) : horses.length === 0 ? (
        <p className="vs-muted">No racing horses match “{q}”. You can enter it by hand instead.</p>
      ) : (
        <ul className="vs-results">
          {horses.map((h) => (
            <li key={h.id}>
              <span className="vs-thumb" aria-hidden="true">{initials(h.name)}</span>
              <span className="vs-result-text">
                <strong>{h.name}{h.country ? ` (${h.country})` : ""}</strong>
                <small>{[h.sire, h.dam].filter(Boolean).join(" – ") || "Pedigree not recorded"}</small>
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

/** Details of a horse typed in by hand (also used to edit one). */
export function ManualHorseForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<VirtualHorse>;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: ManualInput) => void;
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
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ ...f, foaledYear: f.foaledYear ? Number(f.foaledYear) : null });
  }
  const text = (k: keyof typeof f, label: string, max: number, extra: Record<string, unknown> = {}) => (
    <label className="vs-field">
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} maxLength={max} {...extra} />
    </label>
  );
  return (
    <form className="vs-form" onSubmit={submit}>
      <div className="vs-grid">
        {text("name", "Name *", 80, { required: true, "data-autofocus": true })}
        {text("breed", "Breed", 60, { placeholder: "Thoroughbred" })}
        <label className="vs-field">
          <span>Sex</span>
          <select value={f.sex} onChange={set("sex")}>
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

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";
