import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../workspace";
import { horseImageUrl, money } from "../community/api";
import PublicHorsesPanel from "./PublicHorsesPanel";
// Race data (Stayblz Data's FormFav code) loads only when the tab is opened.
const RacingHorsesPanel = lazy(() => import("./RacingHorsesPanel"));
import AddVirtualHorseDialog, { initials } from "./AddVirtualHorseDialog";
import VirtualHorseDetail from "./VirtualHorseDetail";
import { SOURCE_LABELS, dayLabel, useVirtualApis, type VirtualApi, type VirtualListHorse, type VirtualMode } from "./api";
import "./virtual.css";

/**
 * Virtual Stayblz: horses you (personal) or your stable (stable) track without owning them.
 * Search params: `vtab=public` for the Public horses tab, `vtab=racing` for Racing horses (race-data horses, kept
 * apart from the list), `horse=<id>` to open a tracked horse (in either the list or Racing horses).
 * Other params (like My racing's `tab`) are kept.
 */
export default function VirtualStayblz({ mode }: { mode: VirtualMode }) {
  const apis = useVirtualApis();
  const client = apis[mode];
  const { active } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("vtab");
  const vtab = rawTab === "public" ? "public" : rawTab === "racing" ? "racing" : "tracked";
  const horseId = params.get("horse");
  const [listVersion, setListVersion] = useState(0);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: false },
    );

  // Switching stables closes a horse from the previous stable's list.
  const stableId = active?.id ?? null;
  const lastStable = useRef(stableId);
  useEffect(() => {
    if (mode === "stable" && lastStable.current !== stableId && horseId) update({ horse: null });
    lastStable.current = stableId;
  }, [stableId]);

  const listName = mode === "personal" ? "My Virtual Stayblz" : `${active?.name ?? "Team"} · Virtual Stayblz`;

  return (
    <div className="vs">
      <div className="vs-intro">
        <span className="vs-kicker">{mode === "personal" ? "Private to your account" : `Shared with ${active?.name ?? "your stable"}`}</span>
        <p>
          Track horses you don't own: rivals, prospects and sale candidates. Follow their performance, workouts, races and sales
          entries {mode === "personal" ? "in a list only you can see." : "together with your team."}
        </p>
      </div>

      <div className="vs-seg vs-tabs" role="tablist" aria-label="Virtual Stayblz">
        <button type="button" role="tab" aria-selected={vtab === "tracked"} className="vs-seg-btn" onClick={() => update({ vtab: null, horse: null })}>
          {mode === "personal" ? "My tracked horses" : "Team tracked horses"}
        </button>
        <button type="button" role="tab" aria-selected={vtab === "public"} className="vs-seg-btn" onClick={() => update({ vtab: "public", horse: null })}>
          Public horses
        </button>
        <button type="button" role="tab" aria-selected={vtab === "racing"} className="vs-seg-btn" onClick={() => update({ vtab: "racing", horse: null })}>
          Racing horses
        </button>
      </div>

      {vtab === "public" ? (
        <PublicHorsesPanel />
      ) : vtab === "racing" && horseId ? (
        <VirtualHorseDetail
          key={`${stableId}:${horseId}`}
          client={client}
          mode={mode}
          id={horseId}
          backLabel="← Racing horses"
          onBack={() => update({ horse: null })}
          onChanged={() => setListVersion((v) => v + 1)}
        />
      ) : vtab === "racing" ? (
        <Suspense fallback={<p className="vs-muted" aria-busy="true">Loading racing horses…</p>}>
          <RacingHorsesPanel
            key={mode === "stable" ? stableId ?? "none" : "me"}
            client={client}
            mode={mode}
            onOpenTracked={(id) => update({ horse: id })}
          />
        </Suspense>
      ) : horseId ? (
        <VirtualHorseDetail
          key={`${stableId}:${horseId}`}
          client={client}
          mode={mode}
          id={horseId}
          onBack={() => update({ horse: null })}
          onChanged={() => setListVersion((v) => v + 1)}
        />
      ) : (
        <VirtualHorseList
          key={mode === "stable" ? stableId ?? "none" : "me"}
          client={client}
          mode={mode}
          listName={listName}
          version={listVersion}
          onOpen={(id, racing) => update({ horse: id, vtab: racing ? "racing" : null })}
        />
      )}
    </div>
  );
}

