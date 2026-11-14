import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { community, errorText, money, type Horse, type Person, type PersonLite, type Post } from "../components/community/api";
import { Avatar, Composer, Empty, FollowButton, HorseCard, Icon, PostCard, Skeletons } from "../components/community/ui";
import { canUse } from "../components/account/roles";

type Tab = "horses" | "posts" | "followers" | "following";

/** /community/people/:id — a member's public profile: horses, earnings, posts and follows. */
export default function MemberProfile() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (["horses", "posts", "followers", "following"].includes(params.get("tab") ?? "") ? params.get("tab") : "horses") as Tab;
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState("");
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    let live = true;
    setPerson(null);
    setError("");
    community
      .person(id)
      .then((r) => live && setPerson(r.person))
      .catch((e) => live && setError(errorText(e, "This member isn't available.")));
    return () => {
      live = false;
    };
  }, [id]);

  async function message() {
    if (!person || messaging) return;
    setMessaging(true);
    try {
      // Same endpoint the Messages "People" search uses to open a one-to-one chat.
      const thread = await api.post<{ conversation?: { id: string } }>(`/api/messages/people/${person.id}/chat`, {});
      navigate(thread?.conversation?.id ? `/messages/${thread.conversation.id}` : "/messages");
    } catch (e) {
      setError(errorText(e, "A chat couldn't be started."));
    } finally {
      setMessaging(false);
    }
  }

  if (error && !person)
    return (
      <div className="cm">
        <Empty icon={<Icon.Users />} title="This member isn't available">
          <p>{error}</p>
          <Link className="cm-btn" to="/community?tab=members">Browse members</Link>
        </Empty>
      </div>
    );
  if (!person)
    return (
      <div className="cm">
        <Skeletons count={2} />
      </div>
    );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "horses", label: "Horses", count: person.horses },
    { key: "posts", label: "Posts", count: person.posts },
    { key: "followers", label: "Followers", count: person.followers },
    { key: "following", label: "Following", count: person.followingCount },
  ];

  return (
    <div className="cm cm-member">
      <section className="cm-member-hero gx-glass">
        <div className="cm-member-banner" aria-hidden="true" />
        <div className="cm-member-head">
          <Avatar id={person.id} name={person.name} size={96} />
          <div className="cm-member-id">
            <h1>{person.name}</h1>
            <p>{person.headline || "Stayblz member"}</p>
            <div className="cm-member-tags">
              {person.followsYou && <span className="cm-tag">Follows you</span>}
              {person.joinedAt && <span className="cm-tag is-muted">Joined {new Date(person.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>}
            </div>
          </div>
          <div className="cm-member-actions">
            {person.me ? (
              <Link className="cm-btn cm-btn-primary" to="/account/horses"><Icon.Horse /> Manage my horses</Link>
            ) : (
              <>
                <FollowButton
                  personId={person.id}
                  isFollowing={person.isFollowing}
                  onChange={(isFollowing, followers) => {
                    setPerson((p) => (p ? { ...p, isFollowing, followers } : p));
                    // Following can unlock followers-only horses and posts.
                    void community.person(person.id).then((r) => setPerson(r.person)).catch(() => undefined);
                  }}
                />
                <button type="button" className="cm-btn" onClick={message} disabled={messaging}>
                  <Icon.Comment /> {messaging ? "Opening…" : "Message"}
                </button>
              </>
            )}
          </div>
        </div>
        <dl className="cm-member-stats">
          <div><dt>Horses</dt><dd>{person.horses}</dd></div>
          <div><dt>Starts</dt><dd>{person.starts}</dd></div>
          <div><dt>Wins</dt><dd>{person.wins}</dd></div>
          <div className="is-money"><dt>Earnings</dt><dd className={person.earningsCents === null ? "is-hidden" : undefined}>{money(person.earningsCents)}</dd></div>
          <div><dt>Followers</dt><dd>{person.followers}</dd></div>
        </dl>
      </section>

      {error && <p className="cm-error" role="alert">{error}</p>}

      <nav className="cm-tabs" aria-label="Profile sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setParams(t.key === "horses" ? {} : { tab: t.key }, { replace: true })}>
            {t.label} <span className="cm-count">{t.count}</span>
          </button>
        ))}
      </nav>

      {tab === "horses" && <HorsesTab person={person} />}
      {tab === "posts" && (
        <PostsTab person={person} canPost={person.me} meUser={user ? { id: user.id, name: user.displayName, staff: canUse(user, "admin") } : null} />
      )}
      {(tab === "followers" || tab === "following") && <FollowTab key={tab} person={person} kind={tab} />}
    </div>
  );
}

