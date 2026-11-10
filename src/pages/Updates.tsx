import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import UpdatesHeader from "../components/updates/UpdatesHeader";
import { useUpdates } from "../components/updates/UpdatesContext";
import { CardSkeleton, UpdateCard } from "../components/updates/UpdateParts";
import { kindFilters, type UpdateFeed, type UpdateKind, type UpdatePost } from "../components/updates/types";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import "../components/updates/updates.css";
import "./landing.css";
import "./faq.css";

type FeedState = {
  posts: UpdatePost[];
  pinned: UpdatePost[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
};

/** Reader feed with type filter, search and "load older". Late replies are ignored. */
function useFeed(kind: string, query: string) {
  const [state, setState] = useState<FeedState>({ posts: [], pinned: [], hasMore: false, loading: true, loadingMore: false, error: "" });
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const url = (before?: string) => {
    const params = new URLSearchParams({ limit: "12" });
    if (kind) params.set("kind", kind);
    if (query) params.set("q", query);
    if (before) params.set("before", before);
    return `/api/updates?${params}`;
  };
  useEffect(() => {
    const id = ++request.current;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    api
      .get<UpdateFeed>(url(), { signal: controller.signal })
      .then((feed) => {
        if (id !== request.current) return;
        setState({ posts: feed.updates ?? [], pinned: feed.pinned ?? [], hasMore: !!feed.hasMore, loading: false, loadingMore: false, error: "" });
      })
      .catch((reason) => {
        if (id !== request.current || controller.signal.aborted) return;
        // Keep anything already shown; explain the problem above it.
        setState((s) => ({ ...s, loading: false, error: reason instanceof Error ? reason.message : "Updates could not be loaded." }));
      });
    return () => controller.abort();
    // `url` is derived from kind and query.
  }, [kind, query, attempt]);

  const loadMore = useCallback(async () => {
    const last = state.posts[state.posts.length - 1];
    if (!last?.publishedAt || state.loadingMore) return;
    const id = request.current;
    setState((s) => ({ ...s, loadingMore: true, error: "" }));
    try {
      const feed = await api.get<UpdateFeed>(url(last.publishedAt));
      if (id !== request.current) return;
      setState((s) => ({ ...s, posts: [...s.posts, ...(feed.updates ?? [])], hasMore: !!feed.hasMore, loadingMore: false }));
    } catch (reason) {
      if (id !== request.current) return;
      setState((s) => ({ ...s, loadingMore: false, error: reason instanceof Error ? reason.message : "Older posts could not be loaded." }));
    }
    // `url` is derived from kind and query.
  }, [state.posts, state.loadingMore, kind, query]);

  return { ...state, retry: () => setAttempt((n) => n + 1), loadMore };
}

function Feed({ seenAt }: { seenAt: string | null }) {
  const [params, setParams] = useSearchParams();
  const kind = (kindFilters.some((f) => f.kind === params.get("kind")) ? params.get("kind") : "") as UpdateKind | "";
  const query = (params.get("q") ?? "").slice(0, 80);
  const [draft, setDraft] = useState(query);
  const feed = useFeed(kind, query);
  // Search as people type, without a request per key press.
  useEffect(() => {
    if (draft.trim() === query) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set("q", draft.trim());
      else next.delete("q");
      setParams(next, { replace: true });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const choose = (next: string) => {
    const copy = new URLSearchParams(params);
    if (next) copy.set("kind", next);
    else copy.delete("kind");
    setParams(copy, { replace: true });
  };
  const isNew = (post: UpdatePost) => !!seenAt && !!post.publishedAt && Date.parse(post.publishedAt) > Date.parse(seenAt);
  const filtering = !!kind || !!query;
  const [lead, ...rest] = feed.posts;
  const pinned = feed.pinned.filter((post) => post.id !== lead?.id);

  return (
    <div className="up-feed">
      <div className="up-toolbar">
        <div className="up-chips" role="group" aria-label="Show">
          {kindFilters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className="up-chip"
              aria-pressed={kind === filter.kind}
              onClick={() => choose(filter.kind)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="up-search">
          <span className="sr-only">Search updates</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="10" cy="10" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            type="search"
            placeholder="Search updates…"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
      </div>

      {feed.error && (
        <div className="form-error up-error" role="alert">
          {feed.error}{" "}
          <button type="button" className="btn btn-quiet" onClick={feed.retry}>
            Try again
          </button>
        </div>
      )}

      {feed.loading && !feed.posts.length ? (
        <>
          <p className="sr-only" role="status">
            Loading updates…
          </p>
          <CardSkeleton count={4} />
        </>
      ) : !feed.posts.length && !feed.error ? (
        <div className="up-empty">
          <span aria-hidden="true">✦</span>
          <h2>{filtering ? "No posts match" : "No updates yet"}</h2>
          <p>
            {filtering
              ? "Try another type or a different word."
              : "When we release something new or have news to share, it will appear here."}
          </p>
          {filtering && (
            <button type="button" className="btn btn-quiet" onClick={() => { setDraft(""); setParams({}, { replace: true }); }}>
              Show everything
            </button>
          )}
        </div>
      ) : (
        <div className={`up-layout${feed.loading ? " is-refreshing" : ""}`} aria-busy={feed.loading || undefined}>
          {lead && (
            <div className="up-lead">
              <span className="up-section-label">{filtering ? "Best match" : "Latest"}</span>
              <UpdateCard post={lead} featured isNew={isNew(lead)} />
            </div>
          )}
          {!filtering && pinned.length > 0 && (
            <aside className="up-pinned" aria-label="Pinned posts">
              <span className="up-section-label">Pinned</span>
              {pinned.map((post) => (
                <UpdateCard key={post.id} post={post} isNew={isNew(post)} />
              ))}
            </aside>
          )}
          {rest.length > 0 && (
            <section className="up-rest" aria-label="Earlier posts">
              <span className="up-section-label">Earlier</span>
              <div className="up-grid">
                {rest.map((post) => (
                  <UpdateCard key={post.id} post={post} isNew={isNew(post)} />
                ))}
              </div>
            </section>
          )}
          {feed.hasMore && (
            <div className="up-load-more">
              <button type="button" className="btn btn-quiet" onClick={() => void feed.loadMore()} disabled={feed.loadingMore}>
                {feed.loadingMore ? "Loading…" : "Load older posts"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SignedInUpdates() {
  const { seenAt, unread, markSeen } = useUpdates();
  // Badges compare with the read time from when the page opened, then the page counts as read.
  const [openedSeenAt] = useState(seenAt);
  useEffect(() => {
    if (unread.length) void markSeen();
    // Once on open.
  }, []);
  return (
    <div className="up-page">
      <UpdatesHeader />
      <Feed seenAt={openedSeenAt} />
    </div>
  );
}

function PublicUpdates() {
  const pageRef = usePublicMotion();
  return (
    <div className="landing" id="top" ref={pageRef}>
      <a className="ld-skip" href="#updates-main">
        Skip to updates
      </a>
      <PublicHeader />
      <main className="faq-main up-public" id="updates-main">
        <div className="faq-intro">
          <div>
            <span className="ld-kicker">STAYBLZ / UPDATES</span>
            <h1>
              Releases, news
              <br />
              <em>&amp; notices.</em>
            </h1>
            <p>
              What's new on Stayblz, newest first. <Link to="/signup">Create an account</Link> to use new features and
              read members-only posts.
            </p>
          </div>
        </div>
        <div className="up-public-body">
          <Feed seenAt={null} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

/** Updates feed. Public, so anyone (including the boss) can read it without an account. */
export default function Updates() {
  const { user } = useAuth();
  return user ? <SignedInUpdates /> : <PublicUpdates />;
}
