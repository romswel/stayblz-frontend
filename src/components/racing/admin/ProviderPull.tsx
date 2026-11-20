import { useState } from "react";
import { api } from "../../../api";
import { useConfirm } from "../../ui/Confirm";
import { dateLabel, shiftDate } from "../format";

/**
 * Publishing tool → Data feed → The Racing API (backend POST /api/admin/racing/feed/pull, docs/racing-data-feed.md):
 * connection status, the automatic schedule, a "pull now" form (a day, or a range going back from it, plus horses'
 * earlier starts) and the progress of the running pull. Pulled cards are published: the provider's terms allow it.
 */
export interface PullDay {
  date: string;
  cards: number;
  imported: number;
  failed: number;
  races: number;
  runners: number;
  officialRaces: number;
  published: boolean;
  error?: string;
}
export interface PullJob {
  id: string;
  kind: "days" | "histories" | "automatic";
  by: "admin" | "automatic";
  dates: string[];
  startedAt: string;
  finishedAt: string | null;
  done: number;
  total: number;
  days: PullDay[];
  histories: { horses: number; starts: number } | null;
  error: string | null;
}
export interface ProviderStatus {
  name: string;
  configured: boolean;
  connected: boolean;
  northAmerica: boolean;
  error: string | null;
  checkedAt: string | null;
}

function JobLine({ job }: { job: PullJob }) {
  const when = new Date(job.startedAt).toLocaleString();
  return (
    <li className={job.error ? "is-error" : job.finishedAt ? "is-ok" : ""}>
      <strong>
        {job.by === "automatic" ? "Automatic" : "Pulled by an admin"} · {when}
      </strong>
      {!job.finishedAt && (
        <>
          {" "}
          — working ({job.done} of {job.total})…
        </>
      )}
      {job.error && <> — {job.error}</>}
      <ul>
        {job.days.map((d) => (
          <li key={d.date}>
            {dateLabel(d.date, "short")}:{" "}
            {d.error
              ? d.error
              : d.cards
                ? `${d.imported} of ${d.cards} tracks, ${d.races} races, ${d.runners} runners, ${d.officialRaces} results${d.failed ? `, ${d.failed} failed` : ""} · ${d.published ? "published" : "drafts"}`
                : "no racing in the plan's regions"}
          </li>
        ))}
        {job.histories && (
          <li>
            Earlier starts: {job.histories.starts} for {job.histories.horses} horses
          </li>
        )}
      </ul>
    </li>
  );
}

export default function ProviderPull({
  provider,
  schedule,
  pull,
  today,
  licensed,
  onStarted,
}: {
  provider: ProviderStatus;
  schedule: { on: boolean; everyMinutes: number };
  pull: { running: PullJob | null; recent: PullJob[] };
  today: string;
  licensed: boolean;
  onStarted: () => void;
}) {
  const confirm = useConfirm();
  const [date, setDate] = useState(today);
  const [days, setDays] = useState(1);
  const [histories, setHistories] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;
    setError("");
    const first = shiftDate(date, -(days - 1));
    const range = days > 1 ? `${dateLabel(first, "short")} to ${dateLabel(date, "short")}` : dateLabel(date, "short");
    if (
      !(await confirm({
        title: licensed ? "Pull and publish?" : "Pull as drafts?",
        message: licensed
          ? `Race cards and results for ${range} go live on Entries and Results, and followers get alerts for new entries and results.`
          : `Race cards and results for ${range} are saved as drafts.`,
        confirmLabel: licensed ? "Pull and publish" : "Pull as drafts",
      }))
    )
      return;
    setBusy(true);
    try {
      await api.post("/api/admin/racing/feed/pull", { date, days, histories });
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The pull couldn't start.");
    } finally {
      setBusy(false);
    }
  }

  const state = !provider.configured ? "Not set up" : provider.connected ? "Connected" : "Not connected";
  return (
    <section aria-labelledby="feed-provider-title" className="rca-feed-provider">
      <h2 id="feed-provider-title">{provider.name}</h2>
      <dl className="rca-feed-facts">
        <div>
          <dt>Connection</dt>
          <dd>
            <span className={`up-status ${provider.connected ? "status-published" : "status-draft"}`}>{state}</span>{" "}
            {!provider.configured
              ? "Add RACING_API_USERNAME and RACING_API_PASSWORD to the server's settings."
              : provider.connected
                ? "Racecards, results, pedigree and earlier starts for Great Britain, Ireland, France, Hong Kong and the other regions on the plan."
                : provider.error ?? "The login couldn't be checked."}
          </dd>
        </div>
        {provider.connected && (
          <div>
            <dt>North America</dt>
            <dd>
              {provider.northAmerica
                ? "Included: US and Canadian racing comes in too."
                : "Not on this plan. US and Canadian racing needs the provider's North America add-on."}
            </dd>
          </div>
        )}
        <div>
          <dt>Automatic updates</dt>
          <dd>
            {schedule.on
              ? `On: every ${schedule.everyMinutes} minutes while the server is awake (today's cards and results, tomorrow's cards, earlier starts).`
              : "Off on this server."}
          </dd>
        </div>
      </dl>

      {provider.configured && (
        <div className="rca-pull">
          <div className="rca-pull-fields">
            <label>
              <span>Last day</span>
              <input type="date" value={date} max={shiftDate(today, 7)} min={shiftDate(today, -366)} onChange={(e) => setDate(e.target.value || today)} />
            </label>
            <label>
              <span>Days back</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 2, 3, 7, 14, 31].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Just that day" : `${n} days`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Earlier starts for</span>
              <select value={histories} onChange={(e) => setHistories(Number(e.target.value))}>
                {[0, 50, 100, 300].map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n} horses` : "No horses"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rca-feed-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !!pull.running} onClick={start}>
              {pull.running ? "Pulling…" : busy ? "Starting…" : "Pull now"}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {(pull.running || pull.recent.length > 0) && (
        <div className="rca-feed-results" role="status" aria-live="polite">
          <ul className="rca-jobs">
            {pull.running && <JobLine job={pull.running} />}
            {pull.recent.slice(0, 4).map((job) => (
              <JobLine key={job.id} job={job} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
