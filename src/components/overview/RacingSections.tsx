import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal";
import type { RacingRecord, SectionKey } from "../landing/useRacingOverview";

export const sectionNames: Record<SectionKey, string> = {
  racecards: "Racecards",
  results: "Results",
  workouts: "Workouts",
  horses: "Horses",
  jockeys: "Jockeys",
  trainers: "Trainers",
  stakes: "Stakes",
  notes: "Racing notes",
};
export function OverviewSection({
  id,
  number,
  title,
  subtitle,
  link,
  children,
}: {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  link?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ov-section">
      <div className="ov-section-heading">
        <div>
          <span>
            {number} / {subtitle}
          </span>
          <h2>{title}</h2>
        </div>
        {link && <Link to={link}>View all ↗</Link>}
      </div>
      <div className="ov-paper">{children}</div>
    </section>
  );
}
export function RecordTable({
  records,
  kind,
  empty,
  onOpen,
}: {
  records: RacingRecord[];
  kind: SectionKey;
  empty: string;
  onOpen: (r: RacingRecord, k: SectionKey) => void;
}) {
  const leader = ["horses", "jockeys", "trainers"].includes(kind);
  return (
    <div
      className="ov-table-scroll"
      role="region"
      aria-label={`${sectionNames[kind]} overview`}
      tabIndex={0}
    >
      {records.length ? (
        <table className="ov-table">
          <thead>
            <tr>
              <th>{leader ? "Rank" : "Race / date"}</th>
              <th>{leader ? "Name" : "Race / horse"}</th>
              <th>{leader ? "Starts" : "Track"}</th>
              <th>
                {leader ? "Wins" : kind === "results" ? "Margin" : "Distance"}
              </th>
              <th>
                {leader ? (kind === "horses" ? "Figure" : "Win %") : "Details"}
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.id}>
                <td>
                  {leader
                    ? String(i + 1).padStart(2, "0")
                    : (r.race ?? r.date ?? "—")}
                </td>
                <th scope="row">
                  <button
                    className="ov-record-name"
                    onClick={() => onOpen(r, kind)}
                  >
                    {r.name}
                    <span>{r.detail ?? (leader ? "" : r.surface)}</span>
                  </button>
                </th>
                <td>{leader ? (r.starts ?? "—") : (r.track ?? "—")}</td>
                <td>
                  {leader
                    ? (r.wins ?? "—")
                    : kind === "results"
                      ? (r.margin ?? "—")
                      : (r.distance ?? "—")}
                </td>
                <td>
                  {leader ? (
                    kind === "horses" ? (
                      (r.figure ?? "—")
                    ) : r.starts && r.wins !== undefined ? (
                      `${Math.round((r.wins / r.starts) * 100)}%`
                    ) : (
                      "—"
                    )
                  ) : (
                    <button
                      className="ov-text-button"
                      onClick={() => onOpen(r, kind)}
                    >
                      {r.time ?? "View"} ↗
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ov-empty" role="status">
          {empty}
        </p>
      )}
    </div>
  );
}
export function RecordDialog({
  record,
  kind,
  onClose,
}: {
  record: RacingRecord;
  kind: SectionKey;
  onClose: () => void;
}) {
  return (
    <Modal label={record.name} onClose={onClose}>
      <div className="ws-dialog">
        <button className="ws-button" onClick={onClose}>
          Close
        </button>
        <span className="ov-kicker">
          {sectionNames[kind]} · Published record
        </span>
        <h2>{record.name}</h2>
        <dl className="ov-record-details">
          {Object.entries(record)
            .filter(
              ([k, v]) =>
                !["id", "name", "summary", "body"].includes(k) &&
                v !== undefined,
            )
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        {record.summary && <p>{record.summary}</p>}
        {record.body && <p className="ov-note-body">{record.body}</p>}
        <Link to={`/racing-records/${kind}`}>
          All {sectionNames[kind].toLowerCase()} ↗
        </Link>
      </div>
    </Modal>
  );
}
