import { useEffect, useState } from "react";
import { useStableApi, useWorkspace } from "../workspace";
import type { TrackedHorse } from "../types";
import HorseEditor from "../components/HorseEditor";

function statusChip(status: string): string {
  switch (status) {
    case "Race ready":
      return "chip green";
    case "Entered":
      return "chip green";
    case "In training":
      return "chip amber";
    case "Recovering":
      return "chip red";
    default:
      return "chip grey";
  }
}

export default function HorseTracker() {
  const api = useStableApi();
  const { active: stable } = useWorkspace();
  const [editing, setEditing] = useState<TrackedHorse | null>(null);
  const [version, setVersion] = useState(0);
  const [horses, setHorses] = useState<TrackedHorse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get<{ horses: TrackedHorse[] }>("/api/horses", { signal: controller.signal })
      .then((d) => {
        if (!Array.isArray(d.horses)) throw Error("Horse tracking response was invalid.");
        if (!controller.signal.aborted) setHorses(d.horses);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load horses.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, version]);

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Horse tracking</div>
        <h1>Horse Tracker</h1>
        <p className="sub">
          Training progress, recent results, and upcoming races
        </p>
      </header>

      {loading && <div className="loading">Loading horses…</div>}
      {error && !loading && <div className="empty" role="alert">{error} <button className="ws-button" onClick={() => setVersion(v => v + 1)}>Retry tracking</button></div>}
      {!loading && !error && !horses.length && (
        <div className="empty">
          No horses registered yet. Add a horse in Inventory to start tracking.
        </div>
      )}
      {editing && (
        <HorseEditor
          tracking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setVersion((v) => v + 1)}
        />
      )}

      <div className="tracker-grid">
        {horses.map((h) => (
          <article key={h.id} className="panel horse-card">
            <div className="top">
              <span
                className="saddlecloth"
                style={{ background: h.silksColor }}
              >
                {h.saddlecloth}
              </span>
              <div>
                <div className="n">{h.name}</div>
                <div className="d">
                  {h.breed} · {h.age} yo · {h.location}
                </div>
              </div>
              <span className={statusChip(h.status)}>{h.status}</span>
            </div>

            <div className="cond">
              <span>Condition</span>
              <span className="bar">
                <span style={{ width: `${h.condition}%` }} />
              </span>
              <span className="v">{h.condition}</span>
            </div>

            <dl className="facts">
              <dt>Trainer</dt>
              <dd>{h.trainer}</dd>
              <dt>Jockey</dt>
              <dd>{h.jockey}</dd>
              <dt>Form</dt>
              <dd className="form-string">{h.form}</dd>
              <dt>Last work</dt>
              <dd>{h.lastWorkout}</dd>
            </dl>

            <div className="next-race">
              <div className="l">Next race</div>
              {h.nextRace ? (
                <div className="r">{h.nextRace}</div>
              ) : (
                <div className="none">Not yet entered</div>
              )}
            </div>
            {(stable?.role === "owner" || stable?.role === "manager") && (
              <button
                className="ws-button tracker-card-edit"
                onClick={() => setEditing(h)}
              >
                Update {h.name}
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
