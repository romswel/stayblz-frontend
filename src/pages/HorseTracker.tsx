import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TrackedHorse } from '../types';

function statusChip(status: string): string {
  switch (status) {
    case 'Race ready':
      return 'chip green';
    case 'Entered':
      return 'chip green';
    case 'In training':
      return 'chip amber';
    case 'Recovering':
      return 'chip red';
    default:
      return 'chip grey';
  }
}

export default function HorseTracker() {
  const [horses, setHorses] = useState<TrackedHorse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ horses: TrackedHorse[] }>('/api/horses')
      .then((d) => setHorses(d.horses))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load horses.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">stable // monitoring</div>
        <h1>Horse Tracker</h1>
        <p className="sub">Training condition, recent form, and upcoming engagements</p>
      </header>

      {loading && <div className="loading">Loading horses…</div>}
      {error && !loading && <div className="empty">{error}</div>}

      <div className="tracker-grid">
        {horses.map((h) => (
          <article key={h.id} className="panel horse-card">
            <div className="top">
              <span className="saddlecloth" style={{ background: h.silksColor }}>
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
          </article>
        ))}
      </div>
    </>
  );
}
