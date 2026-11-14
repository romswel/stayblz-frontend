import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { canUse } from "../components/account/roles";
import { community, errorText, money, type Person, type Post } from "../components/community/api";
import { Avatar, Composer, Empty, FollowButton, Icon, PersonCard, PostCard, Skeletons } from "../components/community/ui";

type Scope = "all" | "following";
const SORTS = [
  { value: "active", label: "Recently active" },
  { value: "horses", label: "Most horses" },
  { value: "earnings", label: "Top earnings" },
  { value: "followers", label: "Most followed" },
  { value: "new", label: "Newest members" },
];

/** /community — the social hub: everyone's posts, the Following feed, and the Members directory. */
export default function Feeds() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "members" ? "members" : "feed";
  const scope: Scope = params.get("scope") === "following" ? "following" : "all";
  const [me, setMe] = useState<Person | null>(null);
  const [myHorses, setMyHorses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let live = true;
    community
      .me()
      .then(async (r) => {
        if (!live) return;
        setMe(r.person);
        if (r.person) {
          const h = await community.personHorses(r.person.id);
          if (live) setMyHorses(h.horses.map((x) => ({ id: x.id, name: x.name })));
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const setTab = (t: "feed" | "members") => setParams(t === "feed" ? {} : { tab: t });
  const setScope = (s: Scope) => setParams(s === "all" ? {} : { scope: s }, { replace: true });

  return (
    <div className="cm cm-feeds">
      <header className="cm-hero gx-glass">
        <div className="cm-hero-main">
          <span className="cm-kicker"><span className="cm-pulse" aria-hidden="true" /> Stayblz community</span>
          <h1>Feeds<span>.</span></h1>
          <p>Horse updates, race results and news from owners across Stayblz. Follow people to keep up with their stable.</p>
        </div>
        <nav className="cm-seg cm-hero-tabs" aria-label="Community sections">
          <button type="button" aria-pressed={tab === "feed"} onClick={() => setTab("feed")}><Icon.Comment /> Feed</button>
          <button type="button" aria-pressed={tab === "members"} onClick={() => setTab("members")}><Icon.Users /> Members</button>
        </nav>
      </header>

      {tab === "feed" ? (
        <div className="cm-feed-layout">
          <main className="cm-feed-main">
            <div className="cm-seg cm-scope" role="group" aria-label="Which posts">
              <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>Everyone</button>
              <button type="button" aria-pressed={scope === "following"} onClick={() => setScope("following")}>Following</button>
            </div>
            <FeedList
              key={scope}
              scope={scope}
              renderComposer={(onPosted) =>
                user && (
                  <Composer
                    me={{ id: user.id, name: user.displayName }}
                    horses={myHorses}
                    isStaff={canUse(user, "admin")}
                    onPosted={onPosted}
                  />
                )
              }
            />
          </main>
          <aside className="cm-feed-side" aria-label="Your community">
            <MeCard me={me} />
            <TopOwners title="Owners to follow" sort="horses" />
            <TopOwners title="Top earners" sort="earnings" showEarnings />
          </aside>
        </div>
      ) : (
        <Members />
      )}
    </div>
  );
}

/* ============================== Feed list ============================== */

function FeedList({ scope, renderComposer }: { scope: Scope; renderComposer: (onPosted: (p: Post) => void) => React.ReactNode }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [fresh, setFresh] = useState(0);
  const newest = useRef<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await community.feed(scope);
      setPosts(r.posts);
      setNext(r.next);
      setFresh(0);
      newest.current = r.posts[0]?.createdAt ?? new Date().toISOString();
      setError("");
    } catch (e) {
      setError(errorText(e, "The feed couldn't be loaded."));
      setPosts((p) => p ?? []);
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);

  // Every minute, check for newer posts and offer them (instead of moving the page under the reader).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !newest.current) return;
      community.newCount(scope, newest.current).then((r) => setFresh(r.count)).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [scope]);

  const more = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await community.feed(scope, next);
      setPosts((p) => [...(p ?? []), ...r.posts.filter((x) => !(p ?? []).some((y) => y.id === x.id))]);
      setNext(r.next);
    } catch {
      /* the button stays for a retry */
    } finally {
      setLoadingMore(false);
    }
  }, [next, loadingMore, scope]);

  // Infinite scroll, with a button as a fallback.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void more(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, more]);

  return (
    <div className="cm-stack">
      {renderComposer((p) => setPosts((l) => [p, ...(l ?? [])]))}
      {fresh > 0 && (
        <button type="button" className="cm-fresh" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); void load(); }}>
          ↑ {fresh} new post{fresh === 1 ? "" : "s"}
        </button>
      )}
      {error && <p className="cm-error" role="alert">{error} <button type="button" className="cm-link" onClick={() => void load()}>Try again</button></p>}
      {posts === null ? (
        <Skeletons count={3} />
      ) : posts.length ? (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onRemoved={(id) => setPosts((l) => (l ?? []).filter((x) => x.id !== id))} />
          ))}
          <div ref={sentinel} />
          {next ? (
            <button type="button" className="cm-btn cm-more" onClick={() => void more()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Show more"}</button>
          ) : (
            <p className="cm-end">You're all caught up.</p>
          )}
        </>
      ) : scope === "following" ? (
        <Empty icon={<Icon.Users />} title="Your Following feed is empty">
          <p>Follow owners to see their posts, new horses and race results here.</p>
          <Link className="cm-btn cm-btn-primary" to="/community?tab=members">Find people to follow</Link>
        </Empty>
      ) : (
        <Empty icon={<Icon.Comment />} title="No posts yet">
          <p>Be the first to share a horse update with the community.</p>
        </Empty>
      )}
    </div>
  );
}

