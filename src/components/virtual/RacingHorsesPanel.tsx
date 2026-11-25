import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import { Icon } from "../community/ui";
import { dateLabel, ordinal } from "../racing/format";
import { HorseDialog, codeLabel } from "../stayblz-data/FormFavLists";
import { RaceDialog, StatsDialog } from "../stayblz-data/formfavDialogs";
import { COUNTRIES, Toggles, regionName, type StatsTarget } from "../stayblz-data/formfavUi";
import type { Country, IndexCode, ListMeta, ListPage, RaceWhere } from "../stayblz-data/formfavApi";
import PagedList from "../stayblz-data/PagedList";
import type { RacingHorseRow, VirtualApi, VirtualMode } from "./api";
import { EyeIcon } from "./AddToVirtualButton";
import "../stayblz-data/stayblz-data.css";

/**
 * Virtual Stayblz → Racing horses: race-data horses (US and Canada race cards, about the last 30 days and the next
 * 1–2), most followed on Stayblz first, then A–Z. Tracking one adds it to this list's Racing horses (not the main
 * list), keeps its details and race log up to date, and sends alerts when it's entered, scratched or has run.
 */
const PAGE_SIZE = 20;
const CODES: { value: IndexCode; key: string; label: string }[] = [
  { value: "gallops", key: "gallops", label: "Thoroughbreds" },
  { value: "harness", key: "harness", label: "Harness" },
];
const shortDay = (iso: string) => dateLabel(iso, "short").replace(/,? \d{4}$/, "");
const keyOf = (r: { name: string; code: string }) => `${r.code}|${r.name.toLowerCase()}`;