function HorsesTab({ person }: { person: Person }) {
  const [horses, setHorses] = useState<Horse[] | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    community
      .personHorses(person.id)
      .then((r) => {
        if (!live) return;
        setHorses(r.horses);
        setRestricted(r.restricted);
      })
      .catch((e) => live && setError(errorText(e, "Horses couldn't be loaded.")));
    return () => {
      live = false;
    };
  }, [person.id, person.isFollowing]);
  if (error) return <p className="cm-error" role="alert">{error}</p>;
  if (!horses) return <Skeletons kind="card" count={3} />;
  return (
    <>
      {restricted && (
        <p className="cm-note"><Icon.Lock /> Some of {person.name.split(" ")[0]}'s horses are only shared with followers{person.isFollowing ? " or kept private" : ". Follow to see more"}.</p>
      )}
      {horses.length ? (
        <div className="cm-grid">
          {horses.map((h) => <HorseCard key={h.id} horse={h} />)}
        </div>
      ) : (
        <Empty icon={<Icon.Horse />} title={person.me ? "You haven't added any horses" : "No horses to show"}>
          {person.me ? <Link className="cm-btn cm-btn-primary" to="/account/horses?edit=new"><Icon.Plus /> Add a horse</Link> : <p>When {person.name.split(" ")[0]} shares horses, they'll appear here.</p>}
        </Empty>
      )}
    </>
  );
}

function PostsTab({ person, canPost, meUser }: { person: Person; canPost: boolean; meUser: { id: string; name: string; staff: boolean } | null }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myHorses, setMyHorses] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let live = true;
    community
      .personPosts(person.id)
      .then((r) => {
        if (!live) return;
        setPosts(r.posts);
        setNext(r.next);
      })
      .catch(() => live && setPosts([]));
    if (canPost) void community.personHorses(person.id).then((r) => live && setMyHorses(r.horses.map((h) => ({ id: h.id, name: h.name })))).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [person.id, canPost, person.isFollowing]);
  async function more() {
    if (!next || busy) return;
    setBusy(true);
    try {
      const r = await community.personPosts(person.id, next);
      setPosts((p) => [...(p ?? []), ...r.posts]);
      setNext(r.next);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cm-stack cm-narrow">
      {canPost && meUser && <Composer me={meUser} horses={myHorses} isStaff={meUser.staff} onPosted={(p) => setPosts((l) => [p, ...(l ?? [])])} />}
      {posts === null ? (
        <Skeletons count={2} />
      ) : posts.length ? (
        <>
          {posts.map((p) => <PostCard key={p.id} post={p} onRemoved={(id) => setPosts((l) => (l ?? []).filter((x) => x.id !== id))} />)}
          {next && <button type="button" className="cm-btn cm-more" onClick={more} disabled={busy}>{busy ? "Loading…" : "Show more"}</button>}
        </>
      ) : (
        <Empty icon={<Icon.Comment />} title="No posts yet" />
      )}
    </div>
  );
}

function FollowTab({ person, kind }: { person: Person; kind: "followers" | "following" }) {
  const [people, setPeople] = useState<PersonLite[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const load = (offset: number) =>
    (kind === "followers" ? community.followers(person.id, offset) : community.following(person.id, offset)).then((r) => {
      setPeople((p) => (offset ? [...(p ?? []), ...r.people] : r.people));
      setNext(r.nextOffset);
    });
  useEffect(() => {
    void load(0).catch(() => setPeople([]));
  }, [person.id, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!people) return <Skeletons count={2} />;
  if (!people.length)
    return <Empty icon={<Icon.Users />} title={kind === "followers" ? "No followers yet" : "Not following anyone yet"} />;
  return (
    <div className="cm-list gx-glass">
      {people.map((p) => (
        <div key={p.id} className="cm-list-row">
          <Link to={`/community/people/${p.id}`} className="cm-list-id">
            <Avatar id={p.id} name={p.name} size={40} />
            <span>
              <strong>{p.name}{p.me && " (you)"}</strong>
              <small>{p.headline || "Stayblz member"}</small>
            </span>
          </Link>
          {!p.me && <FollowButton personId={p.id} isFollowing={p.isFollowing} size="sm" />}
        </div>
      ))}
      {next !== null && <button type="button" className="cm-btn cm-more" onClick={() => void load(next)}>Show more</button>}
    </div>
  );
}
