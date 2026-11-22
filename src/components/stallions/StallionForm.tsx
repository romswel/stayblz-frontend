import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { DocumentManager, MediaManager, savedDocument, savedMediaFrom, type MediaItem } from "../marketplace/ListingMedia";
import { removeUpload } from "../marketplace/media";
import "../marketplace/marketplace-media.css";
import { useConfirm } from "../ui/Confirm";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import GeneticsFields from "./GeneticsFields";
import HorseLookup from "./HorseLookup";
import PedigreeFields from "./PedigreeFields";
import StallionsNav from "./StallionsNav";
import { UnderWorkTag } from "./UnderWork";
import { STALLION_MEDIA, stallionsApi, type StallionInput } from "./api";
import { AVAILABILITY, BREEDS, CURRENCIES, FEE_TERMS, FOALED_COUNTRIES, HEIGHTS, LIVE_COVER_ONLY, METHODS, REGION_GROUPS } from "./options";
import type { Genetics, Pedigree, StallionProfile } from "./types";

const thisYear = new Date().getFullYear();
const COLORS = ["Bay", "Dark bay or brown", "Chestnut", "Gray or roan", "Black", "Sorrel", "Palomino", "Buckskin", "Dun", "Red dun", "Grullo", "Roan", "Cremello", "Perlino", "Pinto"];

interface FormState {
  name: string;
  breed: string;
  registry: string;
  registration: string;
  foaled: string;
  country: string;
  color: string;
  heightIn: string;
  farm: string;
  location: string;
  region: string;
  seasonYear: number;
  fee: string;
  privateFee: boolean;
  feeCurrency: string;
  feeTerms: string;
  feeNote: string;
  bookingFee: string;
  availability: string;
  methods: string[];
  shippingNote: string;
  firstSeason: string;
  programs: string;
  pedigree: Pedigree;
  starts: string;
  wins: string;
  places: string;
  shows: string;
  earnings: string;
  earningsCurrency: string;
  highlights: string;
  genetics: Genetics;
  fertilityRate: string;
  fertilityNote: string;
  description: string;
  racingHorseId: string | null;
  racingHorseName: string;
  inquiriesOpen: boolean;
  confirm: boolean;
}
const EMPTY: FormState = {
  name: "", breed: "thoroughbred", registry: "", registration: "", foaled: "", country: "", color: "", heightIn: "", farm: "", location: "", region: "",
  seasonYear: thisYear, fee: "", privateFee: false, feeCurrency: "USD", feeTerms: "live_foal", feeNote: "", bookingFee: "", availability: "open",
  methods: ["live_cover"], shippingNote: "", firstSeason: "", programs: "", pedigree: {}, starts: "", wins: "", places: "", shows: "", earnings: "",
  earningsCurrency: "USD", highlights: "", genetics: {}, fertilityRate: "", fertilityNote: "", description: "", racingHorseId: null, racingHorseName: "",
  inquiriesOpen: true, confirm: false,
};
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
function fromProfile(s: StallionProfile): FormState {
  const r = s.raceRecord;
  return {
    name: s.name, breed: s.breed, registry: s.registry, registration: s.registration, foaled: str(s.foaled), country: s.country, color: s.color,
    heightIn: str(s.heightIn), farm: s.farm, location: s.location, region: s.region, seasonYear: Math.max(s.seasonYear, thisYear - 1),
    fee: s.fee === null ? "" : String(Math.round(s.fee / 100)), privateFee: s.fee === null, feeCurrency: s.feeCurrency, feeTerms: s.feeTerms,
    feeNote: s.feeNote, bookingFee: s.bookingFee === null ? "" : String(Math.round(s.bookingFee / 100)), availability: s.availability, methods: s.methods,
    shippingNote: s.shippingNote, firstSeason: str(s.firstSeason), programs: s.programs, pedigree: s.pedigree, starts: str(r.starts), wins: str(r.wins),
    places: str(r.places), shows: str(r.shows), earnings: r.earnings ? String(Math.round(r.earnings / 100)) : "", earningsCurrency: r.currency ?? "USD",
    highlights: s.highlights.join("\n"), genetics: s.genetics, fertilityRate: str(s.fertilityRate), fertilityNote: s.fertilityNote, description: s.description,
    racingHorseId: s.racingHorseId, racingHorseName: s.racing?.name ?? (s.racingHorseId ? s.name : ""), inquiriesOpen: s.inquiriesOpen, confirm: false,
  };
}
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="st-form-section gx-glass">
      <h2 className="st-panel-title">{title}</h2>
      {hint && <p className="st-muted">{hint}</p>}
      {children}
    </section>
  );
}

