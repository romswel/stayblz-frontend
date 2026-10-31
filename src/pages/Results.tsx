import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';
import MiniBar from '../components/MiniBar';

interface Finisher { pos: number; horse: string; jockey: string; margin: string; odds: string; }
interface RaceResult {
  track: string; date: string; raceNo: number; distance: string; surface: string; finalTime: string;
  finishers: Finisher[]; payouts: { win: string; place: string; show: string }; chartNote: string;
}

export default function Results() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results: RaceResult[] }>('/api/racing/results')
      .then((d) => setResults(d.results))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load results.'))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="empty">{error}</div>;
  if (loading) return <div className="loading">Loading results…</div>;
  if (results.length === 0) return <div className="empty">No records available yet.</div>;

  const topPayout = results.reduce((best, x) => {
    const v = Number(x.payouts.win.replace(/[^0-9.]/g, ''));
    return v > best ? v : best;
  }, 0);
  const fastest = results.map((x) => x.finalTime).sort()[0];

  function marginLengths(m: string): number {
    const map: Record<string, number> = { ns: 0.05, nk: 0.3, hd: 0.2 };
    if (map[m] !== undefined) return map[m];
    const frac: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
    let total = 0;
    let rest = m;
    for (const [sym, val] of Object.entries(frac)) {
      if (rest.includes(sym)) { total += val; rest = rest.replace(sym, ''); }
    }
    total += Number(rest) || 0;
    return total;
  }

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // charts</div>
        <h1>Results &amp; Charts</h1>
        <p className="sub">Official finishes, payouts, and chart-caller notes</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Races charted', value: results.length },
          { label: 'Top win payout', value: `$${topPayout.toFixed(2)}` },
          { label: 'Fastest final time', value: fastest }
        ]}
      />

      {results.map((r) => (
        <section key={`${r.track}-${r.date}-${r.raceNo}`} className="panel race-card">
          <div className="race-card-head">
            <span className="race-no">Race {r.raceNo}</span>
            <span className="race-meta">
              <span><b>{r.track}</b></span>
              <span>{new Date(r.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span><b>{r.distance}</b> {r.surface}</span>
            </span>
            <span className="race-post">Final time <b>{r.finalTime}</b></span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Fin</th><th>Horse</th><th>Jockey</th><th className="num">Beaten by</th><th className="num">Odds</th></tr>
              </thead>
              <tbody>
                {r.finishers.map((f) => (
                  <tr key={f.pos}>
                    <td><span className={`pos-badge p${f.pos}`}>{f.pos}</span></td>
                    <td><span className="horse-cell"><span className="n">{f.horse}</span></span></td>
                    <td>{f.jockey}</td>
                    <td className="num">
                      <span className="bar-cell">
                        <span>{f.margin}</span>
                        {f.pos > 1 && (
                          <MiniBar
                            value={marginLengths(f.margin)}
                            max={Math.max(...r.finishers.filter((x) => x.pos > 1).map((x) => marginLengths(x.margin)))}
                            title={`${f.margin} lengths behind the horse ahead`}
                          />
                        )}
                      </span>
                    </td>
                    <td className="num">{f.odds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="payout-row">
            <span className="payout">Win<b>{r.payouts.win}</b></span>
            <span className="payout">Place<b>{r.payouts.place}</b></span>
            <span className="payout">Show<b>{r.payouts.show}</b></span>
          </div>
          <p className="chart-note">{r.chartNote}</p>
        </section>
      ))}
      <p className="data-note">Development data shown. Production results require a licensed racing data feed.</p>
    </>
  );
}
