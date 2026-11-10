import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import RaceEditor, { RaceFields, raceForm } from "../../components/racing/admin/RaceEditor";
import { TEMPLATE_HEADER, toImportRows } from "../../components/racing/admin/csv";
import { breedLabels, dateLabel } from "../../components/racing/format";
import type { RaceDay } from "../../components/racing/types";
import { useConfirm } from "../../components/ui/Confirm";
import "../../components/racing/racing.css";
import "../../components/updates/updates.css";

/** Publishing tool for one race day: import or type entries, enter results, publish. */
export default function RaceDayEditor() {
  const confirm = useConfirm();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [day, setDay] = useState<RaceDay | null>(null);
  const [loadError, setLoadError] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState("");
  const [csv, setCsv] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newRace, setNewRace] = useState(() => raceForm(undefined, 1));

  const load = useCallback(() => {
    setLoadError("");
    api
      .get<{ day: RaceDay }>(`/api/admin/racing/days/${encodeURIComponent(id)}`)
      .then((body) => {
        setDay(body.day);
        setNotes(body.day.notes);
        setNewRace(raceForm(undefined, (body.day.races.reduce((m, r) => Math.max(m, r.number), 0) ?? 0) + 1));
      })
      .catch((reason) => {
        if (reason instanceof ApiError && reason.status === 404) setMissing(true);
        else setLoadError(reason instanceof Error ? reason.message : "This race day could not be loaded.");
      });
  }, [id]);
  useEffect(load, [load]);
  // Keep "Add a race" one past the highest race number (for example after an import).
  const highest = day?.races.reduce((max, r) => Math.max(max, r.number), 0) ?? 0;
  useEffect(() => {
    setNewRace((current) => (Number(current.number) <= highest ? { ...current, number: String(highest + 1) } : current));
  }, [highest]);

  /** Runs one change; the server answers with the whole updated card. */
  const save = useCallback(async <T extends { day: RaceDay | null }>(request: () => Promise<T>, done: string | ((body: T) => string)) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await request();
      if (body.day) setDay(body.day);
      setNotice(typeof done === "function" ? done(body) : done);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That change could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (missing)
    return (
      <div className="up-empty">
        <h2>That race day no longer exists</h2>
        <Link className="btn btn-quiet" to="/admin/racing">
          Back to race days
        </Link>
      </div>
    );
  if (!day)
    return loadError ? (
      <div className="form-error" role="alert">
        {loadError}{" "}
        <button type="button" className="btn btn-quiet" onClick={load}>
          Try again
        </button>
      </div>
    ) : (
      <p role="status">Loading the race day…</p>
    );

  const harness = day.track.breed === "harness";
  const published = day.status === "published";
  const runners = day.races.reduce((n, r) => n + (r.runners?.length ?? 0), 0);
  const parsed = csv.trim() ? toImportRows(csv) : null;

  return (
    <div className="up-admin rca-page">
      <nav className="up-crumbs" aria-label="Breadcrumb">
        <Link to="/admin/racing">Publish racing</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">
          {day.track.name} · {dateLabel(day.date, "short")}
        </span>
      </nav>
      <header className="up-hero">
        <div>
          <div className="eyebrow">
            {day.track.code} · {breedLabels[day.track.breed]}
          </div>
          <h1>
            {day.track.name}, {dateLabel(day.date, "short")}
          </h1>
          <p className="sub">
            <span className={`up-status status-${published ? "published" : "draft"}`}>{published ? "Published" : "Draft"}</span>{" "}
            {day.races.length} races · {runners} runners
            {published ? " · visible to everyone" : " · only admins can see it"}
          </p>
        </div>
        <div className="up-hero-actions">
          {published && (
            <Link className="btn btn-quiet" to={`/racing/days/${day.id}`}>
              View public card
            </Link>
          )}
          <button
            type="button"
            className={`btn ${published ? "btn-quiet" : "btn-primary"}`}
            disabled={busy}
            onClick={async () => {
              const sure = await confirm(
                published
                  ? {
                      title: "Unpublish this race day?",
                      message: "The card disappears from Entries and Results for everyone until you publish it again.",
                      confirmLabel: "Unpublish",
                    }
                  : {
                      title: "Publish this race day?",
                      message: "Everyone, including visitors without an account, can see this card on Entries. Check the races and runners first.",
                      confirmLabel: "Publish race day",
                    },
              );
              if (!sure) return;
              void save(
                () => api.post<{ day: RaceDay }>(`/api/admin/racing/days/${day.id}/${published ? "unpublish" : "publish"}`, {}),
                published ? "Unpublished. Only admins can see this card now." : "Published. The card is live on Entries.",
              );
            }}
          >
            {published ? "Unpublish" : "Publish race day"}
          </button>
        </div>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="up-saved" role="status">
          {notice}
        </p>
      )}

      <div className="rca-layout">
        <div className="rca-races">
          {day.races.length === 0 && (
            <div className="up-empty">
              <h2>No races yet</h2>
              <p>Import the entries from a spreadsheet, or add the first race below.</p>
            </div>
          )}
          {day.races.map((race) => (
            <RaceEditor key={race.id} race={race} harness={harness} save={save} />
          ))}
          <form
            className="panel rca-race rca-new-race"
            aria-label="Add a race"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save(() => api.post<{ day: RaceDay }>(`/api/admin/racing/days/${day.id}/races`, newRace), `Race ${newRace.number} added.`))
                setNewRace(raceForm(undefined, Number(newRace.number) + 1));
            }}
            noValidate
          >
            <h3>Add a race</h3>
            <RaceFields value={newRace} onChange={setNewRace} />
            <button className="btn btn-primary" disabled={busy}>
              Add race
            </button>
          </form>
        </div>

        <aside className="rca-side">
          <section className="panel rca-panel" aria-labelledby="import-title">
            <h2 id="import-title">Import entries</h2>
            <p className="rc-muted">
              Paste a CSV or spreadsheet (one row per runner), or choose a file. Horses and people are matched by name or
              created. Re-importing updates the same runners.
            </p>
            <label className="rca-file">
              CSV file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setCsv(await file.text());
                }}
              />
            </label>
            <label>
              Or paste rows
              <textarea rows={6} className="rca-csv" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={TEMPLATE_HEADER} />
            </label>
            <details>
              <summary>Columns</summary>
              <p className="rc-muted">
                Needed: <code>race</code>, <code>program</code>, <code>horse</code>. Optional: post time, race name, type
                (maiden, claiming, allowance, stakes…), grade, distance (6 or 1 1/16), unit, surface, purse, post, country,
                sire, dam, sex, foaled, jockey/driver, trainer, owner, weight, ml (5-2), medication, equipment.
              </p>
              <code className="rca-template">{TEMPLATE_HEADER}</code>
              <button type="button" className="btn btn-quiet" onClick={() => void navigator.clipboard?.writeText(TEMPLATE_HEADER)}>
                Copy header row
              </button>
            </details>
            {parsed?.error && (
              <p className="form-error" role="alert">
                {parsed.error}
              </p>
            )}
            {parsed && !parsed.error && (
              <p className="rc-muted" role="status">
                {parsed.rows.length} runners ready
                {parsed.ignored.length > 0 && ` · ignoring column${parsed.ignored.length > 1 ? "s" : ""}: ${parsed.ignored.join(", ")}`}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !parsed || !!parsed.error || !parsed.rows.length}
              onClick={async () => {
                if (!parsed) return;
                const ok = await save(
                  () =>
                    api.post<{ day: RaceDay; summary: { runners: number; racesCreated: number; horsesCreated: number; peopleCreated: number } }>(
                      `/api/admin/racing/days/${day.id}/import`,
                      { rows: parsed.rows },
                    ),
                  (body) =>
                    `Imported ${body.summary.runners} runners: ${body.summary.racesCreated} new races, ${body.summary.horsesCreated} new horses, ${body.summary.peopleCreated} new people.`,
                );
                if (ok) setCsv("");
              }}
            >
              Import {parsed && !parsed.error ? parsed.rows.length : ""} runners
            </button>
          </section>

          <section className="panel rca-panel" aria-labelledby="notes-title">
            <h2 id="notes-title">Card notes</h2>
            <textarea rows={3} maxLength={1000} value={notes} aria-label="Card notes" onChange={(e) => setNotes(e.target.value)} />
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy || notes === day.notes}
              onClick={() => void save(() => api.put<{ day: RaceDay }>(`/api/admin/racing/days/${day.id}`, { notes }), "Notes saved.")}
            >
              Save notes
            </button>
          </section>

          {!published && (
            <section className="panel rca-panel" aria-labelledby="danger-title">
              <h2 id="danger-title">Delete this draft</h2>
              {!confirmDelete ? (
                <button type="button" className="btn btn-quiet up-danger" onClick={() => setConfirmDelete(true)}>
                  Delete race day
                </button>
              ) : (
                <span className="up-confirm">
                  Delete the card and all its races?
                  <button
                    type="button"
                    className="btn btn-quiet up-danger"
                    onClick={async () => {
                      if (
                        await save(async () => {
                          await api.delete(`/api/admin/racing/days/${day.id}`);
                          return { day: null };
                        }, "Deleted.")
                      )
                        navigate("/admin/racing", { replace: true });
                    }}
                  >
                    Yes, delete
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </span>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