/** List or edit a stallion (/stallions/manage/new, /stallions/manage/:id). */
export default function StallionForm() {
  const { id } = useParams();
  const editing = !!id && id !== "new";
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const loaded = useRef<FormState | null>(null);
  const [form, setForm, clearDraft, restored] = useDraft<FormState>(accountDraftKey(user?.id, editing ? `stallions.edit.${id}` : "stallions.new"), EMPTY, {
    isEmpty: (v) => JSON.stringify({ ...v, confirm: false }) === JSON.stringify({ ...(loaded.current ?? EMPTY), confirm: false }),
  });
  const [load, setLoad] = useState<{ loading: boolean; error: string; stallion: StallionProfile | null }>({ loading: editing, error: "", stallion: null });
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [docs, setDocs] = useState<MediaItem[]>([]);
  // Writing help: null until we know whether the server has it.
  const [writer, setWriter] = useState<boolean | null>(null);
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = useRef(false);
  const fresh = useRef(new Set<string>());

  useEffect(() => {
    stallionsApi
      .mine()
      .then((d) => setWriter(d.writer))
      .catch(() => undefined);
    if (!editing) return;
    let live = true;
    stallionsApi
      .profile(id!)
      .then((s) => {
        if (!live) return;
        if (!s.mine) return setLoad({ loading: false, error: "You can only edit your own stallions.", stallion: null });
        const base = fromProfile(s);
        loaded.current = base;
        if (!restored) setForm(base);
        setMedia(s.media.map((m) => savedMediaFrom(m, STALLION_MEDIA)));
        setDocs(s.documents.map(savedDocument));
        setLoad({ loading: false, error: "", stallion: s });
      })
      .catch((e) => live && setLoad({ loading: false, error: e instanceof Error ? e.message : "This stallion couldn't be loaded.", stallion: null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Files uploaded in this visit but not saved: dropped from storage as soon as they're removed, or when leaving unsaved.
  useEffect(() => {
    const now = new Set([...media, ...docs].filter((item) => item.fresh && item.id).map((item) => item.id!));
    for (const fileId of fresh.current) if (!now.has(fileId)) void removeUpload(fileId, STALLION_MEDIA);
    fresh.current = now;
  }, [media, docs]);
  useEffect(
    () => () => {
      if (!saved.current) for (const fileId of fresh.current) void removeUpload(fileId, STALLION_MEDIA);
    },
    [],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const liveCoverOnly = LIVE_COVER_ONLY.has(form.breed);
  const uploading = [...media, ...docs].some((m) => m.status === "uploading");

  function input(publish: boolean | undefined): StallionInput {
    const record = {
      starts: num(form.starts),
      wins: num(form.wins),
      places: num(form.places),
      shows: num(form.shows),
      earnings: num(form.earnings),
      currency: form.earningsCurrency,
    };
    return {
      name: form.name, breed: form.breed, registry: form.registry, registration: form.registration, foaled: num(form.foaled), country: form.country,
      color: form.color, heightIn: num(form.heightIn), farm: form.farm, location: form.location, region: form.region, seasonYear: form.seasonYear,
      fee: form.privateFee ? null : num(form.fee), feeCurrency: form.feeCurrency, feeTerms: form.feeTerms, feeNote: form.feeNote,
      bookingFee: form.privateFee ? null : num(form.bookingFee), availability: form.availability, methods: liveCoverOnly ? ["live_cover"] : form.methods,
      shippingNote: form.shippingNote, firstSeason: num(form.firstSeason), programs: form.programs, pedigree: form.pedigree, raceRecord: record,
      highlights: form.highlights.split("\n").map((h) => h.trim()).filter(Boolean), genetics: form.genetics, fertilityRate: num(form.fertilityRate),
      fertilityNote: form.fertilityNote, description: form.description, racingHorseId: form.racingHorseId, inquiriesOpen: form.inquiriesOpen,
      confirm: form.confirm,
      mediaIds: media.filter((m) => m.status === "ready" && m.id).map((m) => m.id!),
      documentIds: docs.filter((m) => m.status === "ready" && m.id).map((m) => m.id!),
      ...(publish === undefined ? {} : { publish }),
    };
  }

  async function submit(e: FormEvent, publish?: boolean) {
    e.preventDefault();
    if (uploading) return setError("Wait for the uploads to finish.");
    if (!form.name.trim()) return setError("Add his name.");
    if (!form.region) return setError("Choose where he stands.");
    if (!form.location.trim()) return setError("Add the town and state he stands in.");
    if (!form.privateFee && form.fee.trim() === "") return setError("Add his fee, or tick Private fee.");
    if (publish && (!form.pedigree.s || !form.pedigree.d)) return setError("Add his sire and dam before publishing.");
    if (!form.confirm) return setError("Tick the box to confirm you own or manage him and the details are true.");
    setBusy(true);
    setError("");
    try {
      const s = editing ? await stallionsApi.update(id!, input(undefined)) : await stallionsApi.create(input(publish === true));
      saved.current = true;
      clearDraft();
      navigate(`/stallions/${s.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "He couldn't be saved. Try again.");
      setBusy(false);
    }
  }

  async function write() {
    if (!form.name.trim()) return setError("Add his name first.");
    if (form.description.trim() && !(await confirm({ title: "Replace your description?", message: "The draft replaces what's in the box now. You can edit it before saving.", confirmLabel: "Write a draft" }))) return;
    setWriting(true);
    setError("");
    try {
      const text = await stallionsApi.writeDescription({ ...input(undefined), description: form.description });
      set("description", text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The draft couldn't be written.");
    } finally {
      setWriting(false);
    }
  }

  if (load.loading)
    return (
      <div className="st-page">
        <p className="st-count-line" role="status">
          Loading…
        </p>
      </div>
    );
  if (editing && !load.stallion)
    return (
      <div className="st-page">
        <div className="st-empty gx-glass" role="alert">
          <h2>This stallion couldn't be opened.</h2>
          <p>{load.error}</p>
          <Link to="/stallions/manage" className="btn btn-quiet">
            My stallions
          </Link>
        </div>
      </div>
    );

  return (
    <div className="st-page">
      <StallionsNav signedIn title={editing ? `Edit ${load.stallion?.name ?? "stallion"}` : "List a stallion"} lead="Breeders search by fee, region, breed and pedigree. The more you add, the more they find." />
      <form className="st-form" onSubmit={(e) => void submit(e, editing ? undefined : true)} noValidate>
        {restored && (
          <p className="st-alert is-ok" role="status">
            We kept what you typed.{" "}
            <button
              type="button"
              className="st-link"
              onClick={() => {
                clearDraft();
                if (loaded.current) setForm(loaded.current);
              }}
            >
              Discard changes
            </button>
          </p>
        )}

        <Section title="The stallion">
          <div className="st-grid-3">
            <label className="st-field">
              <span>Name</span>
              <input value={form.name} maxLength={60} required onChange={(e) => set("name", e.target.value)} />
            </label>
            <label className="st-field">
              <span>Breed</span>
              <select value={form.breed} onChange={(e) => set("breed", e.target.value)}>
                {BREEDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>
                Foaled <em>Optional</em>
              </span>
              <input type="number" inputMode="numeric" min={1980} max={thisYear} value={form.foaled} onChange={(e) => set("foaled", e.target.value)} />
            </label>
            <label className="st-field">
              <span>
                Foaled in <em>Optional</em>
              </span>
              <select value={form.country} onChange={(e) => set("country", e.target.value)}>
                <option value="">Not given</option>
                {FOALED_COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>
                Colour <em>Optional</em>
              </span>
              <input list="st-colors" value={form.color} maxLength={30} onChange={(e) => set("color", e.target.value)} />
              <datalist id="st-colors">
                {COLORS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="st-field">
              <span>
                Height <em>Optional</em>
              </span>
              <select value={form.heightIn} onChange={(e) => set("heightIn", e.target.value)}>
                <option value="">Not given</option>
                {HEIGHTS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>
                Registry <em>Optional</em>
              </span>
              <input value={form.registry} maxLength={60} placeholder="e.g. The Jockey Club, AQHA, USTA" onChange={(e) => set("registry", e.target.value)} />
            </label>
            <label className="st-field">
              <span>
                Registration number <em>Optional</em>
              </span>
              <input value={form.registration} maxLength={40} onChange={(e) => set("registration", e.target.value)} />
            </label>
            <label className="st-field">
              <span>
                First season at stud <em>Optional</em>
              </span>
              <input type="number" inputMode="numeric" min={1980} max={thisYear + 1} value={form.firstSeason} onChange={(e) => set("firstSeason", e.target.value)} />
            </label>
          </div>
        </Section>

        <Section title="Where he stands">
          <div className="st-grid-3">
            <label className="st-field">
              <span>
                Farm <em>Optional</em>
              </span>
              <input value={form.farm} maxLength={80} onChange={(e) => set("farm", e.target.value)} />
            </label>
            <label className="st-field">
              <span>Town and state</span>
              <input value={form.location} maxLength={80} placeholder="e.g. Versailles, Kentucky" onChange={(e) => set("location", e.target.value)} />
            </label>
            <label className="st-field">
              <span>Region (for search)</span>
              <select value={form.region} onChange={(e) => set("region", e.target.value)}>
                <option value="">Choose…</option>
                {REGION_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
        </Section>

        <Section title="Fee and booking" hint="Breeders filter by fee. A private fee shows as “Private fee” and they ask you.">
          <div className="st-grid-3">
            <label className="st-field">
              <span>Season</span>
              <select value={form.seasonYear} onChange={(e) => set("seasonYear", Number(e.target.value))}>
                {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <div className="st-field">
              <label htmlFor="st-fee">Fee</label>
              <div className="st-input-with">
                <select aria-label="Currency" value={form.feeCurrency} disabled={form.privateFee} onChange={(e) => set("feeCurrency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input id="st-fee" type="number" inputMode="numeric" min={0} step={1} value={form.privateFee ? "" : form.fee} disabled={form.privateFee} onChange={(e) => set("fee", e.target.value)} />
              </div>
              <label className="st-check">
                <input type="checkbox" checked={form.privateFee} onChange={(e) => set("privateFee", e.target.checked)} />
                Private fee
              </label>
            </div>
            <label className="st-field">
              <span>Terms</span>
              <select value={form.feeTerms} disabled={form.privateFee} onChange={(e) => set("feeTerms", e.target.value)}>
                {FEE_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>
                Booking fee <em>Optional</em>
              </span>
              <input type="number" inputMode="numeric" min={0} step={1} value={form.bookingFee} disabled={form.privateFee} onChange={(e) => set("bookingFee", e.target.value)} />
            </label>
            <label className="st-field">
              <span>Bookings</span>
              <select value={form.availability} onChange={(e) => set("availability", e.target.value)}>
                {AVAILABILITY.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>
                Fee note <em>Optional</em>
              </span>
              <input value={form.feeNote} maxLength={300} placeholder="e.g. Payable September 1. Multiple-mare discounts." onChange={(e) => set("feeNote", e.target.value)} />
            </label>
          </div>
          <fieldset className="st-fieldset">
            <legend>How he breeds</legend>
            <div className="st-checks">
              {METHODS.map((m) => (
                <label key={m.value} className="st-check">
                  <input
                    type="checkbox"
                    checked={liveCoverOnly ? m.value === "live_cover" : form.methods.includes(m.value)}
                    disabled={liveCoverOnly}
                    onChange={(e) => set("methods", e.target.checked ? [...form.methods, m.value] : form.methods.filter((x) => x !== m.value))}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            {liveCoverOnly && <p className="st-muted">Thoroughbred foals are only registered from live cover.</p>}
            {!liveCoverOnly && form.methods.some((m) => m !== "live_cover") && (
              <label className="st-field">
                <span>
                  Shipping and collection <em>Optional</em>
                </span>
                <input value={form.shippingNote} maxLength={300} placeholder="e.g. Collected Mon/Wed/Fri, Feb 15 to Jul 15. Shipping $300 per dose." onChange={(e) => set("shippingNote", e.target.value)} />
              </label>
            )}
          </fieldset>
          <label className="st-field">
            <span>
              Breeders' programs <em>Optional</em>
            </span>
            <input value={form.programs} maxLength={300} placeholder="e.g. State-bred incentive program, stakes nominations" onChange={(e) => set("programs", e.target.value)} />
          </label>
        </Section>

        <Section title="Pedigree" hint="As far back as you can. Repeated names in a mare's pedigree show up in the mating check.">
          <PedigreeFields name={form.name} value={form.pedigree} onChange={(p) => set("pedigree", p)} disabled={busy} />
        </Section>

        <Section title="Race record" hint="Your figures show as “From the owner”. If he ran on Stayblz cards, link his record and breeders also see it from our data.">
          <div className="st-field">
            <label htmlFor="st-racing">His record in Stayblz racing data</label>
            {form.racingHorseId ? (
              <p className="st-linked">
                Linked: <strong>{form.racingHorseName}</strong>{" "}
                <button type="button" className="st-link" onClick={() => setForm((f) => ({ ...f, racingHorseId: null, racingHorseName: "" }))}>
                  Unlink
                </button>
              </p>
            ) : (
              <HorseLookup
                id="st-racing"
                label="His record in Stayblz racing data"
                sex="male"
                value={form.racingHorseName}
                placeholder="Type his name to find him"
                onChange={(t) => set("racingHorseName", t)}
                onPick={(h) =>
                  setForm((f) => ({
                    ...f,
                    racingHorseId: h.id,
                    racingHorseName: h.name,
                    foaled: f.foaled || str(h.foaled),
                    color: f.color || h.color,
                    pedigree: { ...(h.sire ? { s: h.sire } : {}), ...(h.dam ? { d: h.dam } : {}), ...(h.damSire ? { ds: h.damSire } : {}), ...f.pedigree },
                  }))
                }
              />
            )}
          </div>
          <div className="st-grid-6">
            {(["starts", "wins", "places", "shows"] as const).map((k) => (
              <label key={k} className="st-field">
                <span>{{ starts: "Starts", wins: "Wins", places: "Seconds", shows: "Thirds" }[k]}</span>
                <input type="number" inputMode="numeric" min={0} max={999} value={form[k]} onChange={(e) => set(k, e.target.value)} />
              </label>
            ))}
            <div className="st-field st-span-2">
              <label htmlFor="st-earnings">Earnings</label>
              <div className="st-input-with">
                <select aria-label="Earnings currency" value={form.earningsCurrency} onChange={(e) => set("earningsCurrency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input id="st-earnings" type="number" inputMode="numeric" min={0} value={form.earnings} onChange={(e) => set("earnings", e.target.value)} />
              </div>
            </div>
          </div>
          <label className="st-field">
            <span>
              Race highlights <em>Optional, one per line, up to 8</em>
            </span>
            <textarea rows={3} value={form.highlights} onChange={(e) => set("highlights", e.target.value)} placeholder={"Won a 1 1/8-mile stakes on dirt\nSecond in a graded stakes at 3"} />
          </label>
        </Section>

        <Section title="Genetics and fertility" hint="Breeders of Quarter Horses, Paints and Arabians look for these first. Leave tests out if he isn't tested.">
          <GeneticsFields breed={form.breed} value={form.genetics} onChange={(g) => set("genetics", g)} disabled={busy} />
          <div className="st-grid-3">
            <label className="st-field">
              <span>
                Live foal rate % <em>Optional</em>
              </span>
              <input type="number" inputMode="numeric" min={0} max={100} value={form.fertilityRate} onChange={(e) => set("fertilityRate", e.target.value)} />
            </label>
            <label className="st-field st-span-2">
              <span>
                Fertility note <em>Optional</em>
              </span>
              <input value={form.fertilityNote} maxLength={300} placeholder="e.g. 2025 season, 48 mares covered" onChange={(e) => set("fertilityNote", e.target.value)} />
            </label>
          </div>
        </Section>

        <section className="st-form-section gx-glass">
          <h2 className="st-panel-title">Photos, videos and documents</h2>
          <MediaManager items={media} setItems={setMedia} disabled={busy} api={STALLION_MEDIA} audience="breeders" />
          <DocumentManager
            items={docs}
            setItems={setDocs}
            disabled={busy}
            api={STALLION_MEDIA}
            help="His breeding contract, stallion service terms, vet or fertility reports, as PDF (up to 10 MB each, 5 in all). Anyone viewing his page can download them."
          />
        </section>

        <Section title="About him">
          <label className="st-field">
            <span>
              Description <em>Optional</em>
            </span>
            <textarea rows={7} maxLength={4000} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="His temperament, what his foals are like, why breeders choose him…" />
            <small className="st-muted">{4000 - form.description.length} characters left</small>
          </label>
          {writer === true && (
            <p className="st-muted">
              <button type="button" className="btn btn-quiet" disabled={writing || busy} onClick={() => void write()}>
                {writing ? "Writing…" : "Write a draft for me"}
              </button>{" "}
              Uses only the facts in this form and his Stayblz racing data. Read it and change anything before saving.
            </p>
          )}
          {writer === false && (
            <p className="st-muted st-soon-line">
              <UnderWorkTag /> "Write a draft for me" (a first draft from the facts in this form) is coming soon. Write your own for now.
            </p>
          )}
        </Section>

        <section className="st-form-section gx-glass">
          <label className="st-check">
            <input type="checkbox" checked={form.inquiriesOpen} onChange={(e) => set("inquiriesOpen", e.target.checked)} />
            Breeders can send me requests about him (they arrive in Stayblz Chat)
          </label>
          <p className="st-muted">His page is public once published: anyone with the link can see it, with your name as the owner. Requests come to your Stayblz Chat.</p>
          <label className="st-check st-confirm">
            <input type="checkbox" checked={form.confirm} onChange={(e) => set("confirm", e.target.checked)} />
            I own or manage this stallion, and these details are true. I agree to the <Link to="/legal">Terms of Use</Link>.
          </label>
          {error && (
            <p className="st-alert is-error" role="alert">
              {error}
            </p>
          )}
          <div className="st-actions">
            <Link to={editing ? `/stallions/${id}` : "/stallions/manage"} className="btn btn-quiet">
              Cancel
            </Link>
            {!editing && (
              <button type="button" className="btn btn-quiet" disabled={busy || uploading} onClick={(e) => void submit(e as unknown as FormEvent, false)}>
                Save as draft
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || uploading}>
              {busy ? "Saving…" : uploading ? "Uploading…" : editing ? "Save changes" : "Publish"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
