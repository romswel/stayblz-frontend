import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import HorsePhoto from '../components/HorsePhoto';
import MiniBar from '../components/MiniBar';
import type { ConversationPreview } from '../types';

interface Engagement {
  id: string;
  saddlecloth: number;
  silksColor: string;
  coatColor: string;
  maneColor: string;
  blaze: boolean;
  name: string;
  jockey: string;
  nextRace: string;
}

interface Summary {
  stats: { horses: number; raceReady: number; inWork: number; recovering: number; unread: number };
  engagements: Engagement[];
  recentMessages: ConversationPreview[];
}

interface FeedPost {
  id: string;
  author: string;
  role: string;
  body: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Summary>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the dashboard.'));
    api
      .get<{ posts: FeedPost[] }>('/api/feed')
      .then((d) => setPosts(d.posts))
      .catch(() => setPosts([]));
  }, []);

  async function submitPost(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      const d = await api.post<{ post: FeedPost }>('/api/feed', { body: draft.trim() });
      setPosts((prev) => [d.post, ...prev]);
      setDraft('');
    } catch {
      // keep the draft so nothing is lost
    } finally {
      setPosting(false);
    }
  }

  if (error) return <div className="empty">{error}</div>;
  if (!data) return <div className="loading">Loading dashboard…</div>;

  const { stats, engagements, recentMessages } = data;

  const miniStats = [
    { label: 'Horses in stable', value: stats.horses, max: stats.horses, to: '/inventory' },
    { label: 'Race ready', value: stats.raceReady, max: stats.horses, to: '/tracker' },
    { label: 'In training', value: stats.inWork, max: stats.horses, to: '/tracker' },
    { label: 'Recovering', value: stats.recovering, max: stats.horses, to: '/tracker' }
  ];

  const today = new Date()
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })
    .toUpperCase();

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{today} // stable operations</div>
        <h1>Stable Feed</h1>
        <p className="sub">Updates from your trainers, riders, and staff — post to keep everyone in sync</p>
      </header>

      <div className="feed-layout">
        <div className="feed-main">
          <form className="panel composer-card" onSubmit={submitPost}>
            <div className="composer-top">
              <span className="feed-avatar me">{(user?.displayName ?? '?').charAt(0)}</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={500}
                placeholder="Share an update with the stable…"
                aria-label="Write a feed post"
              />
            </div>
            <div className="row">
              <span className="hint">{draft.length}/500</span>
              <button className="btn btn-primary" type="submit" disabled={posting || !draft.trim()}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>

          {posts.map((p) => (
            <article key={p.id} className="panel post-card">
              <span className={`feed-avatar${p.author === user?.displayName ? ' me' : ''}`}>
                {p.author.charAt(0)}
              </span>
              <div className="feed-body">
                <div className="feed-meta">
                  <span className="feed-author">{p.author}</span>
                  <span className="feed-role">{p.role}</span>
                  <span className="feed-time">{timeAgo(p.createdAt)}</span>
                </div>
                <p className="feed-text">{p.body}</p>
              </div>
            </article>
          ))}
          {posts.length === 0 && <div className="panel empty">No updates yet — post the first one.</div>}
        </div>

        <aside className="feed-rail">
          <section className="panel">
            <div className="panel-head">
              <h2>Stable status</h2>
            </div>
            <div className="rail-body">
              {miniStats.map((s) => (
                <Link key={s.label} to={s.to} className="mini-stat">
                  <span className="l">{s.label}</span>
                  <span className="v">{s.value}</span>
                  <MiniBar value={s.value} max={s.max} title={`${s.value} of ${s.max}`} />
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Engagements</h2>
              <Link to="/entries">Entries</Link>
            </div>
            <div className="rail-body">
              {engagements.slice(0, 4).map((e) => (
                <div key={e.id} className="rail-item">
                  <HorsePhoto horseId={e.id} name={e.name} size={34} coat={e.coatColor} mane={e.maneColor} blaze={e.blaze} />
                  <div className="body">
                    <div className="t">
                      <span className="saddlecloth sm" style={{ background: e.silksColor }}>{e.saddlecloth}</span>
                      {e.name}
                    </div>
                    <div className="d">{e.nextRace}</div>
                  </div>
                </div>
              ))}
              {engagements.length === 0 && <div className="rail-item"><div className="d">No races entered yet.</div></div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Messages</h2>
              {stats.unread > 0 && <span className="count-pill">{stats.unread}</span>}
              <Link to="/messages">Open</Link>
            </div>
            <div className="rail-body">
              {recentMessages.map((m) => (
                <div key={m.id} className="rail-item">
                  <div className="body">
                    <div className="t">{m.title}</div>
                    <div className="d">{m.lastMessage}</div>
                  </div>
                  {m.unread > 0 && <span className="unread-dot">{m.unread}</span>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
