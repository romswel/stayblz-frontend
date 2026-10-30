import { useEffect, useState } from 'react';
import { api } from '../api';
import StatStrip from '../components/StatStrip';

interface WatchItem { name: string; watched: boolean; lastActivity: string; nextAlert: string | null; }

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" />
  </svg>
);

export default function VirtualStable() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ stable: WatchItem[] }>('/api/racing/virtual-stable')
      .then((d) => setItems(d.stable))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your virtual stable.'));
  }, []);

  async function toggle(name: string) {
    // Optimistic toggle; revert on failure.
    setItems((prev) => prev.map((w) => (w.name === name ? { ...w, watched: !w.watched } : w)));
    try {
      await api.post('/api/racing/virtual-stable/toggle', { name });
    } catch {
      setItems((prev) => prev.map((w) => (w.name === name ? { ...w, watched: !w.watched } : w)));
    }
  }

  if (error) return <div className="empty">{error}</div>;
  if (items.length === 0) return <div className="loading">Loading virtual stable…</div>;

  const watchedCount = items.filter((w) => w.watched).length;

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">racing data // watch list</div>
        <h1>Virtual Stable</h1>
        <p className="sub">Watch horses to follow their entries, works, and results — {watchedCount} watched</p>
      </header>

      <StatStrip
        tiles={[
          { label: 'Horses listed', value: items.length },
          { label: 'Watched', value: watchedCount },
          { label: 'Active alerts', value: items.filter((w) => w.watched && w.nextAlert).length }
        ]}
      />

      <ul className="panel watch-list">
        {items.map((w) => (
          <li key={w.name}>
            <button
              className={`star-btn${w.watched ? ' on' : ''}`}
              onClick={() => toggle(w.name)}
              aria-pressed={w.watched}
              aria-label={w.watched ? `Stop watching ${w.name}` : `Watch ${w.name}`}
            >
              <Star filled={w.watched} />
            </button>
            <div className="watch-body">
              <div className="watch-name">{w.name}</div>
              <div className="watch-activity">{w.lastActivity}</div>
              {w.nextAlert && <div className="watch-alert">⚑ {w.nextAlert}</div>}
            </div>
          </li>
        ))}
      </ul>
      <p className="data-note">Watch flags are stored in memory during development; alerts will arrive once notifications are built.</p>
    </>
  );
}
