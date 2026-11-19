import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api";
import { useConfirm } from "../../ui/Confirm";
import { dateLabel } from "../format";
import { sourceLabels } from "../types";
import ProviderPull, { type ProviderStatus, type PullJob } from "./ProviderPull";

/**
 * Publishing tool → Data feed (backend /api/admin/racing/feed, docs/racing-data-feed.md).
 * The Racing API (connection, automatic updates, pull now), importing a racing data file (the collected Equibase files
 * stay drafts until their licence is confirmed on the server) and recent imports.
 */
interface FeedStatus {
  licensed: boolean;
  licences: Record<string, boolean>;
  provider: ProviderStatus;
  schedule: { on: boolean; everyMinutes: number };
  pull: { running: PullJob | null; recent: PullJob[] };
  today: string;
  recent: {
    id: string;
    source: string;
    track: string;
    date: string;
    dayId: string | null;
    at: string;
    by: string | null;
    summary: { races?: number; runners?: number; officialRaces?: number; history?: number; workouts?: number; published?: boolean };
  }[];
}
interface CardResult {
  ok: boolean;
  track: string;
  date: string;
  error?: string;
  skipped?: number;
  races?: number;
  runners?: number;
  officialRaces?: number;
  history?: number;
  workouts?: number;
  horsesCreated?: number;
  published?: boolean;
  dayId?: string;
}
const MAX_BYTES = 8 * 1024 * 1024;
const sourceLabel = (s: string) => sourceLabels[s] ?? s;

export default function FeedPanel() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ format: string; results: CardResult[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = new AbortController();
    setLoadError("");
    api
      .get<FeedStatus>("/api/admin/racing/feed", { signal: c.signal })
      .then((d) => !c.signal.aborted && setStatus(d))
      .catch((e) => !c.signal.aborted && setLoadError(e instanceof Error ? e.message : "The data feed status couldn't be loaded."));
    return () => c.abort();
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // While a pull runs, follow its progress.
  const running = !!status?.pull?.running;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(reload, 3000);
    return () => window.clearTimeout(timer);
  }, [running, status, reload]);

  async function runImport() {
    if (!file || busy) return;
    setError("");
    setResults(null);
    if (file.size > MAX_BYTES) return setError("That file is over 8 MB. Split it into smaller files (a few days or tracks each).");
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return setError("That file isn't valid JSON.");
    }
    if (
      publish &&
      !(await confirm({
        title: "Import and publish?",
        message: "Every card in this file goes live on Entries and Results, and followers get alerts. Only do this with data your licence lets you show.",
        confirmLabel: "Import and publish",
      }))
    )
      return;
    setBusy(true);
    try {
      const body = await api.post<{ format: string; results: CardResult[] }>("/api/admin/racing/feed/import", { data, publish });
      setResults(body);
      setFile(null);
      if (input.current) input.current.value = "";
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file couldn't be imported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rca-feed">
      <section aria-labelledby="feed-status-title" className="rca-feed-status">
        <h2 id="feed-status-title">Data feed</h2>
        {loadError && (
          <p className="form-error" role="alert">
            {loadError}{" "}
            <button type="button" className="btn btn-quiet" onClick={reload}>
              Try again
            </button>
          </p>
        )}
        {!status && !loadError && <p role="status">Loading the data feed status…</p>}
        {status && (
          <dl className="rca-feed-facts">
            <div>
              <dt>Equibase</dt>
              <dd>
                <span className="up-status status-draft">Not connected</span> Stayblz doesn't connect to Equibase itself: the racing data login
                we have is for {status.provider.name} (below). An Equibase feed needs its own contract, address and data format.
              </dd>
            </div>
            <div>
              <dt>Collected Equibase files</dt>
              <dd>
                <span className={`up-status ${status.licensed ? "status-published" : "status-draft"}`}>{status.licensed ? "Confirmed" : "Not confirmed"}</span>{" "}
                {status.licensed
                  ? "Cards from these files can be published."
                  : "Cards imported from these files stay drafts and can't be published until the owner confirms the licence on the server."}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {status?.provider && (
        <ProviderPull
          provider={status.provider}
          schedule={status.schedule}
          pull={status.pull}
          today={status.today}
          licensed={status.licences?.theracingapi ?? false}
          onStarted={reload}
        />
      )}

      <section aria-labelledby="feed-import-title" className="rca-feed-import">
        <h2 id="feed-import-title">Import a file</h2>
        <p className="rc-muted">
          A Stayblz feed file, or one of the collected Equibase files in <code>data/horse-racing/</code>. Cards are matched by track and
          date, horses by their provider number, so importing again updates instead of duplicating. Speed figures are never copied.
        </p>
        <label className="rca-file">
          <span>Racing data file (.json, up to 8 MB)</span>
          <input ref={input} type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {status?.licensed && (
          <label className="rca-check">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish after import
          </label>
        )}
        <div className="rca-feed-actions">
          <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={runImport}>
            {busy ? "Importing…" : publish ? "Import and publish" : "Import as drafts"}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {results && (
          <div className="rca-feed-results" role="status">
            <p>
              <strong>
                {results.results.filter((r) => r.ok).length} of {results.results.length} cards imported
              </strong>{" "}
              ({results.format === "collected-equibase" ? "collected Equibase file" : "Stayblz feed file"}).
            </p>
            <ul>
              {results.results.map((r, i) => (
                <li key={`${r.track}-${r.date}-${i}`} className={r.ok ? "is-ok" : "is-error"}>
                  <span aria-hidden="true">{r.ok ? "✓" : "✕"}</span>{" "}
                  <strong>
                    {r.track} · {r.date}
                  </strong>{" "}
                  {r.ok ? (
                    <>
                      {r.races} races, {r.runners} runners ({r.officialRaces} with results), {r.history} earlier starts, {r.workouts} workouts
                      {r.skipped ? `, ${r.skipped} skipped` : ""} · {r.published ? "published" : "draft"}{" "}
                      {r.dayId && <Link to={`/admin/racing/days/${r.dayId}`}>Open</Link>}
                    </>
                  ) : (
                    r.error
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="feed-recent-title">
        <h2 id="feed-recent-title">Recent imports</h2>
        {status && !status.recent.length && <p className="rc-muted">No imports yet.</p>}
        {!!status?.recent.length && (
          <div className="table-wrap">
            <table className="data rca-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Card</th>
                  <th scope="col">Source</th>
                  <th scope="col">Races</th>
                  <th scope="col">Runners</th>
                  <th scope="col">Status</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {status.recent.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.at).toLocaleString()}</td>
                    <td>{run.dayId ? <Link to={`/admin/racing/days/${run.dayId}`}>{`${run.track} · ${dateLabel(run.date, "short")}`}</Link> : `${run.track} · ${run.date}`}</td>
                    <td>{sourceLabel(run.source)}</td>
                    <td>{run.summary.races ?? "—"}</td>
                    <td>{run.summary.runners ?? "—"}</td>
                    <td>{run.summary.published ? "Published" : "Draft"}</td>
                    <td>{run.by ?? "Automatic"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
