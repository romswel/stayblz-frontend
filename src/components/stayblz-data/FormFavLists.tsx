import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../community/ui";
import { dateLabel, ordinal } from "../racing/format";
import { DetailShell, DetailState, useDetail } from "./detail";
import { formFav, type HorseRow, type HorseStart, type IndexCode, type ListMeta, type ListPage, type PersonRow, type RaceWhere } from "./formfavApi";
import { RaceDialog, RunnerStatsView } from "./formfavDialogs";
import { COUNTRIES, Table, Toggles, clock, listParam, listValue, n, pct, regionName, type StatsTarget } from "./formfavUi";
import PagedList from "./PagedList";
import AddToVirtualButton from "../virtual/AddToVirtualButton";

/**
 * Stayblz Data → Horses and Stats: A–Z lists, 20 per scroll, built on our server from FormFav's US/Canada race cards
 * (about the last 30 days and the next 1–2; lib/formFavIndex.ts in the backend).
 */

const PAGE_SIZE = 20;
/** FormFav has no North American greyhound racing, so the lists cover these two. */
const LIST_CODES: { value: IndexCode; key: string; label: string }[] = [
  { value: "gallops", key: "gallops", label: "Thoroughbreds" },
  { value: "harness", key: "harness", label: "Harness" },
];
export const codeLabel = (c: string) => LIST_CODES.find((x) => x.value === c)?.label ?? c;
const shortDay = (iso: string) => dateLabel(iso, "short").replace(/,? \d{4}$/, "");
type Set_ = (values: Record<string, string>) => void;

/** Search box text, applied after a short pause in typing. */
function useSearch() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);
  return { q, setQ, query };
}

function Coverage({ meta, noun, onRefresh }: { meta: ListMeta | null; noun: string; onRefresh: () => void }) {
  if (!meta) return null;
  return (
    <p className="sd-ff-coverage" role="note">
      {meta.building ? (
        <>
          Still gathering the last 30 days of racing, so this list may be short.{" "}
          <button type="button" className="cm-link" onClick={onRefresh}>
            Refresh
          </button>
        </>
      ) : (
        `${noun} from US and Canada race cards, ${shortDay(meta.coverage.from)} – ${shortDay(meta.coverage.to)}. A–Z.`
      )}
    </p>
  );
}

// ── Horses ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function HorsesView({ params, set, onStats }: { params: URLSearchParams; set: Set_; onStats: (t: StatsTarget) => void }) {
  const codes = listParam(params.get("hcodes"), LIST_CODES);
  const countries = listParam(params.get("hcountry"), COUNTRIES);
  const { q, setQ, query } = useSearch();
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<{ name: string; code: IndexCode } | null>(null);
  const [race, setRace] = useState<RaceWhere | null>(null);

  return (
    <>
      <div className="cm-toolbar gx-glass sd-ff-toolbar">
        <label className="cm-search">
          <Icon.Search />
          <input type="search" value={q} maxLength={60} placeholder="Search horses by name" aria-label="Search horses" onChange={(e) => setQ(e.target.value)} />
        </label>
        <Toggles label="Code" options={LIST_CODES} value={codes} onChange={(v) => set({ hcodes: listValue(v, LIST_CODES) })} />
        <Toggles label="Country" options={COUNTRIES} value={countries} onChange={(v) => set({ hcountry: listValue(v, COUNTRIES) })} />
      </div>
      <Coverage meta={meta} noun="Horses" onRefresh={() => setAttempt((a) => a + 1)} />
      <PagedList<HorseRow, ListPage<HorseRow>>
        key={`horses|${codes}|${countries}|${query}|${attempt}`}
        load={(offset, signal) => formFav.horses({ offset, limit: PAGE_SIZE, q: query, codes, countries }, signal)}
        onPage={setMeta}
        idOf={(h) => `${h.code}|${h.name}`}
        noun="horses"
        empty={meta?.building ? "Gathering horses…" : "No horses match"}
        emptyHint={meta?.building ? "The list fills in as the last 30 days are read. Try Refresh in a minute." : "Try another name, code or country."}
        render={(h) => <HorseCard horse={h} onOpen={() => setOpen({ name: h.name, code: h.code })} />}
      />
      {open && (
        <HorseDialog
          name={open.name}
          code={open.code}
          onClose={() => setOpen(null)}
          onRace={(where) => {
            setOpen(null);
            setRace(where);
          }}
          extra={<AddToVirtualButton target={{ formfav: { name: open.name, code: open.code } }} name={open.name} />}
        />
      )}
      {race && (
        <RaceDialog
          where={race}
          onClose={() => setRace(null)}
          onStats={(t) => {
            setRace(null);
            onStats(t);
          }}
        />
      )}
    </>
  );
}

