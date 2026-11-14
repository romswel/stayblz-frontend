import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  SEX_LABELS,
  SURFACE_LABELS,
  community,
  errorText,
  horseImageUrl,
  money,
  ordinal,
  type HorseDetail,
  type Post,
} from "../components/community/api";
import { Avatar, Composer, Empty, FollowButton, Icon, Lightbox, PostCard, Skeletons, StatusBadge } from "../components/community/ui";

/** /community/horses/:id — one horse's profile: photos, details, race history and posts. */
export default function HorseProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [horse, setHorse] = useState<HorseDetail | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let live = true;
    setHorse(null);
    setPosts(null);
    setError("");
    setActive(0);
    community
      .horse(id)
      .then((r) => {
        if (!live) return;
        setHorse(r.horse);
        const cover = r.horse.images.findIndex((i) => i.id === r.horse.coverImageId);
        setActive(cover > 0 ? cover : 0);
      })
      .catch((e) => live && setError(errorText(e, "This horse isn't available.")));
    community
      .horsePosts(id)
      .then((r) => {
        if (!live) return;
        setPosts(r.posts);
        setNext(r.next);
      })
      .catch(() => live && setPosts([]));
    return () => {
      live = false;
    };
  }, [id]);

  async function more() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await community.horsePosts(id, next);
      setPosts((p) => [...(p ?? []), ...r.posts]);
      setNext(r.next);
    } finally {
      setLoadingMore(false);
    }
  }

  if (error)
    return (
      <div className="cm">
        <Empty icon={<Icon.Lock />} title="This horse isn't available">
          <p>It may be private, shared only with the owner's followers, or removed.</p>
          <Link className="cm-btn" to="/community">Back to Feeds</Link>
        </Empty>
      </div>
    );
  if (!horse)
    return (
      <div className="cm">
        <Skeletons count={2} />
      </div>
    );

  const urls = horse.images.map((i) => horseImageUrl(i.id));
  const age = horse.foaledYear ? new Date().getFullYear() - horse.foaledYear : null;
  const winRate = horse.stats.starts ? Math.round((horse.stats.wins / horse.stats.starts) * 100) : 0;
  const itm = horse.stats.starts ? Math.round(((horse.stats.wins + horse.stats.places + horse.stats.shows) / horse.stats.starts) * 100) : 0;
  const facts: [string, string][] = [
    ["Breed", horse.breed],
    ["Sex", horse.sex ? SEX_LABELS[horse.sex] : ""],
    ["Age", age !== null ? `${age} (foaled ${horse.foaledYear})` : ""],
    ["Colour", horse.color],
    ["Sire", horse.sire],
    ["Dam", horse.dam],
    ["Trainer", horse.trainer],
    ["Location", horse.location],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="cm cm-horse-page">
      {/* ---------- Hero: gallery + identity ---------- */}
      <section className="cm-horse-hero gx-glass">
        <div className="cm-gallery">
          <button type="button" className="cm-gallery-main" onClick={() => urls.length && setViewer(active)} disabled={!urls.length} aria-label="Open photo viewer">
            {urls.length ? <img src={urls[active]} alt={`${horse.name}`} /> : <span className="cm-horse-placeholder is-large"><Icon.Horse /></span>}
            {urls.length > 1 && <span className="cm-photo-count"><Icon.Photo /> {active + 1} / {urls.length}</span>}
          </button>
          {urls.length > 1 && (
            <div className="cm-thumbs" role="list">
              {horse.images.map((img, i) => (
                <button key={img.id} type="button" role="listitem" className={i === active ? "is-active" : undefined} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`}>
                  <img src={urls[i]} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="cm-horse-identity">
          <div className="cm-horse-identity-top">
            <StatusBadge status={horse.status} />
            {horse.mine && (
              <Link className="cm-btn cm-btn-sm" to={`/account/horses?edit=${horse.id}`}><Icon.Edit /> Edit horse</Link>
            )}
          </div>
          <h1>{horse.name}</h1>
          <p className="cm-horse-sub">{[horse.breed, age !== null ? `${age} yrs` : "", horse.sex ? SEX_LABELS[horse.sex] : ""].filter(Boolean).join(" · ")}</p>
          <dl className="cm-big-stats">
            <div><dt>Starts</dt><dd>{horse.stats.starts}</dd></div>
            <div><dt>Record</dt><dd>{horse.stats.wins}-{horse.stats.places}-{horse.stats.shows}</dd></div>
            <div><dt>Win rate</dt><dd>{winRate}%</dd></div>
            <div className="is-wide"><dt>Earnings</dt><dd className={horse.stats.earningsCents === null ? "is-hidden" : undefined}>{money(horse.stats.earningsCents)}</dd></div>
          </dl>
          {horse.stats.starts > 0 && (
            <div className="cm-itm" aria-label={`In the money ${itm}% of starts`}>
              <span>In the money</span>
              <span className="cm-meter"><span style={{ width: `${itm}%` }} /></span>
              <strong>{itm}%</strong>
            </div>
          )}
          <div className="cm-owner">
            <Link to={`/community/people/${horse.owner.id}`} className="cm-owner-id">
              <Avatar id={horse.owner.id} name={horse.owner.name} size={40} />
              <span>
                <small>Owned by</small>
                <strong>{horse.owner.name}{horse.owner.me && " (you)"}</strong>
              </span>
            </Link>
            {!horse.owner.me && <FollowButton personId={horse.owner.id} isFollowing={horse.owner.isFollowing} size="sm" />}
          </div>
        </div>
      </section>

      <div className="cm-horse-layout">
        <div className="cm-horse-main">
          {horse.description && (
            <section className="cm-card gx-glass">
              <h2>About {horse.name}</h2>
              <p className="cm-prose">{horse.description}</p>
            </section>
          )}

          <section className="cm-card gx-glass" aria-labelledby="cm-history">
            <div className="cm-card-head">
              <h2 id="cm-history">Performance history</h2>
              {horse.stats.lastRace && <small className="cm-muted">Last raced {new Date(`${horse.stats.lastRace}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small>}
            </div>
            {horse.records.length ? (
              <div className="cm-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Race</th>
                      <th scope="col">Track</th>
                      <th scope="col">Dist.</th>
                      <th scope="col">Surface</th>
                      <th scope="col">Finish</th>
                      <th scope="col" className="is-num">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horse.records.map((r) => (
                      <tr key={r.id}>
                        <td className="is-mono">{new Date(`${r.raceDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}</td>
                        <th scope="row">{r.raceName || "—"}{r.notes && <small>{r.notes}</small>}</th>
                        <td>{r.track}</td>
                        <td>{r.distance || "—"}</td>
                        <td>{SURFACE_LABELS[r.surface]}</td>
                        <td>
                          <span className={`cm-pos${r.finish === 1 ? " is-win" : r.finish && r.finish <= 3 ? " is-place" : ""}`}>{r.finish ? ordinal(r.finish) : "—"}</span>
                          {r.fieldSize ? <small className="cm-muted"> of {r.fieldSize}</small> : null}
                        </td>
                        <td className="is-num is-mono">{r.earningsCents === null ? "—" : money(r.earningsCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cm-muted">
                No races recorded yet.
                {horse.mine && <> <Link to={`/account/horses?edit=${horse.id}&tab=records`}>Add a race</Link></>}
              </p>
            )}
          </section>

          <section className="cm-stack" aria-labelledby="cm-horse-posts">
            <h2 id="cm-horse-posts" className="cm-section-title">Updates about {horse.name}</h2>
            {horse.mine && user && (
              <Composer
                me={{ id: user.id, name: user.displayName }}
                horses={[{ id: horse.id, name: horse.name }]}
                presetHorseId={horse.id}
                onPosted={(p) => setPosts((list) => [p, ...(list ?? [])])}
              />
            )}
            {posts === null ? (
              <Skeletons count={1} />
            ) : posts.length ? (
              <>
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} onRemoved={(pid) => setPosts((l) => (l ?? []).filter((x) => x.id !== pid))} />
                ))}
                {next && (
                  <button type="button" className="cm-btn cm-more" onClick={more} disabled={loadingMore}>{loadingMore ? "Loading…" : "Show more"}</button>
                )}
              </>
            ) : (
              <p className="cm-muted">No posts about {horse.name} yet.</p>
            )}
          </section>
        </div>

        <aside className="cm-horse-side">
          {facts.length > 0 && (
            <section className="cm-card gx-glass">
              <h2>Details</h2>
              <dl className="cm-facts">
                {facts.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>
          )}
        </aside>
      </div>

      {viewer !== null && <Lightbox urls={urls} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
