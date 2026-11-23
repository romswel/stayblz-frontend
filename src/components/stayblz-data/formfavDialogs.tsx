import { useState } from "react";
import { dateLabel } from "../racing/format";
import { DetailShell, DetailState, useDetail } from "./detail";
import { formFav, type PersonRow, type RaceCode, type RaceWhere } from "./formfavApi";
import { Bar, Facts, Table, clock, label, n, pct, rateCols, text, type StatsTarget } from "./formfavUi";

/** Stayblz Data → FormFav dialogs: one race (form, predictions, result) and jockey / trainer / runner / track stats. */

// ── Race ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

type RaceView = "form" | "predictions" | "result";

export function RaceDialog({ where, onClose, onStats }: { where: RaceWhere; onClose: () => void; onStats: (t: StatsTarget) => void }) {
  const { data, error, retry } = useDetail(() => formFav.race(where));
  const [view, setView] = useState<RaceView>("form");
  const form = data?.form;
  const person = (kind: "jockey" | "trainer", name: string | null) =>
    name ? (
      <button type="button" className="cm-link" onClick={() => onStats({ kind, name, code: where.code })}>
        {name}
      </button>
    ) : (
      "—"
    );
  return (
    <DetailShell label={form ? `${form.track} race ${form.raceNumber}` : "Race"} onClose={onClose}>
      {!data || !form ? (
        <DetailState error={error} retry={retry} />
      ) : (
        <>
          <header className="sd-detail-head">
            <span className="sd-track">
              {form.track} · Race {form.raceNumber} · {dateLabel(where.date, "short")}
              {clock(form.startTime) && ` · ${clock(form.startTime)}`}
            </span>
            <h2>{form.raceName ?? `Race ${form.raceNumber}`}</h2>
            <p className="sd-facts">
              {[
                form.distance,
                form.raceClass,
                form.condition,
                form.weather,
                form.prizeMoney && /^\d+$/.test(form.prizeMoney)
                  ? `${Number(form.prizeMoney).toLocaleString()} prize money`
                  : form.prizeMoney,
                form.numberOfRunners !== null ? `${form.numberOfRunners} runners` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {form.abandoned && <span className="sd-pill is-off">Abandoned</span>}
            <p className="sd-ff-actions">
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() =>
                  onStats({ kind: "track", slug: where.track, name: form.track ?? where.track, code: where.code, country: where.country })
                }
              >
                Track bias
              </button>
            </p>
          </header>

          <nav className="cm-seg" aria-label="Race views">
            <button type="button" aria-pressed={view === "form"} onClick={() => setView("form")}>
              Form
            </button>
            <button type="button" aria-pressed={view === "predictions"} onClick={() => setView("predictions")}>
              Predictions
            </button>
            <button type="button" aria-pressed={view === "result"} onClick={() => setView("result")}>
              Result
            </button>
          </nav>

          {view === "form" && (
            <Table
              head={["#", "Runner", "Bar", "Jockey", "Trainer", "Wt", "Form", "Win", "Place"]}
              rows={form.runners.map((r) => ({
                key: `${r.number}-${r.name}`,
                scratched: r.scratched,
                cells: [
                  r.number ?? "—",
                  <>
                    <strong>{r.name ?? "—"}</strong>
                    {(r.age || r.sex) && <small> {[r.age ? `${r.age}yo` : null, r.sex].filter(Boolean).join(" ")}</small>}
                    {r.badges.length > 0 && (
                      <span className="sd-ff-badges">
                        {r.badges.map((b, i) => (
                          <span key={i} className={`sd-ff-badge${b.sentiment === "-" ? " is-neg" : ""}`} title={b.detail ?? undefined}>
                            {b.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </>,
                  r.barrier ?? "—",
                  person("jockey", r.jockey),
                  person("trainer", r.trainer),
                  r.weight ?? "—",
                  <code>{r.form ?? "—"}</code>,
                  pct(r.stats?.overall?.winPercent),
                  pct(r.stats?.overall?.placePercent),
                ],
              }))}
              empty="No runners listed yet."
            />
          )}

          {view === "predictions" &&
            (data.predictions && data.predictions.runners.length ? (
              <>
                <p className="sd-muted">
                  FormFav model
                  {data.predictions.confidence && ` · ${label(data.predictions.confidence)} confidence`}
                  {data.predictions.predictedAt && ` · predicted ${new Date(data.predictions.predictedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                </p>
                <Table
                  head={["Rank", "#", "Runner", "Win", "Place"]}
                  rows={[...data.predictions.runners]
                    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                    .map((p) => ({
                      key: `${p.number}-${p.name}`,
                      cells: [
                        p.rank ?? "—",
                        p.number ?? "—",
                        <strong>{p.name ?? "—"}</strong>,
                        <Bar value={p.winProb} />,
                        <Bar value={p.placeProb} />,
                      ],
                    }))}
                />
              </>
            ) : (
              <p className="sd-muted">No predictions for this race. FormFav predicts races with enough data, close to race day.</p>
            ))}

          {view === "result" &&
            (data.results && data.results.placings.length ? (
              <>
                <p className="sd-muted">
                  {label(data.results.status)} result{data.results.revised && " (revised)"}
                </p>
                <Table
                  head={["Fin", "#", "Runner", "Margin", "SP", "Jockey"]}
                  rows={[...data.results.placings]
                    .sort((a, b) => (a.scratched ? 1 : 0) - (b.scratched ? 1 : 0) || (a.position ?? 99) - (b.position ?? 99))
                    .map((p) => ({
                      key: `${p.number}-${p.name}`,
                      scratched: p.scratched,
                      cells: [
                        p.scratched ? "SCR" : (p.position ?? "—"),
                        p.number ?? "—",
                        <strong>{p.name ?? "—"}</strong>,
                        p.margin ?? "—",
                        p.startingPrice !== null ? `$${p.startingPrice.toFixed(2)}` : "—",
                        person("jockey", p.jockey),
                      ],
                    }))}
                />
              </>
            ) : (
              <p className="sd-muted">No result yet.</p>
            ))}
        </>
      )}
    </DetailShell>
  );
}


// ── Stats dialog ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function StatsDialog({ target, onClose }: { target: StatsTarget; onClose: () => void }) {
  const key = target.kind === "runner" ? `r${target.id}` : target.kind === "track" ? `t${target.slug}` : `${target.kind}${target.name}`;
  return (
    <DetailShell label={target.name} onClose={onClose}>
      {target.kind === "runner" ? (
        <RunnerStatsView key={key} id={target.id} />
      ) : target.kind === "track" ? (
        <TrackBiasView key={key} target={target} />
      ) : (
        <PersonStatsView key={key} target={target} />
      )}
    </DetailShell>
  );
}


/** A jockey or trainer: our US/Canada 30-day summary (from the A–Z list) and FormFav's career stats by name. */
export function PersonStatsView({
  target,
}: {
  target: { kind: "jockey" | "trainer"; name: string; code?: RaceCode; summary?: PersonRow };
}) {
  const { data, error, retry } = useDetail(() =>
    formFav.person(target.kind, target.name, target.code === "greyhounds" ? undefined : target.code),
  );
  const s = target.summary;
  return (
    <>
      <header className="sd-detail-head">
        <span className="sd-track">{target.kind}</span>
        <h2>{data?.name ?? target.name}</h2>
        {data && (
          <p className="sd-facts">
            Career: {n(data.totalStarts)} starts · {n(data.totalWins)} wins · {pct(data.winRate)} win · {pct(data.placeRate)} place
          </p>
        )}
        {data && (data.bestCondition || data.worstCondition) && (
          <p className="sd-facts">
            Best on {text(data.bestCondition)} · weakest on {text(data.worstCondition)}
          </p>
        )}
        {data?.ambiguous && <span className="sd-pill">Shared name: these stats may mix people</span>}
      </header>
      {s && (
        <>
          <h3>US &amp; Canada, last 30 days</h3>
          <Facts
            items={[
              [target.kind === "jockey" ? "Rides" : "Runners", n(s.rides)],
              ["Wins", n(s.wins)],
              ["Win rate", pct(s.winRate)],
              ["Top 3", n(s.places)],
              ["Tracks", n(s.tracks)],
              ["Entered next", n(s.upcoming)],
            ]}
          />
        </>
      )}
      {!data ? (
        s && error ? (
          <p className="sd-muted">{error === "Not found." ? "FormFav has no career record under this name." : error}</p>
        ) : (
          <DetailState error={error} retry={retry} />
        )
      ) : (
        <>
          <h3>Career by track</h3>
          <Table
            head={["Track", "Starts", "Wins", "Win", "Place"]}
            rows={(data.tracks ?? []).map((r, i) => ({ key: `${r.venue}-${i}`, cells: [text(r.venue), ...rateCols(r)] }))}
            empty="Not enough data."
          />
          {data.conditions && data.conditions.length > 0 && (
            <>
              <h3>Track conditions</h3>
              <Table
                head={["Condition", "Starts", "Wins", "Win", "Place"]}
                rows={data.conditions.map((r, i) => ({ key: `${r.condition}-${i}`, cells: [text(r.condition), ...rateCols(r)] }))}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

export function RunnerStatsView({ id }: { id: number }) {
  const { data, error, retry } = useDetail(() => formFav.runner(id));
  if (!data) return <DetailState error={error} retry={retry} />;
  const r = data.runner ?? {};
  const c = data.career ?? {};
  return (
    <>
      <header className="sd-detail-head">
        <span className="sd-track">Runner{typeof r.country === "string" ? ` · ${r.country}` : ""}</span>
        <h2>{text(r.name)}</h2>
        <p className="sd-facts">
          {[
            typeof r.age === "number" ? `${r.age}yo` : null,
            typeof r.sex === "string" ? label(r.sex) : null,
            typeof r.sire === "string" ? `${r.sire} × ${text(r.dam)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="sd-facts">
          {n(c.totalStarts)} starts · {n(c.wins)}-{n(c.seconds)}-{n(c.thirds)} · {pct(c.winRate as number | null)} win ·{" "}
          {pct(c.placeRate as number | null)} place
          {typeof r.lastRaceDate === "string" && ` · last start ${dateLabel(r.lastRaceDate, "short")}`}
        </p>
      </header>
      <Facts
        items={[
          ["Form trend", data.formTrend ? label(data.formTrend.trendDirection as string) : null],
          ["Last 5 win rate", data.formTrend ? pct(data.formTrend.last5WinRate as number | null) : null],
          ["Class rating", data.classProfile ? `${n(data.classProfile.currentRating)} (peak ${n(data.classProfile.peakRating)})` : null],
          ["Class trend", data.classProfile ? label(data.classProfile.trend as string) : null],
          ["Running style", data.runningStyle ? label(data.runningStyle.finishingStyle as string) : null],
          ["Gate speed", data.runningStyle ? label(data.runningStyle.gateSpeed as string) : null],
          ["Trials", data.trialForm ? `${n(data.trialForm.totalTrials)} (${n(data.trialForm.trialWins)} won)` : null],
        ]}
      />
      <h3>Distances</h3>
      <Table
        head={["Distance", "Starts", "Wins", "Win", "Place"]}
        rows={(data.distances ?? []).map((d, i) => ({
          key: `${d.distanceMeters}-${i}`,
          cells: [typeof d.distanceMeters === "number" ? `${d.distanceMeters}m` : "—", ...rateCols(d)],
        }))}
        empty="Not enough data."
      />
      {data.venues && data.venues.length > 0 && (
        <>
          <h3>Tracks</h3>
          <Table
            head={["Track", "Starts", "Wins", "Win", "Place"]}
            rows={data.venues.map((v, i) => ({ key: `${v.venue}-${i}`, cells: [text(v.venue), ...rateCols(v)] }))}
          />
        </>
      )}
      {data.conditions && data.conditions.length > 0 && (
        <>
          <h3>Track conditions</h3>
          <Table
            head={["Condition", "Starts", "Wins", "Win", "Place"]}
            rows={data.conditions.map((v, i) => ({ key: `${v.condition}-${i}`, cells: [label(v.condition as string), ...rateCols(v)] }))}
          />
        </>
      )}
      {data.jockeys && data.jockeys.length > 0 && (
        <>
          <h3>Jockeys</h3>
          <Table
            head={["Jockey", "Starts", "Wins", "Win", "Place"]}
            rows={data.jockeys.map((v, i) => ({ key: `${v.jockeyName}-${i}`, cells: [text(v.jockeyName), ...rateCols(v)] }))}
          />
        </>
      )}
      {data.sire && (
        <>
          <h3>Sire</h3>
          <Facts
            items={[
              ["Sire", text(data.sire.sireName)],
              ["Progeny", n(data.sire.totalProgeny)],
              ["Progeny win rate", pct(data.sire.winRate as number | null)],
              ["Best distance", text(data.sire.bestDistanceCategory)],
              ["Debut win rate", pct(data.sire.debutWinRate as number | null)],
            ]}
          />
        </>
      )}
    </>
  );
}

export function TrackBiasView({ target }: { target: { slug: string; name: string; code: RaceCode; country: string } }) {
  const { data, error, retry } = useDetail(() => formFav.trackBias(target.slug, target.code, target.country));
  if (!data) return <DetailState error={error} retry={retry} />;
  const pp = (v: unknown) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)} pts` : "—");
  return (
    <>
      <header className="sd-detail-head">
        <span className="sd-track">Track bias</span>
        <h2>{data.venue ?? target.name}</h2>
        <p className="sd-facts">
          {n(data.totalRaces)} races · expected win rate {pct(data.expectedWinRate)} · bias {label(data.biasStrength)}
        </p>
        <p className="sd-facts">
          Strongest barrier {data.strongestBarrier ?? "—"} · weakest {data.weakestBarrier ?? "—"}
        </p>
      </header>
      <h3>Barriers</h3>
      <Table
        head={["Barrier", "Starts", "Wins", "Win", "Place", "Edge"]}
        rows={(data.barriers ?? []).map((b, i) => ({
          key: `${b.barrierNumber}-${i}`,
          cells: [n(b.barrierNumber), ...rateCols(b), pp(b.advantage)],
        }))}
        empty="Not enough data."
      />
      {data.distances.length > 0 && (
        <>
          <h3>By distance</h3>
          <Table
            head={["Distance", "Races", "Strongest", "Weakest", "Bias"]}
            rows={data.distances.map((d, i) => ({
              key: `${d.category}-${i}`,
              cells: [
                `${text(d.category)}${d.minDistance !== null ? ` (${d.minDistance}–${d.maxDistance ?? ""}m)` : ""}`,
                n(d.totalRaces),
                d.strongestBarrier ?? "—",
                d.weakestBarrier ?? "—",
                label(d.biasStrength),
              ],
            }))}
          />
        </>
      )}
    </>
  );
}

