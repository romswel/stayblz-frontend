import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';
import MiniBar from '../components/MiniBar';

interface SpeedFigure { horse: string; figure: number; date: string; track: string; distance: string; finish: string; }

export default function SpeedFigures() {
  const [rows, setRows] = useState<SpeedFigure[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ speedFigures: SpeedFigure[] }>('/api/racing/speed-figures')
      .then((d) => setRows(d.speedFigures))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load speed figures.'));
  }, []);

  if (error) return <div className="empty">{error}</div>;
  if (rows.length === 0) return <div className="loading">Loading speed figures…</div>;

  const top = Math.max(...rows.map((r) => r.figure));
  const low = Math.min(...rows.map((r) => r.figure));
  const avg = Math.round(rows.reduce((n, r) => n + r.figure, 0) / rows.length);

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // figures</div>
        <h1>Speed Figures</h1>
        <p className="sub">Best recent figures earned across the circuit</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Top figure', value: top },
          { label: 'Average figure', value: avg },
          { label: 'Horses ranked', value: rows.length }
        ]}
      />

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr><th className="num">Fig</th><th></th><th>Horse</th><th>Date</th><th>Track</th><th className="num">Dist</th><th>Finish</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="num"><span className={`fig${r.figure === top ? ' top' : ''}`}>{r.figure}</span></td>
                <td><MiniBar value={r.figure - low + 4} max={top - low + 4} title={`Figure ${r.figure}`} /></td>
                <td><span className="horse-cell"><span className="n">{r.horse}</span></span></td>
                <td>{new Date(r.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                <td>{r.track}</td>
                <td className="num">{r.distance}</td>
                <td>{r.finish}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="data-note">Development data shown. Production figures require a licensed racing data feed.</p>
    </>
  );
}
