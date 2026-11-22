import { CrossSummary, DATA_COVERAGE } from "./OffspringPanel";
import PedigreeChart, { marksFor } from "./PedigreeChart";
import { geneticResult, nameKey } from "./options";
import type { GeneticCheck, MatingReport } from "./types";

const LEVEL_TEXT: Record<GeneticCheck["level"], string> = {
  danger: "Talk to your vet",
  test: "Test first",
  warn: "Worth knowing",
  clear: "Clear",
};
const copiesText = (key: string, c: 0 | 1 | 2 | null) => (c === null ? "not tested" : geneticResult(key, c));

/** What the mating check found, in plain words. Numbers are worked out from the names and results given. */
export default function MatingReportView({ report }: { report: MatingReport }) {
  const both = report.shared.filter((a) => a.bothSides && !a.through);
  const oneSide = report.shared.filter((a) => !a.bothSides && !a.through);
  const through = report.shared.filter((a) => a.through);
  const marks = marksFor(both.map((a) => a.name));
  const pct = report.inbreeding.percent;
  const filled = Math.round((report.inbreeding.named / report.inbreeding.possible) * 100);
  return (
    <div className="st-report">
      <section className="st-report-top">
        <div className="st-meter-card gx-glass">
          <span className="st-label">Inbreeding (Wright's coefficient)</span>
          <strong className="st-big">{pct.toFixed(pct > 0 && pct < 1 ? 2 : 1)}%</strong>
          <span className="st-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (pct / 25) * 100)}%` }} />
          </span>
          <p className="st-muted">
            {both.length === 0
              ? "No horse appears on both sides in the names given."
              : `${both.length} ${both.length === 1 ? "horse appears" : "horses appear"} on both sides.`}{" "}
            For scale: 3.1% is one shared horse in the third generation (3×3); 12.5% is a half-brother and half-sister.
          </p>
        </div>
        <div className="st-meter-card gx-glass">
          <span className="st-label">How much of the pedigree we have</span>
          <strong className="st-big">
            {report.inbreeding.named}
            <small> of {report.inbreeding.possible} names</small>
          </strong>
          <span className="st-meter is-plain" aria-hidden="true">
            <span style={{ width: `${filled}%` }} />
          </span>
          <p className="st-muted">Missing names count as unrelated, so the real figure can only be the same or higher. Add more of her pedigree for a fuller check.</p>
        </div>
      </section>

      <section className="st-block">
        <h3>Shared ancestors</h3>
        {both.length === 0 ? (
          <p className="st-muted">None found on both sides in the names given.</p>
        ) : (
          <ul className="st-shared">
            {both.map((a) => (
              <li key={a.name}>
                <span className={`st-dot is-mark-${marks.get(nameKey(a.name)) ?? 0}`} aria-hidden="true" />
                <strong>{a.name}</strong> <span className="st-notation" title="Generations back on the sire's side × on the dam's side">{a.notation}</span>
              </li>
            ))}
          </ul>
        )}
        {oneSide.length > 0 && (
          <p className="st-muted">
            Repeated within one parent's own pedigree: {oneSide.map((a) => `${a.name} (${a.notation})`).join(", ")}.
          </p>
        )}
        {through.length > 0 && <p className="st-muted">Also repeated through the horses above: {through.map((a) => a.name).join(", ")}.</p>}
      </section>

      {report.genetics.length > 0 && (
        <section className="st-block">
          <h3>Genetic tests</h3>
          <ul className="st-genetic-list">
            {report.genetics.map((g) => (
              <li key={g.key} className={`is-${g.level}`}>
                <span className={`st-tag is-${g.level === "danger" ? "danger" : g.level === "clear" ? "ok" : "warn"}`}>{LEVEL_TEXT[g.level]}</span>
                <div>
                  <strong>
                    {g.label} <small>{g.name}</small>
                  </strong>
                  <p>
                    Stallion {copiesText(g.key, g.stallion)} · mare {copiesText(g.key, g.mare)}. {g.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="st-muted">Simple one-gene inheritance from the results entered. Confirm with the lab reports and your vet.</p>
        </section>
      )}

      <section className="st-block">
        <h3>The foal's pedigree</h3>
        <PedigreeChart pedigree={report.foal} depth={4} subject="The foal" highlight={marks} label="The foal's pedigree" />
      </section>

      <section className="st-block">
        <h3>How this cross has run</h3>
        {!report.crosses.mareSire ? (
          <p className="st-muted">Add her sire to see this.</p>
        ) : (
          <div className="st-cross-grid">
            <CrossSummary
              title={`${report.stallion.name} out of mares by ${report.crosses.mareSire}`}
              cross={report.crosses.exact}
              empty="No runners from this exact cross on Stayblz racing pages yet."
            />
            {report.crosses.sireLineName && (
              <CrossSummary
                title={`${report.crosses.sireLineName} (his sire) out of mares by ${report.crosses.mareSire}`}
                cross={report.crosses.sireLine}
                empty="No runners from his sire's line on this cross here yet."
              />
            )}
            <CrossSummary
              title={`Any sire, out of mares by ${report.crosses.mareSire}`}
              cross={report.crosses.asDamSire}
              empty={`No runners out of ${report.crosses.mareSire} mares here yet.`}
            />
          </div>
        )}
        <p className="st-muted">{DATA_COVERAGE}</p>
      </section>

      {report.notes.length > 0 && (
        <ul className="st-notes">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
