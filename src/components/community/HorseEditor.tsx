import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useConfirm } from "../ui/Confirm";
import {
  SEX_LABELS,
  STATUS_LABELS,
  SURFACE_LABELS,
  community,
  errorText,
  horseImageUrl,
  money,
  ordinal,
  uploadHorseImage,
  type HorseDetail,
  type HorseInput,
  type HorseSex,
  type HorseStatus,
  type HorseStats,
  type HorseVisibility,
  type RaceRecord,
  type RecordInput,
  type Surface,
} from "./api";
import { Icon, StatusBadge } from "./ui";

type Tab = "details" | "photos" | "records";

const blankHorse: HorseInput = {
  name: "",
  breed: "",
  sex: "",
  foaledYear: null,
  color: "",
  sire: "",
  dam: "",
  status: "racing",
  trainer: "",
  location: "",
  description: "",
  visibility: "inherit",
};
const toInput = (h: HorseDetail): HorseInput => ({
  name: h.name,
  breed: h.breed,
  sex: h.sex,
  foaledYear: h.foaledYear,
  color: h.color,
  sire: h.sire,
  dam: h.dam,
  status: h.status,
  trainer: h.trainer,
  location: h.location,
  description: h.description,
  visibility: h.visibility ?? "inherit",
});
const same = (a: HorseInput, b: HorseInput) => (Object.keys(a) as (keyof HorseInput)[]).every((k) => a[k] === b[k]);

const VISIBILITY: { value: HorseVisibility; label: string; hint: string; icon: ReactNode }[] = [
  { value: "inherit", label: "Inventory default", hint: "Follow my inventory setting", icon: <Icon.Horse /> },
  { value: "members", label: "Everyone", hint: "All Stayblz members", icon: <Icon.Globe /> },
  { value: "followers", label: "Followers", hint: "People who follow me", icon: <Icon.Users /> },
  { value: "private", label: "Only me", hint: "Hidden from others", icon: <Icon.Lock /> },
];

/**
 * Add or edit one of your horses in three steps: details, photos, race records.
 * A new horse is saved first; photos and race records unlock right after.
 */