export default function RacingHorsesPanel({
  client,
  mode,
  onOpenTracked,
}: {
  client: VirtualApi;
  mode: VirtualMode;
  onOpenTracked: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [codes, setCodes] = useState<IndexCode[]>(["gallops", "harness"]);
  const [countries, setCountries] = useState<Country[]>(["us", "ca"]);
  const [tracking, setTracking] = useState(false);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Tracked from here since the list loaded (the list itself isn't reloaded for that).
  const [added, setAdded] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<{ name: string; code: IndexCode } | null>(null);
  const [race, setRace] = useState<RaceWhere | null>(null);
  const [stats, setStats] = useState<StatsTarget | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const trackedId = (r: { name: string; code: string; trackingId?: string | null }) => r.trackingId ?? added[keyOf(r)] ?? null;

  async function track(name: string, code: IndexCode) {
    const k = keyOf({ name, code });
    setBusy(k);
    setError("");
    try {
      const r = await client.add({ source: "formfav", formfavName: name, formfavCode: code });
      setAdded((a) => ({ ...a, [k]: r.horse.id }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_added") {
        const s = await client.state({ formfav: { name, code } }).catch(() => null);
        if (s?.id) setAdded((a) => ({ ...a, [k]: s.id! }));
        else setError(e.message);
      } else setError(e instanceof Error ? e.message : `${name} couldn't be tracked.`);
    } finally {
      setBusy(null);
    }
  }

  const TrackButton = ({ name, code, id }: { name: string; code: IndexCode; id: string | null }) =>
    id ? (
      <button type="button" className="vs-btn" onClick={() => onOpenTracked(id)}>
        Open
      </button>
    ) : (
      <button
        type="button"
        className="vs-btn vs-btn-primary"
        disabled={busy === keyOf({ name, code })}
        onClick={() => void track(name, code)}
        aria-label={`Track ${name}`}
      >
        <EyeIcon /> {busy === keyOf({ name, code }) ? "Tracking…" : "Track"}
      </button>
    );

  return (
    <section className="vs-racing" aria-label="Racing horses">
      <div className="cm-toolbar gx-glass sd-ff-toolbar vs-rtoolbar">
        <label className="cm-search">
          <Icon.Search />
          <input type="search" value={q} maxLength={60} placeholder="Search racing horses by name" aria-label="Search racing horses" onChange={(e) => setQ(e.target.value)} />
        </label>
        <Toggles label="Code" options={CODES} value={codes} onChange={setCodes} />
        <Toggles label="Country" options={COUNTRIES} value={countries} onChange={setCountries} />
        <label className="vs-check">
          <input type="checkbox" checked={tracking} onChange={(e) => setTracking(e.target.checked)} />
          <span>{mode === "personal" ? "Tracking only" : "Team tracking only"}</span>
        </label>
      </div>
      {meta && (
        <p className="sd-ff-coverage" role="note">
          {meta.building ? (
            <>
              Still gathering the last 30 days of racing, so this list may be short.{" "}
              <button type="button" className="cm-link" onClick={() => setAttempt((a) => a + 1)}>
                Refresh
              </button>
            </>
          ) : (
            `US and Canada race cards, ${shortDay(meta.coverage.from)} – ${shortDay(meta.coverage.to)}. Most followed first. Updates about every 30 minutes.`
          )}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <PagedList<RacingHorseRow, ListPage<RacingHorseRow>>
        key={`racing|${mode}|${codes}|${countries}|${query}|${tracking}|${attempt}`}
        load={(offset, signal) => client.racingHorses({ offset, limit: PAGE_SIZE, q: query, codes, countries, tracking }, signal)}
        onPage={setMeta}
        idOf={(h) => keyOf(h)}
        noun="racing horses"
        empty={tracking ? "No racing horses tracked yet" : meta?.building ? "Gathering horses…" : "No racing horses match"}
        emptyHint={
          tracking
            ? "Turn off “Tracking only” and choose Track on a horse to follow it here."
            : meta?.building
              ? "The list fills in as the last 30 days are read. Try Refresh in a minute."
              : "Try another name, code or country."
        }
        render={(h) => {
          const id = trackedId(h);
          return (
            <article className="sd-card gx-glass sd-ff-row vs-rcard" data-horse={h.name}>
              <span className="sd-track">
                {h.countries.length ? `${h.countries.map(regionName).join(" · ")} · ` : ""}
                {codeLabel(h.code)}
              </span>
              <button type="button" className="vs-rname" onClick={() => (id ? onOpenTracked(id) : setOpen({ name: h.name, code: h.code }))}>
                <strong className="sd-title">{h.name}</strong>
              </button>
              <span className="vs-rpills">
                <span className="vs-followers" aria-label={`${h.followers} following on Stayblz`}>
                  {h.followers} following
                </span>
                {id && <span className="vs-badge is-formfav">Tracking</span>}
              </span>
              {h.noRecentRuns ? (
                <span className="sd-facts">No runs in the last 30 days</span>
              ) : (
                <>
                  <span className="sd-facts">
                    {h.starts} {h.starts === 1 ? "start" : "starts"} · {h.wins} {h.wins === 1 ? "win" : "wins"} · {h.places} top 3
                    {h.trainer ? ` · ${h.trainer}` : ""}
                  </span>
                  {h.lastStart && (
                    <span className="sd-facts">
                      Last: {h.lastStart.position ? ordinal(h.lastStart.position) : "ran"} at {h.lastStart.track ?? h.lastStart.slug} · {shortDay(h.lastStart.date)}
                    </span>
                  )}
                  {h.nextEntry && (
                    <span className="sd-pill sd-ff-next">
                      Entered: {h.nextEntry.track ?? h.nextEntry.slug} R{h.nextEntry.raceNumber} · {shortDay(h.nextEntry.date)}
                    </span>
                  )}
                </>
              )}
              <span className="vs-rcard-actions">
                <TrackButton name={h.name} code={h.code} id={id} />
              </span>
            </article>
          );
        }}
      />
      <p className="vs-foot vs-muted">
        Tracked racing horses stay here, apart from {mode === "personal" ? "your" : "the team's"} other horses. Their details and race log update
        from race data, and you get alerts when they're entered, scratched or have run. Data: FormFav.
      </p>
      {open && (
        <HorseDialog
          name={open.name}
          code={open.code}
          onClose={() => setOpen(null)}
          onRace={(where) => {
            setOpen(null);
            setRace(where);
          }}
          extra={
            <div className="vs-rdialog-actions">
              <TrackButton name={open.name} code={open.code} id={added[keyOf(open)] ?? null} />
            </div>
          }
        />
      )}
      {race && (
        <RaceDialog
          where={race}
          onClose={() => setRace(null)}
          onStats={(t) => {
            setRace(null);
            setStats(t);
          }}
        />
      )}
      {stats && <StatsDialog target={stats} onClose={() => setStats(null)} />}
    </section>
  );
}
