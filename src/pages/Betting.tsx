import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';

interface Runner { pp: number; horse: string; ml: string; silksColor: string; decimal: number; }
interface Market {
  id: string; league: string; track: string; raceNo: number; date: string;
  postTime: string; distance: string; surface: string; runners: Runner[];
}
interface Txn { id: string; type: string; amount: number; note: string; at: string; }
interface Bet {
  id: string; raceLabel: string; horse: string; ml: string;
  stake: number; potential: number; status: string; placedAt: string;
}

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QUICK = [100, 250, 500];

export default function Betting() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [selection, setSelection] = useState<{ market: Market; runner: Runner } | null>(null);
  const [stake, setStake] = useState('50');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadWallet() {
    api.get<{ balance: number; transactions: Txn[] }>('/api/betting/wallet')
      .then((d) => { setBalance(d.balance); setTxns(d.transactions); })
      .catch(() => undefined);
  }

  useEffect(() => {
    api.get<{ markets: Market[] }>('/api/betting/markets')
      .then((d) => setMarkets(d.markets))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load markets.'));
    api.get<{ bets: Bet[] }>('/api/betting/bets')
      .then((d) => setBets(d.bets))
      .catch(() => undefined);
    loadWallet();
  }, []);

  async function deposit(amount: number) {
    setBusy(true);
    setNotice(null);
    try {
      const d = await api.post<{ balance: number }>('/api/betting/wallet/deposit', { amount });
      setBalance(d.balance);
      loadWallet();
      setNotice(`Added ${fmt.format(amount)} demo credits.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  }

  async function placeBet() {
    if (!selection) return;
    const amount = Number(stake);
    setBusy(true);
    setNotice(null);
    try {
      const d = await api.post<{ bet: Bet; balance: number }>('/api/betting/bets', {
        marketId: selection.market.id,
        horse: selection.runner.horse,
        stake: amount
      });
      setBets((prev) => [d.bet, ...prev]);
      setBalance(d.balance);
      loadWallet();
      setSelection(null);
      setNotice(`Bet placed — ${d.bet.horse} to win, potential ${fmt.format(d.bet.potential)}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not place the bet.');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="empty">{error}</div>;
  if (markets.length === 0) return <div className="loading">Loading markets…</div>;

  const leagues = [...new Set(markets.map((m) => m.league))];
  const stakeNum = Number(stake);
  const stakeValid = Number.isFinite(stakeNum) && stakeNum >= 1 && (balance === null || stakeNum <= balance);
  const potential = selection && stakeValid ? stakeNum * selection.runner.decimal : 0;

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">wagering // demo credits</div>
        <h1>Betting</h1>
        <p className="sub">Back a horse in the upcoming league races — simulated credits only, no real money</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Wallet balance', value: balance === null ? '—' : fmt.format(balance) },
          { label: 'Open bets', value: bets.filter((b) => b.status === 'Open').length },
          { label: 'Races open', value: markets.length },
          { label: 'Leagues', value: leagues.length }
        ]}
      />

      {notice && <div className="bet-notice">{notice}</div>}

      <div className="bet-layout">
        <div className="bet-main">
          {leagues.map((league) => (
            <section key={league}>
              <div className="league-label">{league}</div>
              {markets.filter((m) => m.league === league).map((m) => (
                <div key={m.id} className="panel race-card">
                  <div className="race-card-head">
                    <span className="race-no">R{m.raceNo}</span>
                    <span className="race-meta">
                      <span><b>{m.track}</b></span>
                      <span>{new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      <span><b>{m.distance}</b> {m.surface}</span>
                    </span>
                    <span className="race-post">Post <b>{m.postTime}</b></span>
                  </div>
                  <div className="runner-grid">
                    {m.runners.map((r) => {
                      const active = selection?.market.id === m.id && selection.runner.horse === r.horse;
                      return (
                        <button
                          key={r.pp}
                          className={`runner-btn${active ? ' active' : ''}`}
                          onClick={() => setSelection(active ? null : { market: m, runner: r })}
                          aria-pressed={active}
                        >
                          <span className="saddlecloth sm" style={{ background: r.silksColor }}>{r.pp}</span>
                          <span className="rn">{r.horse}</span>
                          <span className="odds">{r.ml}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
          <p className="data-note">
            Demo wagering with simulated credits for prototype review only. Real-money betting requires licensing,
            age and identity verification, and responsible-gambling controls.
          </p>
        </div>

        <aside className="bet-rail">
          <section className="panel">
            <div className="panel-head"><h2>Wallet</h2></div>
            <div className="rail-body">
              <div className="wallet-balance">
                <span className="v">{balance === null ? '—' : fmt.format(balance)}</span>
                <span className="l">demo credits</span>
              </div>
              <div className="deposit-row">
                {QUICK.map((q) => (
                  <button key={q} className="btn btn-quiet" disabled={busy} onClick={() => deposit(q)}>
                    +{q}
                  </button>
                ))}
              </div>
              <div className="txn-list">
                {txns.slice(0, 5).map((t) => (
                  <div key={t.id} className="txn">
                    <span className="n">{t.note}</span>
                    <span className={`a${t.amount < 0 ? ' neg' : ''}`}>
                      {t.amount > 0 ? '+' : ''}{fmt.format(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Bet slip</h2></div>
            <div className="rail-body">
              {!selection && <div className="slip-empty">Select a horse from a race card to build your bet.</div>}
              {selection && (
                <>
                  <div className="slip-pick">
                    <span className="saddlecloth sm" style={{ background: selection.runner.silksColor }}>
                      {selection.runner.pp}
                    </span>
                    <div className="body">
                      <div className="t">{selection.runner.horse}</div>
                      <div className="d">
                        {selection.market.track} · R{selection.market.raceNo} · Win @ {selection.runner.ml}
                      </div>
                    </div>
                  </div>
                  <label className="slip-label" htmlFor="stake">Stake</label>
                  <input
                    id="stake"
                    className="slip-stake"
                    inputMode="numeric"
                    value={stake}
                    onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ''))}
                  />
                  <div className="slip-return">
                    <span>Potential return</span>
                    <span className="v">{stakeValid ? fmt.format(potential) : '—'}</span>
                  </div>
                  <button className="btn btn-primary" disabled={busy || !stakeValid} onClick={placeBet}>
                    {busy ? 'Placing…' : 'Place bet'}
                  </button>
                  {!stakeValid && stake !== '' && (
                    <div className="slip-warn">Stake must be at least 1 and within your balance.</div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>My bets</h2>
              {bets.length > 0 && <span className="count-pill">{bets.length}</span>}
            </div>
            <div className="rail-body">
              {bets.length === 0 && <div className="slip-empty">No bets yet.</div>}
              {bets.slice(0, 6).map((b) => (
                <div key={b.id} className="rail-item">
                  <div className="body">
                    <div className="t">{b.horse} <span className="odds">{b.ml}</span></div>
                    <div className="d">{b.raceLabel}</div>
                  </div>
                  <div className="bet-amounts">
                    <span className="s">-{fmt.format(b.stake)}</span>
                    <span className="p">→ {fmt.format(b.potential)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