export default function HorseEditor({
  horseId,
  startTab = "details",
  onClose,
  onChanged,
  onRemoved,
}: {
  horseId: string | null;
  startTab?: Tab;
  onClose: () => void;
  onChanged: (horse: HorseDetail) => void;
  onRemoved: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [id, setId] = useState(horseId);
  const [horse, setHorse] = useState<HorseDetail | null>(null);
  const [tab, setTab] = useState<Tab>(horseId ? startTab : "details");
  const [loadError, setLoadError] = useState("");
  const [dirty, setDirty] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  async function requestClose() {
    if (dirty) {
      const sure = await confirm({
        title: "Discard unsaved changes?",
        message: "Your changes to this horse's details haven't been saved.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "danger",
      });
      if (!sure) return;
    }
    onClose();
  }
  const closeRefFn = useRef(requestClose);
  closeRefFn.current = requestClose;

  useEffect(() => {
    // A new horse starts in the name field (autoFocus); an existing one starts on Close.
    if (horseId) closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && void closeRefFn.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let live = true;
    community
      .horse(id)
      .then((r) => live && setHorse(r.horse))
      .catch((e) => live && setLoadError(errorText(e, "This horse couldn't be loaded.")));
    return () => {
      live = false;
    };
  }, [id]);

  const changed = (next: HorseDetail) => {
    setHorse(next);
    onChanged(next);
  };

  async function remove() {
    if (!horse) return;
    const sure = await confirm({
      title: `Remove ${horse.name}?`,
      message: "The horse, its photos and race records are deleted. Posts that tagged it stay, without the link. This can't be undone.",
      confirmLabel: "Remove horse",
      cancelLabel: "Keep horse",
      tone: "danger",
    });
    if (!sure) return;
    try {
      await community.removeHorse(horse.id);
      onRemoved(horse.id);
      onClose();
    } catch (e) {
      setLoadError(errorText(e, "The horse couldn't be removed."));
    }
  }

  async function go(next: Tab) {
    if (next === tab || (!id && next !== "details")) return;
    if (dirty) {
      const sure = await confirm({
        title: "Leave without saving?",
        message: "Your changes to the details haven't been saved yet.",
        confirmLabel: "Leave",
        cancelLabel: "Stay",
      });
      if (!sure) return;
      setDirty(false);
    }
    setTab(next);
  }

  const steps: { key: Tab; n: string; label: string; short: string; icon: ReactNode; meta?: string }[] = [
    { key: "details", n: "01", label: "Details", short: "Details", icon: <Icon.Edit /> },
    { key: "photos", n: "02", label: "Photos", short: "Photos", icon: <Icon.Photo />, meta: horse ? `${horse.images.length}/12` : undefined },
    { key: "records", n: "03", label: "Race records", short: "Races", icon: <Icon.Flag />, meta: horse ? String(horse.records.length) : undefined },
  ];
  const cover = horse?.coverImageId ? horseImageUrl(horse.coverImageId) : null;

  return (
    <div className="cm-sheet-wrap">
      <button type="button" className="cm-scrim" tabIndex={-1} aria-label="Close" onClick={() => void requestClose()} />
      <section className="cm-sheet cm-editor gx-glass" role="dialog" aria-modal="true" aria-labelledby="cm-editor-title">
        <span className="cm-sheet-grip" aria-hidden="true" />
        <header className="cm-ed-head">
          <span className="cm-ed-thumb" aria-hidden="true">
            {cover ? <img src={cover} alt="" /> : <Icon.Horse />}
          </span>
          <div className="cm-ed-title">
            <span className="cm-ed-kicker">
              <span className="cm-ed-led" aria-hidden="true" />
              {id ? "Edit horse" : "New horse"}
              {horse && <span className="cm-ed-id">#{horse.id.slice(0, 6).toUpperCase()}</span>}
            </span>
            <h2 id="cm-editor-title">{horse?.name || (id ? "Loading…" : "Add a horse")}</h2>
            {horse ? (
              <div className="cm-ed-meta">
                <StatusBadge status={horse.status} />
                <span>{horse.stats.starts} starts</span>
                <span>{horse.stats.wins} wins</span>
                <span className="is-money">{money(horse.stats.earningsCents)}</span>
              </div>
            ) : (
              !id && <p className="cm-ed-sub">Start with the basics. Photos and race records come next.</p>
            )}
          </div>
          <button ref={closeRef} type="button" className="cm-icon-btn cm-ed-close" aria-label="Close" onClick={() => void requestClose()}>
            <Icon.Close />
          </button>
        </header>

        <nav className="cm-steps" aria-label="Horse sections">
          {steps.map((s) => {
            const locked = !id && s.key !== "details";
            return (
              <button
                key={s.key}
                type="button"
                className={`cm-step${tab === s.key ? " is-active" : ""}${locked ? " is-locked" : ""}`}
                aria-current={tab === s.key ? "step" : undefined}
                disabled={locked}
                title={locked ? "Save the details first" : undefined}
                onClick={() => void go(s.key)}
              >
                <span className="cm-step-n">{locked ? <Icon.Lock /> : s.n}</span>
                <span className="cm-step-text">
                  <strong><span className="cm-step-long">{s.label}</span><span className="cm-step-short">{s.short}</span></strong>
                  {s.meta && <small>{s.meta}</small>}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="cm-sheet-body">
          {loadError && <p className="cm-error" role="alert">{loadError}</p>}
          {tab === "details" && (id ? horse : true) && (
            <DetailsForm
              key={horse?.id ?? "new"}
              horse={horse}
              isNew={!id}
              onDirty={setDirty}
              onSaved={(saved, isNew) => {
                setDirty(false);
                if (isNew) {
                  setId(saved.id);
                  setTab("photos");
                } else changed(saved);
              }}
              onRemove={id ? remove : undefined}
            />
          )}
          {tab === "photos" && horse && <PhotosPanel horse={horse} onChange={changed} />}
          {tab === "records" && horse && <RecordsPanel horse={horse} onChange={changed} />}
          {id && !horse && !loadError && (
            <div className="cm-ed-loading" role="status"><span className="cm-spinner" /> Loading horse…</div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================== Shared bits ============================== */

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="cm-fs">
      <legend className="cm-fs-head">
        <span className="cm-fs-n">{n}</span>
        <span className="cm-fs-title">{title}</span>
        {hint && <span className="cm-fs-hint">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Chips<T extends string>({
  name,
  value,
  options,
  onChange,
  tone,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  tone?: boolean;
}) {
  return (
    <div className="cm-chips" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={o.value || "none"} className={`cm-chip-opt${value === o.value ? " is-on" : ""}${tone ? ` is-${o.value}` : ""}`}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          {tone && <span className="cm-chip-dot" aria-hidden="true" />}
          {o.label}
        </label>
      ))}
    </div>
  );
}

/* ============================== 01 Details ============================== */

function DetailsForm({
  horse,
  isNew,
  onSaved,
  onRemove,
  onDirty,
}: {
  horse: HorseDetail | null;
  isNew: boolean;
  onSaved: (h: HorseDetail, isNew: boolean) => void;
  onRemove?: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const initial = horse ? toInput(horse) : blankHorse;
  const [base, setBase] = useState(initial);
  const [f, setF] = useState<HorseInput>(initial);
  const [share, setShare] = useState(true);
  const [shareText, setShareText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = !same(f, base) || (isNew && !!f.name.trim());
  useEffect(() => onDirty(!same(f, base)), [f, base, onDirty]);
  const set = <K extends keyof HorseInput>(k: K, v: HorseInput[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setSaved(false);
  };
  const thisYear = new Date().getFullYear();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const r = await community.createHorse({ ...f, share, shareText });
        onSaved({ ...r.horse, images: [], records: [], owner: { id: r.horse.ownerId, name: "", headline: "", isFollowing: false, me: true } }, true);
      } else if (horse) {
        const r = await community.updateHorse(horse.id, f);
        setBase(f);
        onSaved({ ...horse, ...r.horse }, false);
        setSaved(true);
      }
    } catch (err) {
      setError(errorText(err, "The horse couldn't be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cm-ed-form" onSubmit={submit} noValidate>
      <Section n="01" title="Identity">
        <div className="cm-ed-grid">
          <label className="cm-field cm-span-all">
            <span>Registered name <em>*</em></span>
            <input value={f.name} maxLength={80} required autoFocus={isNew} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Midnight Ledger" />
          </label>
          <label className="cm-field">
            <span>Breed</span>
            <input value={f.breed} maxLength={60} list="cm-breeds" onChange={(e) => set("breed", e.target.value)} placeholder="Thoroughbred" />
            <datalist id="cm-breeds">
              {["Thoroughbred", "Quarter Horse", "Standardbred", "Arabian", "Appaloosa", "Paint", "Warmblood"].map((b) => <option key={b} value={b} />)}
            </datalist>
          </label>
          <label className="cm-field">
            <span>Colour</span>
            <input value={f.color} maxLength={40} onChange={(e) => set("color", e.target.value)} placeholder="Bay" />
          </label>
          <label className="cm-field">
            <span>Year foaled</span>
            <div className="cm-input-addon">
              <input
                type="number"
                inputMode="numeric"
                min={1980}
                max={thisYear}
                value={f.foaledYear ?? ""}
                onChange={(e) => set("foaledYear", e.target.value ? Number(e.target.value) : null)}
                placeholder={String(thisYear - 3)}
              />
              {f.foaledYear && f.foaledYear <= thisYear && f.foaledYear >= 1980 && <b>{thisYear - f.foaledYear} yrs</b>}
            </div>
          </label>
        </div>
        <div className="cm-field">
          <span>Sex</span>
          <Chips
            name="Sex"
            value={f.sex}
            onChange={(v) => set("sex", v)}
            options={(Object.keys(SEX_LABELS) as HorseSex[]).map((s) => ({ value: s, label: s ? SEX_LABELS[s] : "Not set" }))}
          />
        </div>
      </Section>

      <Section n="02" title="Status">
        <Chips
          name="Status"
          tone
          value={f.status}
          onChange={(v) => set("status", v)}
          options={(Object.keys(STATUS_LABELS) as HorseStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
      </Section>

      <Section n="03" title="Pedigree & team" hint="Optional">
        <div className="cm-ed-grid">
          <label className="cm-field">
            <span>Sire</span>
            <input value={f.sire} maxLength={80} onChange={(e) => set("sire", e.target.value)} />
          </label>
          <label className="cm-field">
            <span>Dam</span>
            <input value={f.dam} maxLength={80} onChange={(e) => set("dam", e.target.value)} />
          </label>
          <label className="cm-field">
            <span>Trainer</span>
            <input value={f.trainer} maxLength={80} onChange={(e) => set("trainer", e.target.value)} />
          </label>
          <label className="cm-field">
            <span>Location</span>
            <input value={f.location} maxLength={80} onChange={(e) => set("location", e.target.value)} placeholder="Track, farm or city" />
          </label>
        </div>
      </Section>

      <Section n="04" title="About" hint="Optional">
        <label className="cm-field">
          <span className="cm-sr">About this horse</span>
          <textarea value={f.description} maxLength={4000} rows={4} onChange={(e) => set("description", e.target.value)} placeholder="Temperament, training notes, highlights…" />
        </label>
        <div className="cm-counter">
          <span className="cm-meter is-thin"><span style={{ width: `${(f.description.length / 4000) * 100}%` }} /></span>
          <span>{f.description.length.toLocaleString()} / 4,000</span>
        </div>
      </Section>

      <Section n="05" title="Who can see this horse">
        <div className="cm-vis" role="radiogroup" aria-label="Who can see this horse">
          {VISIBILITY.map((v) => (
            <label key={v.value} className={`cm-vis-opt${f.visibility === v.value ? " is-on" : ""}`}>
              <input type="radio" name="visibility" checked={f.visibility === v.value} onChange={() => set("visibility", v.value)} />
              <span className="cm-vis-icon" aria-hidden="true">{v.icon}</span>
              <strong>{v.label}</strong>
              <small>{v.hint}</small>
            </label>
          ))}
        </div>
      </Section>

      {isNew && (
        <label className="cm-switch cm-ed-share">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          <span className="cm-switch-track" aria-hidden="true" />
          <span>
            <strong>Share to the Feed</strong>
            <small>Your followers see a "New horse" post.</small>
          </span>
        </label>
      )}
      {isNew && share && (
        <input className="cm-ed-note" value={shareText} maxLength={2000} onChange={(e) => setShareText(e.target.value)} placeholder="Add a note to the post (optional)" aria-label="Note for the post" />
      )}

      {error && <p className="cm-error" role="alert">{error}</p>}

      <div className="cm-sheet-foot">
        {onRemove && (
          <button type="button" className="cm-btn cm-btn-ghost cm-btn-danger-text" onClick={onRemove}>
            <Icon.Trash /> <span className="cm-hide-xs">Remove</span>
          </button>
        )}
        <span className="cm-foot-state" role="status">
          {busy ? "Saving…" : saved ? <><span className="cm-dot is-ok" /> Saved</> : dirty && !isNew ? <><span className="cm-dot is-warn" /> Unsaved changes</> : null}
        </span>
        <button type="submit" className="cm-btn cm-btn-primary" disabled={busy || !f.name.trim() || (!isNew && !dirty)}>
          {busy ? "Saving…" : isNew ? <>Save &amp; add photos <Icon.Right /></> : "Save changes"}
        </button>
      </div>
    </form>
  );
}

/* ============================== 02 Photos ============================== */

function PhotosPanel({ horse, onChange }: { horse: HorseDetail; onChange: (h: HorseDetail) => void }) {
  const confirm = useConfirm();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const images = horse.images;
  const room = 12 - images.length;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, room);
    setError(files.length > room ? `A horse can have up to 12 photos. ${room} more can be added.` : "");
    let current = horse;
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const r = await uploadHorseImage(horse.id, file);
        current = { ...current, images: [...current.images, r.image], coverImageId: r.coverImageId };
        onChange(current);
      } catch (e) {
        setError(errorText(e, "A photo couldn't be uploaded."));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }
  async function remove(imageId: string) {
    const sure = await confirm({ title: "Remove this photo?", message: "It's deleted from this horse's profile.", confirmLabel: "Remove photo", cancelLabel: "Keep", tone: "danger" });
    if (!sure) return;
    try {
      const r = await community.removeHorseImage(horse.id, imageId);
      onChange({ ...horse, images: horse.images.filter((i) => i.id !== imageId), coverImageId: r.coverImageId });
    } catch (e) {
      setError(errorText(e, "The photo couldn't be removed."));
    }
  }
  async function cover(imageId: string) {
    try {
      await community.setCover(horse.id, imageId);
      onChange({ ...horse, coverImageId: imageId });
    } catch (e) {
      setError(errorText(e, "The cover photo couldn't be changed."));
    }
  }
  async function move(index: number, dir: -1 | 1) {
    const next = [...images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((img, position) => ({ ...img, position }));
    onChange({ ...horse, images: ordered });
    try {
      await community.orderHorseImages(horse.id, ordered.map((i) => i.id));
    } catch (e) {
      setError(errorText(e, "The new order couldn't be saved."));
      onChange(horse);
    }
  }

  return (
    <div className="cm-ed-panel">
      <button
        type="button"
        className={`cm-dropzone${dragging ? " is-drag" : ""}${room <= 0 ? " is-full" : ""}`}
        disabled={room <= 0}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (room > 0) void add(e.dataTransfer.files);
        }}
      >
        <span className="cm-dropzone-icon" aria-hidden="true"><Icon.Photo /></span>
        <strong>{room <= 0 ? "Photo limit reached" : dragging ? "Drop to upload" : "Drop photos here or tap to choose"}</strong>
        <small>JPG, PNG, WebP or GIF · large photos are resized automatically</small>
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      {error && <p className="cm-error" role="alert">{error}</p>}

      {images.length > 0 || uploading > 0 ? (
        <ul className="cm-ed-photos">
          {images.map((img, i) => {
            const isCover = horse.coverImageId === img.id;
            return (
              <li key={img.id} className={isCover ? "is-cover" : undefined}>
                <img src={horseImageUrl(img.id)} alt={`${horse.name} photo ${i + 1}`} loading="lazy" />
                <span className="cm-ed-photo-n">{String(i + 1).padStart(2, "0")}</span>
                {isCover && <span className="cm-cover-tag">Cover</span>}
                <div className="cm-ed-photo-tools">
                  <button type="button" className="cm-icon-btn" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><Icon.Left /></button>
                  <button type="button" className="cm-icon-btn" aria-label="Move later" disabled={i === images.length - 1} onClick={() => move(i, 1)}><Icon.Right /></button>
                  <span className="cm-grow" />
                  {!isCover && <button type="button" className="cm-mini" onClick={() => cover(img.id)}>Set cover</button>}
                  <button type="button" className="cm-icon-btn cm-danger" aria-label="Remove photo" onClick={() => remove(img.id)}><Icon.Trash /></button>
                </div>
              </li>
            );
          })}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`} className="is-uploading" aria-label="Uploading">
              <span className="cm-spinner" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="cm-ed-empty">No photos yet. The first photo you add becomes the cover.</p>
      )}

      <div className="cm-sheet-foot">
        <span className="cm-foot-meter">
          <span className="cm-meter is-thin"><span style={{ width: `${(images.length / 12) * 100}%` }} /></span>
          <span className="cm-mono">{images.length} / 12 photos</span>
        </span>
        <button type="button" className="cm-btn cm-btn-primary" disabled={room <= 0} onClick={() => fileRef.current?.click()}>
          <Icon.Plus /> Add photos
        </button>
      </div>
    </div>
  );
}

/* ============================== 03 Race records ============================== */

const blankRecord = (): RecordInput => ({
  raceDate: new Date().toISOString().slice(0, 10),
  track: "",
  raceName: "",
  distance: "",
  surface: "",
  finish: null,
  fieldSize: null,
  earnings: "",
  notes: "",
});
const recordToInput = (r: RaceRecord): RecordInput => ({
  raceDate: r.raceDate,
  track: r.track,
  raceName: r.raceName,
  distance: r.distance,
  surface: r.surface,
  finish: r.finish,
  fieldSize: r.fieldSize,
  earnings: r.earningsCents ? String(r.earningsCents / 100) : "",
  notes: r.notes,
});

function RecordsPanel({ horse, onChange }: { horse: HorseDetail; onChange: (h: HorseDetail) => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<RaceRecord | "new" | null>(horse.records.length ? null : "new");
  const [error, setError] = useState("");
  const withStats = (records: RaceRecord[], stats: HorseStats | null) =>
    onChange({ ...horse, records: [...records].sort((a, b) => b.raceDate.localeCompare(a.raceDate)), stats: stats ?? horse.stats });

  async function remove(r: RaceRecord) {
    const sure = await confirm({ title: "Remove this race record?", message: `${r.track} on ${r.raceDate}. Totals are recalculated.`, confirmLabel: "Remove record", cancelLabel: "Keep", tone: "danger" });
    if (!sure) return;
    try {
      const res = await community.removeRecord(r.id);
      withStats(horse.records.filter((x) => x.id !== r.id), res.stats);
    } catch (e) {
      setError(errorText(e, "The record couldn't be removed."));
    }
  }

  const s = horse.stats;
  return (
    <div className="cm-ed-panel">
      <dl className="cm-ed-stats">
        <div><dt>Starts</dt><dd>{s.starts}</dd></div>
        <div><dt>1st</dt><dd className="is-gold">{s.wins}</dd></div>
        <div><dt>2nd</dt><dd>{s.places}</dd></div>
        <div><dt>3rd</dt><dd>{s.shows}</dd></div>
        <div className="is-wide"><dt>Earnings</dt><dd className="is-money">{money(s.earningsCents)}</dd></div>
      </dl>
      {error && <p className="cm-error" role="alert">{error}</p>}

      {editing ? (
        <RecordForm
          horseId={horse.id}
          record={editing === "new" ? null : editing}
          canCancel={editing !== "new" || horse.records.length > 0}
          onCancel={() => setEditing(null)}
          onSaved={(record, stats, isNew) => {
            withStats(isNew ? [record, ...horse.records] : horse.records.map((x) => (x.id === record.id ? record : x)), stats);
            setEditing(null);
          }}
        />
      ) : (
        <>
          <ol className="cm-ed-races">
            {horse.records.map((r) => (
              <li key={r.id}>
                <span className={`cm-pos${r.finish === 1 ? " is-win" : r.finish && r.finish <= 3 ? " is-place" : ""}`}>{r.finish ? ordinal(r.finish) : "—"}</span>
                <span className="cm-ed-race-date">
                  <b>{new Date(`${r.raceDate}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit" })}</b>
                  <small>{new Date(`${r.raceDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}</small>
                </span>
                <span className="cm-record-text">
                  <strong>{r.raceName || r.track}</strong>
                  <small>{[r.raceName ? r.track : "", r.distance, r.surface ? SURFACE_LABELS[r.surface] : "", r.fieldSize ? `${r.fieldSize} ran` : ""].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="cm-record-money">{r.earningsCents ? money(r.earningsCents) : ""}</span>
                <span className="cm-ed-race-tools">
                  <button type="button" className="cm-icon-btn" aria-label={`Edit ${r.raceName || r.track}`} onClick={() => setEditing(r)}><Icon.Edit /></button>
                  <button type="button" className="cm-icon-btn cm-danger" aria-label={`Remove ${r.raceName || r.track}`} onClick={() => remove(r)}><Icon.Trash /></button>
                </span>
              </li>
            ))}
          </ol>
          <div className="cm-sheet-foot">
            <span className="cm-foot-state cm-mono">{horse.records.length} race{horse.records.length === 1 ? "" : "s"} recorded</span>
            <button type="button" className="cm-btn cm-btn-primary" onClick={() => setEditing("new")}><Icon.Plus /> Add a race</button>
          </div>
        </>
      )}
    </div>
  );
}

function RecordForm({
  horseId,
  record,
  canCancel,
  onCancel,
  onSaved,
}: {
  horseId: string;
  record: RaceRecord | null;
  canCancel: boolean;
  onCancel: () => void;
  onSaved: (record: RaceRecord, stats: HorseStats | null, isNew: boolean) => void;
}) {
  const [f, setF] = useState<RecordInput>(record ? recordToInput(record) : blankRecord());
  const [share, setShare] = useState(!record);
  const [shareText, setShareText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof RecordInput>(k: K, v: RecordInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const int = (v: string) => (v ? Number(v) : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (record) {
        const r = await community.updateRecord(record.id, f);
        onSaved(r.record, r.stats, false);
      } else {
        const r = await community.addRecord(horseId, { ...f, share, shareText });
        onSaved(r.record, r.stats, true);
      }
    } catch (err) {
      setError(errorText(err, "The race couldn't be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cm-ed-form" onSubmit={submit} noValidate>
      <Section n={record ? "✎" : "+"} title={record ? "Edit race" : "New race"}>
        <div className="cm-ed-grid">
          <label className="cm-field">
            <span>Date <em>*</em></span>
            <input type="date" required value={f.raceDate} max={new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)} onChange={(e) => set("raceDate", e.target.value)} />
          </label>
          <label className="cm-field">
            <span>Track <em>*</em></span>
            <input required maxLength={80} value={f.track} onChange={(e) => set("track", e.target.value)} placeholder="Santa Anita" />
          </label>
          <label className="cm-field cm-span-all">
            <span>Race name</span>
            <input maxLength={120} value={f.raceName} onChange={(e) => set("raceName", e.target.value)} placeholder="Golden Hour Stakes (G3)" />
          </label>
          <label className="cm-field">
            <span>Distance</span>
            <input maxLength={40} value={f.distance} onChange={(e) => set("distance", e.target.value)} placeholder="1 1/16 mi" />
          </label>
          <div className="cm-field">
            <span>Surface</span>
            <Chips
              name="Surface"
              value={f.surface}
              onChange={(v) => set("surface", v)}
              options={(Object.keys(SURFACE_LABELS) as Surface[]).filter(Boolean).map((s) => ({ value: s, label: SURFACE_LABELS[s] }))}
            />
          </div>
        </div>
      </Section>
      <Section n="#" title="Result">
        <div className="cm-ed-result">
          <label className="cm-field">
            <span>Finished</span>
            <input type="number" min={1} max={30} inputMode="numeric" value={f.finish ?? ""} onChange={(e) => set("finish", int(e.target.value))} placeholder="1" aria-label="Finishing position" />
          </label>
          <span className="cm-ed-of" aria-hidden="true">of</span>
          <label className="cm-field">
            <span>Runners</span>
            <input type="number" min={1} max={30} inputMode="numeric" value={f.fieldSize ?? ""} onChange={(e) => set("fieldSize", int(e.target.value))} placeholder="8" aria-label="Number of runners" />
          </label>
          <label className="cm-field cm-ed-money">
            <span>Earnings</span>
            <div className="cm-input-addon is-prefix">
              <b>$</b>
              <input inputMode="decimal" value={f.earnings} onChange={(e) => set("earnings", e.target.value)} placeholder="0" aria-label="Earnings in US dollars" />
            </div>
          </label>
        </div>
        <label className="cm-field">
          <span>Notes</span>
          <input maxLength={500} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Trip notes, jockey, conditions…" />
        </label>
      </Section>
      {!record && (
        <label className="cm-switch cm-ed-share">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          <span className="cm-switch-track" aria-hidden="true" />
          <span>
            <strong>Share this result to the Feed</strong>
            <small>{f.finish === 1 ? "It's posted as a Winner." : "Followers see it as a race result."}</small>
          </span>
        </label>
      )}
      {!record && share && (
        <input className="cm-ed-note" value={shareText} maxLength={2000} onChange={(e) => setShareText(e.target.value)} placeholder="Add a note to the post (optional)" aria-label="Note for the post" />
      )}
      {error && <p className="cm-error" role="alert">{error}</p>}
      <div className="cm-sheet-foot">
        {canCancel && <button type="button" className="cm-btn cm-btn-ghost" onClick={onCancel}>Cancel</button>}
        <span className="cm-grow" />
        <button type="submit" className="cm-btn cm-btn-primary" disabled={busy || !f.track.trim() || !f.raceDate}>
          {busy ? "Saving…" : record ? "Save race" : "Add race"}
        </button>
      </div>
    </form>
  );
}