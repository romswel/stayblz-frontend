import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';

interface Workout { date: string; horse: string; track: string; distance: string; time: string; note: string; rank: string; }

export default function Workouts() {
  const [rows, setRows] = useState<Workout[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ workouts: Workout[] }>('/api/racing/workouts')
      .then((d) => setRows(d.workouts))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load workouts.'));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((w) => [w.horse, w.track, w.note].some((v) => v.toLowerCase().includes(q)));
  }, [rows, query]);

  if (error) return <div className="empty">{error}</div>;

  const bullets = rows.filter((x) => x.rank.startsWith('1/')).length;
  const trackCount = new Set(rows.map((x) => x.track)).size;

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // works</div>
        <h1>Workouts</h1>
        <p className="sub">Latest recorded works across all tracks</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Recorded works', value: rows.length },
          { label: 'Bullet works', value: bullets },
          { label: 'Tracks covered', value: trackCount }
        ]}
      />

      <div className="toolbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by horse, track…" aria-label="Filter workouts" />
        <span className="count">{filtered.length} works</span>
      </div>

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Horse</th><th>Track</th><th className="num">Dist</th><th className="num">Time</th><th>Note</th><th className="num">Rank</th></tr>
          </thead>
          <tbody>
            {filtered.map((w, i) => (
              <tr key={i}>
                <td>{new Date(w.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                <td><span className="horse-cell"><span className="n">{w.horse}</span></span></td>
                <td>{w.track}</td>
                <td className="num">{w.distance}</td>
                <td className="num gold">{w.time}</td>
                <td>{w.note}</td>
                <td className="num">
                  {w.rank.startsWith('1/') && <span className="bullet" title="Bullet work — fastest of the day at the distance">●</span>}
                  {w.rank}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7}><div className="empty">No works match your filter.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="data-note">Development data shown. Production workouts require a licensed racing data feed.</p>
    </>
  );
}
