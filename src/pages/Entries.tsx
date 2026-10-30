import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';
import MiniBar from '../components/MiniBar';

interface RaceEntry { pp: number; silksColor: string; horse: string; ml: string; jockey: string; trainer: string; weight: number; }
interface RaceCard { raceNo: number; postTime: string; distance: string; surface: string; type: string; purse: string; entries: RaceEntry[]; }
interface TrackEntries { track: string; date: string; races: RaceCard[]; }

export default function Entries() {
  const [tracks, setTracks] = useState<TrackEntries[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ entries: TrackEntries[] }>('/api/racing/entries')
      .then((d) => setTracks(d.entries))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load entries.'));
  }, []);

  if (error) return <div className="empty">{error}</div>;
  if (tracks.length === 0) return <div className="loading">Loading entries…</div>;

  const t = tracks[Math.min(active, tracks.length - 1)];

  const allRaces = tracks.flatMap((tr) => tr.races);
  const totalEntries = allRaces.reduce((n, r) => n + r.entries.length, 0);
  const richest = allRaces.reduce((best, r) => {
    const v = Number(r.purse.replace(/[^0-9]/g, ''));
    return v > best ? v : best;
  }, 0);

  function impliedPct(ml: string): number {
    const [a, b] = ml.split('-').map(Number);
    if (!a || !b) return 0;
    return (b / (a + b)) * 100;
  }

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // entries</div>
        <h1>Entries</h1>
        <p className="sub">Upcoming race cards with post positions and morning-line odds</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Tracks', value: tracks.length },
          { label: 'Races carded', value: allRaces.length },
          { label: 'Total entries', value: totalEntries },
          { label: 'Richest purse', value: `$${richest.toLocaleString()}` }
        ]}
      />

      <div className="tabs" role="tablist">
        {tracks.map((tr, i) => (
          <button key={tr.track} role="tab" aria-selected={i === active} className={`tab${i === active ? ' active' : ''}`} onClick={() => setActive(i)}>
            {tr.track} · {new Date(tr.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </button>
        ))}
      </div>

      {t.races.map((r) => (
        <section key={r.raceNo} className="panel race-card">
          <div className="race-card-head">
            <span className="race-no">Race {r.raceNo}</span>
            <span className="race-meta">
              <span><b>{r.distance}</b> {r.surface}</span>
              <span>{r.type}</span>
              <span>Purse <b>{r.purse}</b></span>
            </span>
            <span className="race-post">Post <b>{r.postTime}</b></span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>PP</th><th>Horse</th><th className="num">M/L</th><th>Jockey</th><th>Trainer</th><th className="num">Wt</th>
                </tr>
              </thead>
              <tbody>
                {r.entries.map((e) => (
                  <tr key={e.pp}>
                    <td><span className="saddlecloth" style={{ background: e.silksColor }}>{e.pp}</span></td>
                    <td><span className="horse-cell"><span className="n">{e.horse}</span></span></td>
                    <td className="num">
                      <span className="bar-cell">
                        <span className="odds">{e.ml}</span>
                        <MiniBar value={impliedPct(e.ml)} max={100} title={`~${impliedPct(e.ml).toFixed(0)}% implied`} />
                      </span>
                    </td>
                    <td>{e.jockey}</td>
                    <td>{e.trainer}</td>
                    <td className="num">{e.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="data-note">Development data shown. Production entries require a licensed racing data feed.</p>
    </>
  );
}
