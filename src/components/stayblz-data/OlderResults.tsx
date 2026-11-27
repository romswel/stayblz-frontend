import { useEffect, useState } from "react";
import { dateLabel } from "../racing/format";
import AddToVirtualButton from "../virtual/AddToVirtualButton";
import { DetailShell } from "./detail";
import { formFav, type IndexCode, type OlderHorse, type OlderPerson } from "./formfavApi";
import { RunnerStatsView } from "./formfavDialogs";
import { regionName } from "./formfavUi";

/**
 * Horses and people not in the last 30 days of US/Canada race data: first the Stayblz race history (kept for a year,
 * from Oct 26 2026), then FormFav's search (older horses: FormFav's profile only; people: country not confirmed).
 * Shown under the A–Z lists once a search has 3+ letters, and in the Virtual Stayblz add/link dialogs.
 */

export const OLDER_MIN = 3;
export const HISTORY_NOTE = "Stayblz keeps race-by-race results from Oct 26, 2026 for a year; FormFav itself keeps about 30 days.";
const longDay = (iso: string | null | undefined) => (iso ? dateLabel(iso.slice(0, 10), "short") : null);
const CODE_LABEL: Record<IndexCode, string> = { gallops: "Thoroughbred", harness: "Harness" };

type Older<T> = { rows: T[] | null; error: string };
/** Older matches for `q` (3+ letters; the caller debounces). Late answers for an earlier search are dropped. */
function useOlder<T>(q: string, load: (signal: AbortSignal) => Promise<{ records: T[] }>, deps: unknown[]): Older<T> {
  const [state, setState] = useState<Older<T>>({ rows: null, error: "" });
  useEffect(() => {
    setState({ rows: null, error: "" });
    if (q.trim().length < OLDER_MIN) return;
    const c = new AbortController();
    load(c.signal)
      .then((r) => !c.signal.aborted && setState({ rows: Array.isArray(r.records) ? r.records : [], error: "" }))
      .catch((e) => !c.signal.aborted && setState({ rows: [], error: e instanceof Error ? e.message : "Older records couldn't be searched." }));
    return () => c.abort();
  }, [q, ...deps]);
  return state;
}
export function useOlderHorses(q: string, codes: IndexCode[] = ["gallops", "harness"]) {
  return useOlder<OlderHorse>(q, (signal) => formFav.olderHorses(q.trim(), codes, signal), [codes.join(",")]);
}

