import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { TopLayer } from "../community/HorseShare";
import { dateLabel, ordinal } from "../racing/format";
import { formFav, type HorseRow, type IndexCode } from "../stayblz-data/formfavApi";
import { codeLabel } from "../stayblz-data/FormFavLists";
import { regionName } from "../stayblz-data/formfavUi";

const shortDay = (iso: string) => dateLabel(iso, "short").replace(/,? \d{4}$/, "");

/**
 * Pick the race-data horse (US and Canada race cards, about the last 30 days) a Stayblz horse is: search by name,
 * with each match's code, countries, trainer, last start and next entry so the right one is easy to tell apart.
 * Used for horses typed into Virtual Stayblz and for owned horses (Community → horse profile).
 */
export default function LinkRacingHorseDialog({
  horseName,
  note,
  onClose,
  onPick,
}: {
  horseName: string;
  /** What linking does for this kind of horse. */
  note: string;
  onClose: () => void;
  /** Saves the link; a thrown error is shown in the dialog. */
  onPick: (target: { name: string; code: IndexCode }) => Promise<void>;
}) {
  const [q, setQ] = useState(horseName);
  const [rows, setRows] = useState<HorseRow[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    const text = q.trim();
    const g = ++generation.current;
    setError("");
    if (text.length < 2) {
      setRows(null);
      return;
    }
    const c = new AbortController();
    const t = window.setTimeout(() => {
      formFav
        .horses({ offset: 0, limit: 12, q: text, codes: ["gallops", "harness"], countries: ["us", "ca"] }, c.signal)
        .then((r) => g === generation.current && setRows(r.records))
        .catch((e) => g === generation.current && !c.signal.aborted && setError(e instanceof Error ? e.message : "Race data couldn't be searched."));
    }, 300);
    return () => {
      window.clearTimeout(t);
      c.abort();
    };
  }, [q]);

  async function pick(h: HorseRow) {
    setSaving(`${h.code}|${h.name}`);
    setSaveError("");
    try {
      await onPick({ name: h.name, code: h.code });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "This horse couldn't be linked.");
      setSaving(null);
    }
  }

  return (
    <TopLayer>
      <Modal label={`Link ${horseName} to a racing horse`} className="gx-layer vs-dialog" onClose={onClose}>
        <DialogHead kicker={horseName} title="Link to a racing horse" onClose={onClose} />
        <div className="vs-form">
          <p className="vs-muted">{note}</p>
          <label className="vs-field">
            <span>Racing horse's name</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} data-autofocus placeholder="Search US and Canada race data" />
          </label>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : rows === null ? (
            <p className="vs-muted">Type at least 2 letters.</p>
          ) : rows.length === 0 ? (
            <p className="vs-muted" role="status">
              No horse by that name raced or was entered in the US or Canada in the last 30 days.
            </p>
          ) : (
            <ul className="vs-results" aria-label="Racing horses">
              {rows.map((h) => {
                const k = `${h.code}|${h.name}`;
                return (
                  <li key={k} className="vs-result">
                    <span className="vs-result-text">
                      <strong>{h.name}</strong>
                      <small>
                        {[codeLabel(h.code), h.countries.map(regionName).join(" · "), h.trainer && `Trainer ${h.trainer}`].filter(Boolean).join(" · ")}
                      </small>
                      <small>
                        {[
                          `${h.starts} ${h.starts === 1 ? "start" : "starts"}`,
                          h.lastStart && `last ${h.lastStart.position ? ordinal(h.lastStart.position) : "ran"} at ${h.lastStart.track ?? h.lastStart.slug}, ${shortDay(h.lastStart.date)}`,
                          h.nextEntry && `entered ${h.nextEntry.track ?? h.nextEntry.slug} ${shortDay(h.nextEntry.date)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                    <button type="button" className="vs-btn vs-btn-primary" disabled={saving !== null} onClick={() => void pick(h)} aria-label={`Link to ${h.name}`}>
                      {saving === k ? "Linking…" : "Link"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </TopLayer>
  );
}