function HorseCard({ horse, onOpen }: { horse: HorseRow; onOpen: () => void }) {
  const last = horse.lastStart;
  const next = horse.nextEntry;
  return (
    <button type="button" className="sd-card gx-glass sd-ff-row" onClick={onOpen}>
      <span className="sd-track">
        {horse.countries.map(regionName).join(" · ")} · {codeLabel(horse.code)}
      </span>
      <strong className="sd-title">{horse.name}</strong>
      <span className="sd-facts">
        {horse.starts} {horse.starts === 1 ? "start" : "starts"} · {horse.wins} {horse.wins === 1 ? "win" : "wins"} · {horse.places} top 3
      </span>
      {last && (
        <span className="sd-facts">
          Last: {last.position ? ordinal(last.position) : "ran"} at {last.track ?? last.slug} · {shortDay(last.date)}
        </span>
      )}
      {next && (
        <span className="sd-pill sd-ff-next">
          Entered: {next.track ?? next.slug} R{next.raceNumber} · {shortDay(next.date)}
        </span>
      )}
    </button>
  );
}

export const whereOf = (s: HorseStart): RaceWhere | null =>
  s.raceNumber === null ? null : { date: s.date, code: s.code, tz: s.timezone, track: s.slug, race: s.raceNumber, country: s.country };

/** One race-data horse: its US/Canada starts and entries in the window, and FormFav career stats. */
export function HorseDialog({
  name,
  code,
  onClose,
  onRace,
  extra,
}: {
  name: string;
  code: IndexCode;
  onClose: () => void;
  onRace: (where: RaceWhere) => void;
  /** Actions shown under the heading (e.g. Track in Virtual Stayblz). */
  extra?: ReactNode;
}) {
  const { data: horse, error, retry } = useDetail(() => formFav.horse(name, code));
  return (
    <DetailShell label={horse?.name ?? name} onClose={onClose}>
      {!horse ? (
        <DetailState error={error} retry={retry} />
      ) : (
        <>
          <header className="sd-detail-head">
            <span className="sd-track">
              {horse.countries.map(regionName).join(" · ")} · {codeLabel(horse.code)}
            </span>
            <h2>{horse.name}</h2>
            <p className="sd-facts">
              Last 30 days in the US &amp; Canada: {horse.starts} starts · {horse.wins} wins · {horse.places} top 3
            </p>
            {(horse.jockey || horse.trainer) && (
              <p className="sd-facts">{[horse.jockey && `Jockey ${horse.jockey}`, horse.trainer && `Trainer ${horse.trainer}`].filter(Boolean).join(" · ")}</p>
            )}
            {extra}
          </header>
          <h3>Starts and entries</h3>
          <Table
            head={["Date", "Track", "Race", "Fin", "Jockey", "Trainer"]}
            rows={horse.history.map((s, i) => {
              const where = whereOf(s);
              return {
                key: `${s.date}-${s.slug}-${s.raceNumber}-${i}`,
                scratched: s.scratched,
                cells: [
                  shortDay(s.date),
                  s.track ?? s.slug,
                  where ? (
                    <button type="button" className="cm-link" onClick={() => onRace(where)}>
                      R{s.raceNumber}
                      {clock(s.startTime) ? ` · ${clock(s.startTime)}` : ""}
                    </button>
                  ) : (
                    "—"
                  ),
                  s.scratched ? "SCR" : s.status === "final" ? (s.position ? ordinal(s.position) : "—") : s.status === "abandoned" ? "Off" : "Entered",
                  s.jockey ?? "—",
                  s.trainer ?? "—",
                ],
              };
            })}
          />
          <h3>FormFav career</h3>
          <Career name={horse.name} code={horse.code} />
        </>
      )}
    </DetailShell>
  );
}

