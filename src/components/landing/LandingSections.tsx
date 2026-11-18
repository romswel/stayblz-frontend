import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDate, kindLabels, type UpdateFeed, type UpdatePost } from "../updates/types";

const icon = (path: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

/** What a free account includes. Plain descriptions only: no sample horses, numbers or dates. */
const FEATURES: { title: string; text: string; icon: ReactNode; tone: string }[] = [
  {
    title: "Race days",
    text: "Racecards, results and workouts from published race days, plus stakes and leaders.",
    icon: icon(<><path d="M4 5h16v14H4z" /><path d="M4 10h16M9 5v14" /></>),
    tone: "a",
  },
  {
    title: "Following & notebook",
    text: "Follow the horses, riders and trainers you care about, and keep private notes on them.",
    icon: icon(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />),
    tone: "b",
  },
  {
    title: "Stayblz Chat",
    text: "Message people and groups, with photos, voice clips, videos and files.",
    icon: icon(<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>),
    tone: "c",
  },
  {
    title: "Stayblz Paddock",
    text: "Video meetings for up to 8 people, right in the browser. Guests ask to come in.",
    icon: icon(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>),
    tone: "a",
  },
  {
    title: "Stable workspace",
    text: "Optional, for owners and trainers: your horses, a training tracker and a team feed.",
    icon: icon(<><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
    tone: "b",
  },
  {
    title: "Community & Marketplace",
    text: "Member and horse profiles, a racing feed, and horses listed for sale by members.",
    icon: icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.8-3.6 3.2-5.5 6-5.5s5.2 1.9 6 5.5" /><path d="M16 4.5a3 3 0 0 1 0 6M18 14.8c1.6.7 2.6 2.4 3 5.2" /></>),
    tone: "c",
  },
];

/** The three newest public posts. Quietly hidden while loading, when empty, or on error. */
function LatestUpdates() {
  const [posts, setPosts] = useState<UpdatePost[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<UpdateFeed>("/api/updates?limit=3", { signal: controller.signal })
      .then((feed) => {
        if (!controller.signal.aborted && Array.isArray(feed?.updates)) setPosts(feed.updates.slice(0, 3));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!posts.length) return null;
  return (
    <section className="lg-section lg-latest ld-reveal" aria-labelledby="lg-latest-title">
      <div className="lg-section-head">
        <div>
          <span className="ld-kicker">FROM UPDATES</span>
          <h2 id="lg-latest-title">What's new on Stayblz</h2>
        </div>
        <Link className="ld-button ld-button-quiet" to="/updates">
          All updates
        </Link>
      </div>
      <div className="lg-latest-grid">
        {posts.map((post) => (
          <Link key={post.id} to={`/updates/${post.slug}`} className="lg-post gx-glass">
            <span className="lg-post-meta">
              <span className={`lg-post-kind kind-${post.kind}`}>{kindLabels[post.kind] ?? "Update"}</span>
              {post.version && <span className="lg-post-version">v{post.version}</span>}
              <span>{formatDate(post.publishedAt)}</span>
            </span>
            <strong>{post.title}</strong>
            {post.summary && <span className="lg-post-summary">{post.summary}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function LandingSections({ onJoin }: { onJoin: () => void }) {
  return (
    <>
      <section className="lg-section lg-features ld-reveal" aria-labelledby="lg-features-title">
        <div className="lg-section-head">
          <div>
            <span className="ld-kicker">INSIDE STAYBLZ</span>
            <h2 id="lg-features-title">One account for your racing</h2>
            <p>Everything below comes with a free account. A stable is never required.</p>
          </div>
          <button type="button" className="ld-button ld-button-gold" onClick={onJoin}>
            Create a free account
          </button>
        </div>
        <ul className="lg-grid">
          {FEATURES.map((feature) => (
            <li key={feature.title} className={`lg-feature gx-glass tone-${feature.tone}`}>
              <span className="lg-feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <LatestUpdates />
    </>
  );
}
