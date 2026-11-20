import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { followsApi, type Follow, type FollowKind } from "../racing/follows";
import { dateLabel, ordinal } from "../racing/format";
import type { Start } from "../racing/types";
import VirtualStable from "../../pages/VirtualStable";
import "./following.css";

type Filter = "all" | FollowKind;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "horse", label: "Horses" },
  { key: "family", label: "Families" },
  { key: "person", label: "People" },
];
const roleLabel: Record<string, string> = { jockey: "Jockey", driver: "Driver", trainer: "Trainer", owner: "Owner" };

function nameOf(f: Follow) {
  return f.horse?.name ?? f.person?.name ?? "Removed record";
}
function linkOf(f: Follow) {
  if (f.horse) return `/racing/horses/${f.horse.id}`;
  if (f.person) return `/racing/people/${f.person.id}`;
  return null;
}
function whatOf(f: Follow) {
  if (f.kind === "family")
    return `Family · ${f.relatives ? `${f.relatives} relative${f.relatives === 1 ? "" : "s"} on Stayblz` : "no relatives on Stayblz yet"}`;
  if (f.kind === "person") return roleLabel[f.person?.kind ?? ""] ?? "Person";
  return [f.horse?.sire && `By ${f.horse.sire}`, f.horse?.dam && `out of ${f.horse.dam}`].filter(Boolean).join(" ") || "Horse";
}
/** "Race 3 · FX · Mon, Jun 8", plus the horse when it's someone else's runner (person or family follows). */
function StartLine({ label, start, follow }: { label: string; start: Start; follow: Follow }) {
  const other = follow.kind !== "horse";
  const result =
    label === "Last"
      ? start.finish === 1
        ? "Won"
        : start.finish
          ? `${ordinal(start.finish)} of ${start.field}`
          : "Ran"
      : null;
  return (
    <p className="fl-start">
      <span className="fl-start-label">{label}</span>
      <Link to={`/racing/races/${start.raceId}`}>
        {other && <strong>{start.horse.name} · </strong>}
        {result && <strong>{result} · </strong>}
        Race {start.race} · <abbr title={start.track}>{start.trackCode}</abbr> · {dateLabel(start.date, "short")}
      </Link>
    </p>
  );
}

/** My racing → Following: everything you follow on the linked racing data, with the next and last start. */
export default function FollowingPanel() {
  const [follows, setFollows] = useState<Follow[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showOlder, setShowOlder] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    setError("");
    followsApi
      .list(c.signal)
      .then((d) => !c.signal.aborted && setFollows(Array.isArray(d.follows) ? d.follows : []))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Your follows could not be loaded."));
    return () => c.abort();
  }, [attempt]);

  const counts = useMemo(() => {
    const out: Record<Filter, number> = { all: 0, horse: 0, family: 0, person: 0 };
    for (const f of follows ?? []) {
      out.all++;
      out[f.kind]++;
    }
    return out;
  }, [follows]);
  const shown = (follows ?? []).filter((f) => filter === "all" || f.kind === filter);

  async function unfollow(f: Follow) {
    const target = f.horse?.id ?? f.person?.id;
    if (!target || busy) return;
    setBusy(f.id);
    setNotice("");
    try {
      await followsApi.set(f.kind, target, false);
      setFollows((old) => (old ?? []).filter((x) => x.id !== f.id));
      setNotice(`Stopped following ${f.kind === "family" ? `${nameOf(f)}'s family` : nameOf(f)}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That couldn't be changed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="fl">
      <div className="mr-intro">
        <span className="ov-kicker">HORSES, FAMILIES AND PEOPLE</span>
        <h2>Following</h2>
        <p>
          Follow any horse, its family, or a jockey, driver, trainer or owner from their racing page. You get an alert when
          they're entered, scratched, finish a race or work out. You don't need to own a horse or join a stable.
        </p>
      </div>

      {error ? (
        <div className="form-error" role="alert">
          {error}{" "}
          <button type="button" className="btn btn-quiet" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : follows === null ? (
        <p className="ov-empty" role="status">
          Loading your follows…
        </p>
      ) : follows.length === 0 ? (
        <div className="fl-empty">
          <p>
            <strong>You're not following anything yet.</strong> Open a horse or person from the racing pages and press{" "}
            <em>Follow</em>.
          </p>
          <div className="fl-empty-links">
            <Link className="btn btn-quiet" to="/entries">
              Entries
            </Link>
            <Link className="btn btn-quiet" to="/results">
              Results
            </Link>
            <Link className="btn btn-quiet" to="/statistics">
              Leaders
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="fl-filters" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className="fl-chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} <span className="fl-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="ov-empty">Nothing in this group yet.</p>
          ) : (
            <ul className="fl-list">
              {shown.map((f) => {
                const to = linkOf(f);
                return (
                  <li key={f.id} className="fl-item">
                    <div className="fl-main">
                      <h3>{to ? <Link to={to}>{nameOf(f)}</Link> : nameOf(f)}</h3>
                      <p className="fl-what">{whatOf(f)}</p>
                      {f.next && <StartLine label="Next" start={f.next} follow={f} />}
                      {f.last && <StartLine label="Last" start={f.last} follow={f} />}
                      {!f.next && !f.last && <p className="fl-start fl-quiet">No published starts yet.</p>}
                    </div>
                    <button type="button" className="btn btn-quiet fl-unfollow" disabled={busy === f.id} onClick={() => unfollow(f)}>
                      {busy === f.id ? "Saving…" : "Unfollow"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <p className="fl-notice" role="status" aria-live="polite">
        {notice}
      </p>
      <p className="fl-foot">
        Alerts arrive in the bell, and on this device when <Link to="/account/notifications">notifications</Link> are on.
        Choose which ones in <Link to="/my-racing?tab=alerts">Alert settings</Link>.
      </p>

      <details className="fl-older" onToggle={(e) => setShowOlder((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Earlier racing records you follow</summary>
        {showOlder && <VirtualStable embedded legacy />}
      </details>
    </section>
  );
}