/** FormFav's career stats for a horse found by name (FormFav's search needs 3+ letters; US and Canada horses only). */
export function Career({ name, code }: { name: string; code: IndexCode }) {
  const [state, setState] = useState<{ id: number | null; done: boolean; error: string }>({ id: null, done: false, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ id: null, done: false, error: "" });
    if (name.trim().length < 3) {
      setState({ id: null, done: true, error: "" });
      return;
    }
    formFav
      .searchRunners(name.trim().slice(0, 100), code, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return;
        // US and Canada horses only (the server already drops the rest): never another country's horse of that name.
        const home = r.results.filter((x) => x.id !== null && x.name?.toLowerCase() === name.toLowerCase() && /^(US|USA|CA|CAN)$/i.test(x.country ?? ""));
        const pick = home.sort((a, b) => (b.lastRaceDate ?? "").localeCompare(a.lastRaceDate ?? ""))[0];
        setState({ id: pick?.id ?? null, done: true, error: "" });
      })
      .catch((e) => !ctrl.signal.aborted && setState({ id: null, done: true, error: e instanceof Error ? e.message : "FormFav couldn't be reached." }));
    return () => ctrl.abort();
  }, [name, code, attempt]);
  if (!state.done) return <p className="sd-muted" role="status">Looking up {name} on FormFav…</p>;
  if (state.error)
    return (
      <p className="cm-error" role="alert">
        {state.error}{" "}
        <button type="button" className="cm-link" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </p>
    );
  if (state.id === null) return <p className="sd-muted">FormFav has no US or Canada career record under this name.</p>;
  return (
    <div className="sd-ff-career">
      <RunnerStatsView id={state.id} />
    </div>
  );
}

// ── Jockeys / trainers ───────────────────────────────────────────────────────────────────────────────────────────────

type Kind = "jockey" | "trainer";

export function PeopleView({ params, set, onStats }: { params: URLSearchParams; set: Set_; onStats: (t: StatsTarget) => void }) {
  const kind: Kind = params.get("kind") === "trainer" ? "trainer" : "jockey";
  const codes = listParam(params.get("pcodes"), LIST_CODES);
  const countries = listParam(params.get("pcountry"), COUNTRIES);
  const { q, setQ, query } = useSearch();
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [attempt, setAttempt] = useState(0);
  const noun = kind === "jockey" ? "jockeys" : "trainers";

  return (
    <>
      <div className="cm-toolbar gx-glass sd-ff-toolbar">
        <nav className="cm-seg" aria-label="Stats for">
          <button type="button" aria-pressed={kind === "jockey"} onClick={() => set({ kind: "" })}>
            Jockeys
          </button>
          <button type="button" aria-pressed={kind === "trainer"} onClick={() => set({ kind: "trainer" })}>
            Trainers
          </button>
        </nav>
        <label className="cm-search">
          <Icon.Search />
          <input type="search" value={q} maxLength={60} placeholder={`Search ${noun} by name`} aria-label={`Search ${noun}`} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Toggles label="Code" options={LIST_CODES} value={codes} onChange={(v) => set({ pcodes: listValue(v, LIST_CODES) })} />
        <Toggles label="Country" options={COUNTRIES} value={countries} onChange={(v) => set({ pcountry: listValue(v, COUNTRIES) })} />
      </div>
      <Coverage meta={meta} noun={kind === "jockey" ? "Jockeys and drivers" : "Trainers"} onRefresh={() => setAttempt((a) => a + 1)} />
      <PagedList<PersonRow, ListPage<PersonRow>>
        key={`${kind}|${codes}|${countries}|${query}|${attempt}`}
        load={(offset, signal) => formFav.people(kind, { offset, limit: PAGE_SIZE, q: query, codes, countries }, signal)}
        onPage={setMeta}
        idOf={(p) => p.name}
        noun={noun}
        empty={meta?.building ? `Gathering ${noun}…` : `No ${noun} match`}
        emptyHint={meta?.building ? "The list fills in as the last 30 days are read. Try Refresh in a minute." : "Try another name, code or country."}
        render={(p) => (
          <PersonCard person={p} onOpen={() => onStats({ kind, name: p.name, summary: p, code: codes.length === 1 ? codes[0] : undefined })} />
        )}
      />
    </>
  );
}

function PersonCard({ person, onOpen }: { person: PersonRow; onOpen: () => void }) {
  return (
    <button type="button" className="sd-card gx-glass sd-ff-row" onClick={onOpen}>
      <span className="sd-track">{person.kind}</span>
      <strong className="sd-title">{person.name}</strong>
      <span className="sd-facts">
        {n(person.rides)} {person.kind === "jockey" ? (person.rides === 1 ? "ride" : "rides") : person.rides === 1 ? "runner" : "runners"} · {n(person.wins)}{" "}
        {person.wins === 1 ? "win" : "wins"} · {pct(person.winRate)} win
      </span>
      <span className="sd-facts">
        {[person.lastRide ? `Last ${shortDay(person.lastRide)}` : null, person.upcoming ? `${person.upcoming} entered next` : null, `${person.tracks} ${person.tracks === 1 ? "track" : "tracks"}`]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </button>
  );
}

