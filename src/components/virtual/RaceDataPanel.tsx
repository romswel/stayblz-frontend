import { useState } from "react";
import { dateLabel, ordinal } from "../racing/format";
import { Career, codeLabel, whereOf } from "../stayblz-data/FormFavLists";
import { RunnerStatsView } from "../stayblz-data/formfavDialogs";
import { Table, clock } from "../stayblz-data/formfavUi";
import type { RaceWhere } from "../stayblz-data/formfavApi";
import type { VirtualDetail } from "./api";
import "../stayblz-data/stayblz-data.css";

type RaceData = NonNullable<VirtualDetail["raceData"]>;
const shortDay = (iso: string) => dateLabel(iso, "short").replace(/,? \d{4}$/, "");

/**
 * A linked horse's race data (US and Canada race cards, about the last 30 days and the next 1–2): how many people
 * follow it on Stayblz, the viewer's own alerts switch, its numbers, next entry, every run in the window (a race opens
 * its card, prediction and result), and FormFav career stats on request.
 */
export default function RaceDataPanel({
  data,
  runs = true,
  onRace,
  onAlerts,
  alertsBusy,
}: {
  data: RaceData;
  /** Also list every start and entry in the window. */
  runs?: boolean;
  onRace: (where: RaceWhere) => void;
  onAlerts: (on: boolean) => void;
  alertsBusy: boolean;
}) {
  const [career, setCareer] = useState(false);
  const h = data.horse;
  const next = h?.nextEntry ?? null;
  const nextStart = next && h?.history.find((s) => s.date === next.date && s.slug === next.slug && s.raceNumber === next.raceNumber);
  const nextWhere = nextStart ? whereOf(nextStart) : null;
  return (
    <section className="vs-live vs-racedata" aria-label="Race data">
      <div className="vs-block-head">
        <h3>
          Race data <small>{codeLabel(data.code)} · US and Canada race cards</small>
        </h3>
        <span className="vs-followers">{data.followers} following on Stayblz</span>
      </div>
      <label className="vs-check vs-alerts">
        <input type="checkbox" checked={data.alertsOn} disabled={alertsBusy} onChange={(e) => onAlerts(e.target.checked)} />
        <span>Alert me when {data.name} is entered, scratched, changes jockey or trainer, or has run</span>
      </label>
      {!data.available ? (
        <p className="vs-muted">Race data isn't available right now. The details and log saved so far are still here.</p>
      ) : !h ? (
        <p className="vs-muted">
          {data.building
            ? "Still gathering the last 30 days of racing. Check back in a minute."
            : `No runs or entries for ${data.name} in the last 30 days. It updates again as soon as it's entered.`}
        </p>
      ) : (
        <>
          <dl className="vs-stats">
            <div>
              <dt>Starts (30 days)</dt>
              <dd>{h.starts}</dd>
            </div>
            <div>
              <dt>Wins · top 3</dt>
              <dd>
                {h.wins} · {h.places}
              </dd>
            </div>
            <div>
              <dt>Last start</dt>
              <dd>{h.lastStart ? `${h.lastStart.position ? ordinal(h.lastStart.position) : "Ran"} · ${h.lastStart.track ?? h.lastStart.slug} · ${shortDay(h.lastStart.date)}` : "—"}</dd>
            </div>
            <div>
              <dt>Next entry</dt>
              <dd>
                {next ? (
                  nextWhere ? (
                    <button type="button" className="vs-link" onClick={() => onRace(nextWhere)}>
                      {next.track ?? next.slug} R{next.raceNumber} · {shortDay(next.date)}
                      {clock(next.startTime) ? ` · ${clock(next.startTime)}` : ""}
                    </button>
                  ) : (
                    `${next.track ?? next.slug} · ${shortDay(next.date)}`
                  )
                ) : (
                  "Not entered"
                )}
              </dd>
            </div>
            <div>
              <dt>{data.code === "harness" ? "Driver" : "Jockey"}</dt>
              <dd>{h.jockey ?? "—"}</dd>
            </div>
            <div>
              <dt>Trainer</dt>
              <dd>{h.trainer ?? "—"}</dd>
            </div>
          </dl>
          {runs && (
            <Table
              head={["Date", "Track", "Race", "Fin", data.code === "harness" ? "Driver" : "Jockey", "Trainer"]}
              rows={h.history.map((s, i) => {
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
                    s.scratched
                      ? "SCR"
                      : s.status === "final"
                        ? s.position
                          ? `${ordinal(s.position)}${s.fieldSize ? `/${s.fieldSize}` : ""}`
                          : "—"
                        : s.status === "abandoned"
                          ? "Off"
                          : "Entered",
                    s.jockey ?? "—",
                    s.trainer ?? "—",
                  ],
                };
              })}
            />
          )}
        </>
      )}
      {data.available &&
        (career ? (
          <div className="sd-ff-career">{data.runnerId ? <RunnerStatsView id={data.runnerId} /> : <Career name={data.name} code={data.code} />}</div>
        ) : (
          <button type="button" className="vs-btn" onClick={() => setCareer(true)}>
            Show career stats
          </button>
        ))}
      <p className="vs-muted vs-credit">
        Updates about every 30 minutes{data.syncedAt ? ` · last synced ${new Date(data.syncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""} · Data: FormFav
      </p>
    </section>
  );
}