/* ============================== Side cards ============================== */

function MeCard({ me }: { me: Person | null }) {
  if (!me)
    return (
      <section className="cm-card gx-glass cm-me">
        <Skeletons count={1} />
      </section>
    );
  return (
    <section className="cm-card gx-glass cm-me">
      <Link to={`/community/people/${me.id}`} className="cm-me-id">
        <Avatar id={me.id} name={me.name} size={48} />
        <span>
          <strong>{me.name}</strong>
          <small>{me.headline || "Add a headline in My horses"}</small>
        </span>
      </Link>
      <dl className="cm-me-stats">
        <div><dt>Horses</dt><dd>{me.horses}</dd></div>
        <div><dt>Followers</dt><dd>{me.followers}</dd></div>
        <div><dt>Following</dt><dd>{me.followingCount}</dd></div>
      </dl>
      <div className="cm-me-earn">
        <span>Your earnings</span>
        <strong>{money(me.earningsCents)}</strong>
      </div>
      <Link className="cm-btn cm-btn-primary cm-block" to="/account/horses"><Icon.Horse /> Manage my horses</Link>
    </section>
  );
}

function TopOwners({ title, sort, showEarnings }: { title: string; sort: string; showEarnings?: boolean }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    let live = true;
    community
      .people({ sort })
      .then((r) => live && setPeople(r.people.filter((p) => !p.me && (showEarnings ? (p.earningsCents ?? 0) > 0 : p.horses > 0 && !p.isFollowing)).slice(0, 5)))
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, [sort, showEarnings]);
  if (people && !people.length) return null;
  return (
    <section className="cm-card gx-glass">
      <div className="cm-card-head">
        <h2>{title}</h2>
        <Link className="cm-link" to={`/community?tab=members&sort=${sort}`}>See all</Link>
      </div>
      {!people ? (
        <p className="cm-muted">Loading…</p>
      ) : (
        <ol className="cm-rank">
          {people.map((p, i) => (
            <li key={p.id}>
              <span className="cm-rank-n">{i + 1}</span>
              <Link to={`/community/people/${p.id}`} className="cm-rank-id">
                <Avatar id={p.id} name={p.name} size={34} />
                <span>
                  <strong>{p.name}</strong>
                  <small>{showEarnings ? money(p.earningsCents, true) : `${p.horses} horse${p.horses === 1 ? "" : "s"}`}</small>
                </span>
              </Link>
              <FollowButton personId={p.id} isFollowing={p.isFollowing} size="sm" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ============================== Members directory ============================== */

function Members() {
  const [params, setParams] = useSearchParams();
  const sort = SORTS.some((s) => s.value === params.get("sort")) ? params.get("sort")! : "active";
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Typing waits for a pause before searching; the search lives in the address.
  useEffect(() => {
    if (q.trim() === urlQ) return;
    const t = window.setTimeout(() => {
      const nextParams = new URLSearchParams(params);
      if (q.trim()) nextParams.set("q", q.trim());
      else nextParams.delete("q");
      setParams(nextParams, { replace: true });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = new AbortController();
    setPeople(null);
    community
      .people({ q: urlQ, sort }, c.signal)
      .then((r) => {
        setPeople(r.people);
        setNext(r.nextOffset);
        setError("");
      })
      .catch((e) => {
        if (c.signal.aborted) return;
        setError(errorText(e, "Members couldn't be loaded."));
        setPeople([]);
      });
    return () => c.abort();
  }, [urlQ, sort]);

  async function more() {
    if (next === null || busy) return;
    setBusy(true);
    try {
      const r = await community.people({ q: urlQ, sort, offset: next });
      setPeople((p) => [...(p ?? []), ...r.people]);
      setNext(r.nextOffset);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cm-members" aria-label="Members">
      <div className="cm-toolbar gx-glass">
        <label className="cm-search">
          <Icon.Search />
          <input type="search" value={q} maxLength={60} placeholder="Search owners by name or headline" aria-label="Search members" onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="cm-select">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              const n = new URLSearchParams(params);
              n.set("sort", e.target.value);
              setParams(n, { replace: true });
            }}
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="cm-error" role="alert">{error}</p>}
      {people === null ? (
        <Skeletons kind="card" count={6} />
      ) : people.length ? (
        <>
          <div className="cm-grid">
            {people.map((p) => (
              <PersonCard key={p.id} person={p} onFollow={(u) => setPeople((l) => (l ?? []).map((x) => (x.id === u.id ? u : x)))} />
            ))}
          </div>
          {next !== null && <button type="button" className="cm-btn cm-more" onClick={more} disabled={busy}>{busy ? "Loading…" : "Show more members"}</button>}
        </>
      ) : (
        <Empty icon={<Icon.Search />} title={urlQ ? `No members match “${urlQ}”` : "No members to show yet"} />
      )}
    </section>
  );
}
