import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';
import MiniBar from '../components/MiniBar';

interface StakesRace { date: string; race: string; grade: string; track: string; distance: string; surface: string; purse: string; conditions: string; }

export default function Stakes() {
  const [rows, setRows] = useState<StakesRace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ stakes: StakesRace[] }>('/api/racing/stakes')
      .then((d) => setRows(d.stakes))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load stakes schedule.'));
  }, []);

  if (error) return <div className="empty">{error}</div>;
  if (rows.length === 0) return <div className="loading">Loading stakes schedule…</div>;

  const purse = (p: string) => Number(p.replace(/[^0-9]/g, ''));
  const totalPurses = rows.reduce((n, s) => n + purse(s.purse), 0);
  const graded = rows.filter((s) => s.grade.startsWith('G')).length;
  const maxPurse = Math.max(...rows.map((s) => purse(s.purse)));

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // calendar</div>
        <h1>Stakes Schedule</h1>
        <p className="sub">Graded and listed stakes for the remainder of the season</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Stakes remaining', value: rows.length },
          { label: 'Graded stakes', value: graded },
          { label: 'Total purses', value: `$${(totalPurses / 1000000).toFixed(2)}M` }
        ]}
      />

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Grade</th><th>Race</th><th>Track</th><th className="num">Dist</th><th>Surface</th><th className="num">Purse</th><th>Cond</th></tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i}>
                <td>{new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                <td><span className={`grade ${s.grade.toLowerCase()}`}>{s.grade}</span></td>
                <td><span className="horse-cell"><span className="n">{s.race}</span></span></td>
                <td>{s.track}</td>
                <td className="num">{s.distance}</td>
                <td>{s.surface}</td>
                <td className="num">
                  <span className="bar-cell">
                    <span className="gold" style={{ fontWeight: 700 }}>{s.purse}</span>
                    <MiniBar value={purse(s.purse)} max={maxPurse} title="Purse relative to the richest race" />
                  </span>
                </td>
                <td>{s.conditions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="data-note">Development data shown. Production schedules require a licensed racing data feed.</p>
    </>
  );
}