function VirtualHorseList({
  client,
  mode,
  listName,
  version,
  onOpen,
}: {
  client: VirtualApi;
  mode: VirtualMode;
  listName: string;
  version: number;
  /** `racing`: a horse from race data, which opens under Racing horses. */
  onOpen: (id: string, racing?: boolean) => void;
}) {
  const [horses, setHorses] = useState<VirtualListHorse[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    setError("");
    client
      .list(c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        if (!Array.isArray(r.horses)) throw Error("Your tracked horses couldn't be loaded.");
        setHorses(r.horses);
      })
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Your tracked horses couldn't be loaded."));
    return () => c.abort();
  }, [client, version, reload]);

  // Racing horses (tracked from the Racing horses tab) get their own section under the list's own horses.
  const own = useMemo(() => (horses ?? []).filter((h) => h.source !== "formfav"), [horses]);
  const racing = useMemo(() => (horses ?? []).filter((h) => h.source === "formfav"), [horses]);
  const match = (h: VirtualListHorse) => {
    const f = filter.trim().toLowerCase();
    return !f || h.name.toLowerCase().includes(f);
  };
  const shown = own.filter(match);
  const shownRacing = racing.filter(match);

  return (
    <section className="vs-list" aria-label={listName}>
      <div className="vs-toolbar">
        {!!horses?.length && (
          <label className="vs-field vs-filter">
            <span className="vs-sr">Filter tracked horses</span>
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" maxLength={60} />
          </label>
        )}
        <button type="button" className="vs-btn vs-btn-primary" onClick={() => setAdding(true)}>+ Add horse</button>
      </div>

      {error ? (
        <div>
          <p className="form-error" role="alert">{error}</p>
          <button type="button" className="vs-btn" onClick={() => setReload((v) => v + 1)}>Try again</button>
        </div>
      ) : horses === null ? (
        <p className="vs-muted" aria-busy="true">Loading tracked horses…</p>
      ) : horses.length === 0 ? (
        <div className="vs-empty">
          <h3>No horses tracked yet</h3>
          <p>
            Add a horse from the <strong>Public horses</strong> tab, from a horse shared in Feeds, from racing data, or type one in by hand.
            Racehorses from US and Canada race cards are tracked from the <strong>Racing horses</strong> tab and show up here too.
          </p>
        </div>
      ) : shown.length === 0 && shownRacing.length === 0 ? (
        <p className="vs-muted">No tracked horses match “{filter.trim()}”.</p>
      ) : (
        <>
        {shown.length > 0 && racing.length > 0 && <h3 className="vs-list-head">{mode === "personal" ? "Your horses" : "Team horses"}</h3>}
        {shown.length === 0 && racing.length > 0 && !filter.trim() && (
          <p className="vs-muted">Only racing horses so far. Use + Add horse to track other horses here.</p>
        )}
        {shown.length > 0 && <ul className="vs-cards">
          {shown.map((h) => {
            const total = h.counts.workouts + h.counts.races + h.counts.sales + h.counts.notes;
            return (
              <li key={h.id}>
                <button type="button" className="vs-card" onClick={() => onOpen(h.id)}>
                  <span className="vs-avatar" aria-hidden="true">
                    {h.live?.coverImageId ? <img src={horseImageUrl(h.live.coverImageId)} alt="" loading="lazy" /> : initials(h.name)}
                  </span>
                  <span className="vs-card-body">
                    <span className={`vs-badge is-${h.source}`}>{SOURCE_LABELS[h.source]}</span>
                    <strong>{h.name}</strong>
                    <small>{[h.breed, h.sire && h.dam ? `${h.sire} – ${h.dam}` : h.sire || h.dam].filter(Boolean).join(" · ") || "No details yet"}</small>
                    {h.live && (
                      <small className="vs-card-stats">
                        {h.live.starts} starts · {h.live.wins}-{h.live.places}-{h.live.shows}
                        {h.live.earningsCents != null ? ` · ${money(h.live.earningsCents, true)}` : ""}
                      </small>
                    )}
                    <span className="vs-chips">
                      {h.counts.workouts > 0 && <span>{h.counts.workouts} workout{h.counts.workouts === 1 ? "" : "s"}</span>}
                      {h.counts.races > 0 && <span>{h.counts.races} race{h.counts.races === 1 ? "" : "s"}</span>}
                      {h.counts.sales > 0 && <span>{h.counts.sales} sale{h.counts.sales === 1 ? "" : "s"}</span>}
                      {h.counts.notes > 0 && <span>{h.counts.notes} note{h.counts.notes === 1 ? "" : "s"}</span>}
                      {total === 0 && <span className="is-quiet">Nothing logged yet</span>}
                    </span>
                    {h.lastEntry && <small className="vs-muted">Last entry {dayLabel(h.lastEntry)}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>}
        {shownRacing.length > 0 && (
          <section className="vs-racing-section" aria-label="Racing horses you track">
            <h3 className="vs-list-head">
              Racing horses <small>US and Canada race data · also in the Racing horses tab</small>
            </h3>
            <ul className="vs-cards">
              {shownRacing.map((h) => (
                <li key={h.id}>
                  <button type="button" className="vs-card" onClick={() => onOpen(h.id)}>
                    <span className="vs-avatar" aria-hidden="true">{initials(h.name)}</span>
                    <span className="vs-card-body">
                      <span className="vs-badge is-formfav">{SOURCE_LABELS.formfav}</span>
                      <strong>{h.name}</strong>
                      <small>
                        {[h.formfav?.code === "harness" ? "Harness" : "Thoroughbred", h.race?.trainer ?? h.trainer].filter(Boolean).join(" · ")}
                      </small>
                      {h.race ? (
                        <small className="vs-card-stats">
                          Last 30 days: {h.race.starts} start{h.race.starts === 1 ? "" : "s"} · {h.race.wins} win{h.race.wins === 1 ? "" : "s"} · {h.race.places} top 3
                        </small>
                      ) : (
                        <small className="vs-muted">No runs in the last 30 days</small>
                      )}
                      {h.race?.nextEntry && (
                        <span className="vs-chips">
                          <span>
                            Entered: {h.race.nextEntry.track ?? h.race.nextEntry.slug}
                            {h.race.nextEntry.raceNumber ? ` R${h.race.nextEntry.raceNumber}` : ""} · {dayLabel(h.race.nextEntry.date)}
                          </span>
                        </span>
                      )}
                      {h.counts.races > 0 && <small className="vs-muted">{h.counts.races} race{h.counts.races === 1 ? "" : "s"} in the log</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        </>
      )}
      {own.length >= 300 && <p className="vs-muted">This list is full (300 horses). Remove some to add more.</p>}

      {adding && (
        <AddVirtualHorseDialog
          client={client}
          listName={listName}
          onClose={() => setAdding(false)}
          onAdded={(h) => {
            setAdding(false);
            setReload((v) => v + 1);
            onOpen(h.id, h.source === "formfav");
          }}
        />
      )}
      <p className="vs-foot vs-muted">
        {mode === "personal"
          ? "Owners aren't told when you track their horse. Only you can see this list."
          : "Everyone in this stable can see this list and log entries. Owners of tracked horses aren't told."}
      </p>
    </section>
  );
}
