import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';
import MiniBar from '../components/MiniBar';

interface StandingRow { name: string; starts: number; wins: number; places: number; shows: number; earningsUsd: number; }

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function StandingsTable({ rows, label }: { rows: StandingRow[]; label: string }) {
  return (
    <div className="panel table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className="num">#</th><th>{label}</th><th className="num">Sts</th><th className="num">W</th>
            <th className="num">P</th><th className="num">S</th><th className="num">Win%</th><th className="num">Earnings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td className="num">{i + 1}</td>
              <td><span className="horse-cell"><span className="n">{r.name}</span></span></td>
              <td className="num">{r.starts}</td>
              <td className="num">{r.wins}</td>
              <td className="num">{r.places}</td>
              <td className="num">{r.shows}</td>
              <td className="num">
                <span className="bar-cell">
                  <span>{(r.starts > 0 ? (r.wins / r.starts) * 100 : 0).toFixed(0)}%</span>
                  <MiniBar value={r.starts > 0 ? (r.wins / r.starts) * 100 : 0} max={30} green title="Win rate" />
                </span>
              </td>
              <td className="num gold">{usd.format(r.earningsUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [jockeys, setJockeys] = useState<StandingRow[]>([]);
  const [trainers, setTrainers] = useState<StandingRow[]>([]);
  const [tab, setTab] = useState<'jockeys' | 'trainers'>('jockeys');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ jockeys: StandingRow[]; trainers: StandingRow[] }>('/api/racing/statistics')
      .then((d) => { setJockeys(d.jockeys); setTrainers(d.trainers); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load statistics.'))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="empty">{error}</div>;
  if (loading) return <div className="loading">Loading statistics…</div>;
  if (jockeys.length === 0 && trainers.length === 0) return <div className="empty">No records available yet.</div>;

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // standings</div>
        <h1>Statistics</h1>
        <p className="sub">Season standings — starts, win-place-show, and earnings</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Leading jockey (wins)', value: jockeys[0]?.name ?? '—' },
          { label: 'Leading trainer (wins)', value: trainers[0]?.name ?? '—' },
          { label: 'Riders ranked', value: jockeys.length },
          { label: 'Trainers ranked', value: trainers.length }
        ]}
      />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'jockeys'} className={`tab${tab === 'jockeys' ? ' active' : ''}`} onClick={() => setTab('jockeys')}>Jockeys</button>
        <button role="tab" aria-selected={tab === 'trainers'} className={`tab${tab === 'trainers' ? ' active' : ''}`} onClick={() => setTab('trainers')}>Trainers</button>
      </div>

      {tab === 'jockeys' ? <StandingsTable rows={jockeys} label="Jockey" /> : <StandingsTable rows={trainers} label="Trainer" />}
      <p className="data-note">Development data shown. Production standings require a licensed racing data feed.</p>
    </>
  );
}