/** One line about an older horse: where its record comes from, last race, pedigree. */
export function olderHorseFacts(h: OlderHorse) {
  return [
    h.source === "history" ? "Stayblz history" : "FormFav profile",
    CODE_LABEL[h.code],
    h.country ? regionName(h.country.slice(0, 2)) : null,
    h.lastDate ? `last raced ${longDay(h.lastDate)}` : null,
    h.source === "history" && h.starts !== null ? `${h.starts} ${h.starts === 1 ? "start" : "starts"} · ${h.wins ?? 0} ${h.wins === 1 ? "win" : "wins"}` : h.starts ? `${h.starts} career starts` : null,
    h.sire || h.dam ? `${h.sire ?? "?"} – ${h.dam ?? "?"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function OlderHorses({ q, codes, onOpen }: { q: string; codes: IndexCode[]; onOpen: (h: OlderHorse) => void }) {
  const { rows, error } = useOlderHorses(q, codes);
  if (q.trim().length < OLDER_MIN) return null;
  return (
    <section className="sd-older" aria-label="Older horses">
      <header className="sd-older-head">
        <h3>Older horses</h3>
        <p>Not raced in the US or Canada in the last 30 days. {HISTORY_NOTE}</p>
      </header>
      {error ? (
        <p className="cm-error" role="status">{error}</p>
      ) : rows === null ? (
        <p className="sd-muted" role="status">Searching older records…</p>
      ) : rows.length === 0 ? (
        <p className="sd-muted" role="status">No older US or Canada horse called “{q.trim()}”.</p>
      ) : (
        <div className="cm-grid sd-grid">
          {rows.map((h) => (
            <div key={`${h.source}|${h.key}|${h.runnerId ?? ""}`}>
              <button type="button" className="sd-card gx-glass sd-ff-row sd-older-card" onClick={() => onOpen(h)}>
                <span className="sd-track">{h.source === "history" ? "Stayblz history" : "FormFav profile"}</span>
                <strong className="sd-title">{h.name}</strong>
                <span className="sd-facts">{olderHorseFacts(h).replace(/^(Stayblz history|FormFav profile) · /, "")}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function OlderPeople({ kind, q, onOpen }: { kind: "jockey" | "trainer"; q: string; onOpen: (p: OlderPerson) => void }) {
  const { rows, error } = useOlder<OlderPerson>(q, (signal) => formFav.olderPeople(kind, q.trim(), signal), [kind]);
  if (q.trim().length < OLDER_MIN) return null;
  const noun = kind === "jockey" ? "jockeys and drivers" : "trainers";
  return (
    <section className="sd-older" aria-label={`Older ${noun}`}>
      <header className="sd-older-head">
        <h3>Older {noun}</h3>
        <p>Not seen in US or Canada racing in the last 30 days. FormFav doesn't say where its people ride, so those are marked.</p>
      </header>
      {error ? (
        <p className="cm-error" role="status">{error}</p>
      ) : rows === null ? (
        <p className="sd-muted" role="status">Searching older records…</p>
      ) : rows.length === 0 ? (
        <p className="sd-muted" role="status">No older {noun} called “{q.trim()}”.</p>
      ) : (
        <div className="cm-grid sd-grid">
          {rows.map((p) => (
            <div key={`${p.source}|${p.key}`}>
              <button type="button" className="sd-card gx-glass sd-ff-row sd-older-card" onClick={() => onOpen(p)}>
                <span className="sd-track">{p.source === "history" ? "Stayblz history" : "FormFav · country not confirmed"}</span>
                <strong className="sd-title">{p.name}</strong>
                <span className="sd-facts">
                  {[
                    p.rides !== null ? `${p.rides} ${kind === "jockey" ? (p.rides === 1 ? "ride" : "rides") : p.rides === 1 ? "runner" : "runners"}` : null,
                    p.wins !== undefined ? `${p.wins} ${p.wins === 1 ? "win" : "wins"}` : null,
                    p.lastDate ? `last ${longDay(p.lastDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "FormFav search result"}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** An older horse only FormFav knows: its profile, FormFav's career stats, and Track (alerts when it runs again). */
export function OlderHorseDialog({ horse, onClose }: { horse: OlderHorse; onClose: () => void }) {
  return (
    <DetailShell label={horse.name} onClose={onClose}>
      <header className="sd-detail-head">
        <span className="sd-track">FormFav profile · {CODE_LABEL[horse.code]}{horse.country ? ` · ${regionName(horse.country.slice(0, 2))}` : ""}</span>
        <h2>{horse.name}</h2>
        <p className="sd-facts">
          {[horse.lastDate ? `Last raced ${longDay(horse.lastDate)}` : "No recent race date", horse.starts ? `${horse.starts} career starts` : null].filter(Boolean).join(" · ")}
        </p>
        {(horse.sire || horse.dam) && (
          <p className="sd-facts">
            By {horse.sire ?? "?"} out of {horse.dam ?? "?"}
          </p>
        )}
        <p className="sd-muted">
          Not raced in the US or Canada since Stayblz started keeping results (Oct 26, 2026), so there are no race-by-race results. Track it to get
          an alert when it's entered again.
        </p>
        <AddToVirtualButton target={{ formfav: { name: horse.name, code: horse.code, runnerId: horse.runnerId ?? null } }} name={horse.name} />
      </header>
      <h3>FormFav career</h3>
      {horse.runnerId ? (
        <div className="sd-ff-career">
          <RunnerStatsView id={horse.runnerId} />
        </div>
      ) : (
        <p className="sd-muted">FormFav has no career record for this horse.</p>
      )}
    </DetailShell>
  );
}
