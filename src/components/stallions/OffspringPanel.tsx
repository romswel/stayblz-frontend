import { Link } from "react-router-dom";
import { amount, dateText, furlongs, pct, surfaceLabel } from "./options";
import type { Cross, Offspring, ProgenyStats, TopHorse } from "./types";

/** Keep in step with what Stayblz racing data covers (CLAUDE.md "Current reality"). */
export const DATA_COVERAGE =
  "Counted from race days published on Stayblz (right now Great Britain, Ireland, France and Hong Kong; US and Canadian results aren't in Stayblz yet).";

function Tiles({ s, horses = "runners" }: { s: Partial<ProgenyStats>; horses?: string }) {
  const tiles = [
    { label: horses[0].toUpperCase() + horses.slice(1), value: s.runners ?? 0 },
    { label: "Winners", value: s.winners ?? 0, note: pct(s.winners ?? 0, s.runners ?? 0) },
    { label: "Stakes winners", value: s.stakesWinners ?? 0 },
    { label: "Starts", value: s.starts ?? 0 },
    { label: "Wins", value: s.wins ?? 0, note: `${pct(s.wins ?? 0, s.starts ?? 0)} of starts` },
  ];
  return (
    <dl className="st-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="st-tile">
          <dt>{t.label}</dt>
          <dd>
            {t.value.toLocaleString("en-US")}
            {t.note && <small>{t.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Surfaces({ s }: { s: Partial<ProgenyStats> }) {
  const list = (s.surfaces ?? []).filter((x) => x.starts > 0);
  if (!list.length) return null;
  const max = Math.max(...list.map((x) => x.starts));
  return (
    <div className="st-bars" role="table" aria-label="Starts and wins by surface">
      {list.map((x) => (
        <div key={x.surface} className="st-bar" role="row">
          <span role="cell" className="st-bar-label">{surfaceLabel(x.surface)}</span>
          <span role="cell" className="st-bar-track" aria-hidden="true">
            <span style={{ width: `${(x.starts / max) * 100}%` }} />
            <span className="is-wins" style={{ width: `${(x.wins / max) * 100}%` }} />
          </span>
          <span role="cell" className="st-bar-value">
            {x.wins} of {x.starts} won
          </span>
        </div>
      ))}
    </div>
  );
}

export function TopTable({ horses, caption }: { horses: TopHorse[]; caption: string }) {
  if (!horses.length) return null;
  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Horse</th>
            <th scope="col">Out of</th>
            <th scope="col" className="is-num">Starts</th>
            <th scope="col" className="is-num">1st-2nd-3rd</th>
            <th scope="col" className="is-num">Stakes wins</th>
            <th scope="col">Last ran</th>
          </tr>
        </thead>
        <tbody>
          {horses.map((h) => (
            <tr key={h.id}>
              <th scope="row">
                <Link to={`/racing/horses/${h.id}`}>{h.name}</Link>
                {h.foaled && <small> {h.foaled}</small>}
              </th>
              <td>
                {h.dam || "–"}
                {h.damSire && <small> by {h.damSire}</small>}
              </td>
              <td className="is-num">{h.starts}</td>
              <td className="is-num">
                {h.wins}-{h.places}-{h.shows}
              </td>
              <td className="is-num">{h.stakesWins || "–"}</td>
              <td>{dateText(h.lastRun) || "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Extras({ s }: { s: Partial<ProgenyStats> }) {
  const bits: string[] = [];
  if (s.earnings?.length) bits.push(`Earned ${s.earnings.map((e) => amount(e.amount, e.currency)).join(" + ")} on Stayblz cards`);
  if (s.winDistance) bits.push(`Wins from ${furlongs(s.winDistance.shortest)} to ${furlongs(s.winDistance.longest)} (average ${furlongs(s.winDistance.average)})`);
  if (s.from && s.to) bits.push(`Starts from ${dateText(s.from)} to ${dateText(s.to)}`);
  if (!bits.length) return null;
  return (
    <ul className="st-extras">
      {bits.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}

/** His offspring on public Stayblz racing pages. */
export default function OffspringPanel({ offspring, name }: { offspring: Offspring | null; name: string }) {
  if (!offspring || !offspring.named || !offspring.runners) {
    return (
      <div className="st-nodata">
        <p>
          <strong>No runners by {name} on Stayblz racing pages yet.</strong> When his foals run at tracks Stayblz publishes, their
          starts, wins and best horses show here automatically.
        </p>
        <p className="st-muted">{DATA_COVERAGE}</p>
      </div>
    );
  }
  return (
    <div className="st-offspring">
      <Tiles s={offspring} />
      <Surfaces s={offspring} />
      <Extras s={offspring} />
      <TopTable horses={offspring.top ?? []} caption="His best runners here" />
      {!!offspring.crosses?.length && (
        <div className="st-table-wrap">
          <table className="st-table">
            <caption>By the sire of their dam (how he crosses)</caption>
            <thead>
              <tr>
                <th scope="col">Mares by</th>
                <th scope="col" className="is-num">Runners</th>
                <th scope="col" className="is-num">Winners</th>
                <th scope="col" className="is-num">Wins / starts</th>
              </tr>
            </thead>
            <tbody>
              {offspring.crosses.map((c) => (
                <tr key={c.damSire}>
                  <th scope="row">{c.damSire}</th>
                  <td className="is-num">{c.runners}</td>
                  <td className="is-num">{c.winners}</td>
                  <td className="is-num">
                    {c.wins} / {c.starts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="st-muted">{DATA_COVERAGE} Small numbers say little on their own.</p>
    </div>
  );
}

/** One cross (e.g. this stallion out of mares by her sire) in the mating check. */
export function CrossSummary({ title, cross, empty }: { title: string; cross: Cross | null; empty: string }) {
  return (
    <section className="st-cross">
      <h4>{title}</h4>
      {!cross || !cross.runners ? (
        <p className="st-muted">{empty}</p>
      ) : (
        <>
          <Tiles s={cross} />
          <TopTable horses={cross.top ?? []} caption="Best of them" />
        </>
      )}
    </section>
  );
}

/** The stallion's own racing record in Stayblz data (when the owner linked it). */
export function OwnRecord({ racing }: { racing: NonNullable<import("./types").StallionProfile["racing"]> }) {
  return (
    <div className="st-own-record">
      <p>
        <span className="st-tag is-data">Stayblz racing data</span>{" "}
        <Link to={`/racing/horses/${racing.id}`}>{racing.name}</Link>: {racing.starts} starts, {racing.wins} wins, {racing.places} seconds,{" "}
        {racing.shows} thirds
        {racing.stakesWinners ? ", a stakes winner" : ""}
        {racing.earnings?.length ? `, earned ${racing.earnings.map((e) => amount(e.amount, e.currency)).join(" + ")} on Stayblz cards` : ""}.
      </p>
    </div>
  );
}
