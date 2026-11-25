import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  SEX_LABELS,
  SURFACE_LABELS,
  community,
  errorText,
  horseImageUrl,
  horseMediaPicture,
  money,
  ordinal,
  type HorseDetail,
  type Post,
} from "../components/community/api";
import AddToVirtualButton from "../components/virtual/AddToVirtualButton";
import RaceDataLink from "../components/community/RaceDataLink";
import { Avatar, Composer, Empty, FollowButton, Icon, PostCard, Skeletons, StatusBadge } from "../components/community/ui";
import { HorseViewer } from "../components/community/HorseShare";

/** /community/horses/:id — one horse's profile: photos, details, race history and posts. */
export default function HorseProfile() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [horse, setHorse] = useState<HorseDetail | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<string | null>(null);
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

  // Owners are listed for everyone; shares stay private to the owners (not shown here).
  const coOwners = (horse.owners ?? []).filter((o) => !o.lead && (o.status ?? "accepted") === "accepted");
  const urls = horse.images.map((i) => horseImageUrl(i.id));
  const current = horse.images[active];
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
          {current?.kind === "video" ? (
            <div className="cm-gallery-main is-video">
              <video key={current.id} src={urls[active]} poster={horseMediaPicture(current) ?? undefined} controls playsInline preload="metadata" />
              {urls.length > 1 && <span className="cm-photo-count"><Icon.Photo /> {active + 1} / {urls.length}</span>}
            </div>
          ) : (
            <button type="button" className="cm-gallery-main" onClick={() => current && setViewer(current.id)} disabled={!current} aria-label="Open photo viewer">
              {current ? <img src={urls[active]} alt={`${horse.name}`} /> : <span className="cm-horse-placeholder is-large"><Icon.Horse /></span>}
              {urls.length > 1 && <span className="cm-photo-count"><Icon.Photo /> {active + 1} / {urls.length}</span>}
            </button>
          )}
          {urls.length > 1 && (
            <div className="cm-thumbs" role="list">
              {horse.images.map((img, i) => (
                <button key={img.id} type="button" role="listitem" className={`${i === active ? "is-active" : ""}${img.kind === "video" ? " is-video" : ""}`.trim() || undefined} onClick={() => setActive(i)} aria-label={`Show ${img.kind === "video" ? "video" : "photo"} ${i + 1}`}>
                  {horseMediaPicture(img) ? <img src={horseMediaPicture(img)!} alt="" loading="lazy" /> : <span className="cm-hshare-blank" />}
                  {img.kind === "video" && <span className="cm-hv-thumb-play" aria-hidden="true"><Icon.Play /></span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="cm-horse-identity">
          <div className="cm-horse-identity-top">
            <StatusBadge status={horse.status} />
            {horse.mine && (
              <Link className="cm-btn cm-btn-sm" to={`/account/horses?edit=${horse.id}${horse.pendingChanges ? "&tab=owners" : ""}`}>
                <Icon.Edit /> {horse.pendingChanges ? `Edit horse · ${horse.pendingChanges} to approve` : "Edit horse"}
              </Link>
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
                <small>{coOwners.length ? "Lead owner" : "Owned by"}</small>
                <strong>{horse.owner.name}{horse.owner.me && " (you)"}</strong>
              </span>
            </Link>
            {!horse.owner.me && <FollowButton personId={horse.owner.id} isFollowing={horse.owner.isFollowing} size="sm" />}
          </div>
          {coOwners.length > 0 && (
            <ul className="cm-coowners" aria-label="Co-owners">
              {coOwners.map((o) => (
                <li key={o.id}>
                  <Link to={`/community/people/${o.id}`} className="cm-owner-id">
                    <Avatar id={o.id} name={o.name} size={32} />
                    <span>
                      <small>Co-owner</small>
                      <strong>{o.name}{o.me && " (you)"}</strong>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!horse.mine && <AddToVirtualButton target={{ communityHorseId: horse.id }} name={horse.name} />}
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
                        <th scope="row">
                          {r.raceName || "—"}
                          {r.fromRaceData && <em className="cm-race-data-tag">Race data</em>}
                          {r.notes && <small>{r.notes}</small>}
                        </th>
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

          <RaceDataLink horse={horse} onChange={(h) => setHorse((cur) => (cur ? { ...cur, ...h } : h))} />

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

      {viewer !== null && <HorseViewer horseId={horse.id} name={horse.name} initial={[]} startId={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
