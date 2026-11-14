import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useConfirm } from "../ui/Confirm";
import AvatarFace from "../account/AvatarFace";
import {
  STATUS_LABELS,
  community,
  errorText,
  horseImageUrl,
  money,
  ordinal,
  postImageUrl,
  timeAgo,
  uploadPostImage,
  type Comment,
  type Horse,
  type HorseStatus,
  type Person,
  type Post,
  type Surface,
} from "./api";
import "./community-glass.css";

/* ============================== Icons ============================== */
const I = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
export const Icon = {
  Heart: ({ filled }: { filled?: boolean }) => (
    <svg {...I} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 4.5 6.6 4.5c2.1 0 3.4 1.2 4.4 2.6 1-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.8 3.8 6.9C19 15.6 12 20 12 20z" /></svg>
  ),
  Comment: () => (<svg {...I}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>),
  Share: () => (<svg {...I}><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" /></svg>),
  Photo: () => (<svg {...I}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>),
  Horse: () => (<svg {...I}><path d="M4 20c0-6 2-10 7-12l3-4 1 3c3 1 5 4 5 7l-3 1-2-2-1 7" /><circle cx="15.5" cy="8.5" r=".6" fill="currentColor" /></svg>),
  Trophy: () => (<svg {...I}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></svg>),
  Flag: () => (<svg {...I}><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg>),
  Mega: () => (<svg {...I}><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M16 8.5a5 5 0 0 1 0 7" /></svg>),
  Plus: () => (<svg {...I}><path d="M12 5v14M5 12h14" /></svg>),
  Close: () => (<svg {...I} width={14} height={14}><path d="M18 6 6 18M6 6l12 12" /></svg>),
  More: () => (<svg {...I}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>),
  Arrow: () => (<svg {...I} width={14} height={14}><path d="M7 17 17 7M8 7h9v9" /></svg>),
  Left: () => (<svg {...I}><path d="M15 18l-6-6 6-6" /></svg>),
  Right: () => (<svg {...I}><path d="M9 18l6-6-6-6" /></svg>),
  Lock: () => (<svg {...I} width={14} height={14}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
  Users: () => (<svg {...I}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>),
  Search: () => (<svg {...I}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  Send: () => (<svg {...I}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>),
  Edit: () => (<svg {...I} width={14} height={14}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>),
  Trash: () => (<svg {...I} width={14} height={14}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>),
  Globe: () => (<svg {...I} width={14} height={14}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>),
};

/* ============================== Small pieces ============================== */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";

/** Profile picture, or coloured initials; the hue comes from the id so each member keeps the same colour. */
export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <span
      className="cm-avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, ["--cm-hue" as string]: String(hue) }}
      aria-hidden="true"
    >
      <AvatarFace id={id}>{initials(name)}</AvatarFace>
    </span>
  );
}

export function StatusBadge({ status }: { status: HorseStatus }) {
  return <span className={`cm-status is-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="cm-empty">
      {icon && <span className="cm-empty-icon">{icon}</span>}
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Skeletons({ count = 3, kind = "post" }: { count?: number; kind?: "post" | "card" }) {
  return (
    <div className={kind === "card" ? "cm-grid" : "cm-stack"} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`cm-skeleton gx-glass is-${kind}`}>
          <span className="cm-sk cm-sk-a" />
          <span className="cm-sk cm-sk-b" />
          <span className="cm-sk cm-sk-c" />
        </div>
      ))}
    </div>
  );
}

export function FollowButton({
  personId,
  isFollowing,
  onChange,
  size = "md",
}: {
  personId: string;
  isFollowing: boolean;
  onChange?: (following: boolean, followers: number) => void;
  size?: "sm" | "md";
}) {
  const [on, setOn] = useState(isFollowing);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => setOn(isFollowing), [isFollowing]);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next);
    try {
      const r = await community.follow(personId, next);
      setOn(r.isFollowing);
      onChange?.(r.isFollowing, r.followers);
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className={`cm-btn cm-follow${on ? " is-on" : " cm-btn-primary"}${size === "sm" ? " cm-btn-sm" : ""}`}
      aria-pressed={on}
      disabled={busy}
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {on ? (hover ? "Unfollow" : "Following") : "Follow"}
    </button>
  );
}

/* ============================== Horse card ============================== */

export function HorseCard({ horse, showOwnerTools, onEdit }: { horse: Horse; showOwnerTools?: boolean; onEdit?: () => void }) {
  const age = horse.foaledYear ? `${new Date().getFullYear() - horse.foaledYear} yrs` : null;
  return (
    <article className="cm-horse gx-glass">
      <Link to={`/community/horses/${horse.id}`} className="cm-horse-media" aria-label={`Open ${horse.name}'s profile`}>
        {horse.coverImageId ? (
          <img src={horseImageUrl(horse.coverImageId)} alt="" loading="lazy" />
        ) : (
          <span className="cm-horse-placeholder" aria-hidden="true"><Icon.Horse /></span>
        )}
        <StatusBadge status={horse.status} />
        {!!horse.imageCount && horse.imageCount > 1 && (
          <span className="cm-photo-count" aria-label={`${horse.imageCount} photos`}><Icon.Photo /> {horse.imageCount}</span>
        )}
        {showOwnerTools && horse.visibility && horse.visibility !== "inherit" && horse.visibility !== "members" && (
          <span className="cm-private-chip"><Icon.Lock /> {horse.visibility === "private" ? "Only you" : "Followers"}</span>
        )}
      </Link>
      <div className="cm-horse-body">
        <div className="cm-horse-title">
          <h3><Link to={`/community/horses/${horse.id}`}>{horse.name}</Link></h3>
          {showOwnerTools && onEdit && (
            <button type="button" className="cm-icon-btn" onClick={onEdit} aria-label={`Edit ${horse.name}`} title="Edit">
              <Icon.Edit />
            </button>
          )}
        </div>
        <p className="cm-horse-meta">{[horse.breed, age, horse.color].filter(Boolean).join(" · ") || "Details not added yet"}</p>
        <dl className="cm-horse-stats">
          <div><dt>Starts</dt><dd>{horse.stats.starts}</dd></div>
          <div><dt>Wins</dt><dd>{horse.stats.wins}</dd></div>
          <div><dt>Earnings</dt><dd className={horse.stats.earningsCents === null ? "is-hidden" : undefined}>{money(horse.stats.earningsCents, true)}</dd></div>
        </dl>
      </div>
    </article>
  );
}

/* ============================== Member card ============================== */

export function PersonCard({ person, onFollow }: { person: Person; onFollow?: (p: Person) => void }) {
  return (
    <article className="cm-person gx-glass">
      <Link to={`/community/people/${person.id}`} className="cm-person-id">
        <Avatar id={person.id} name={person.name} size={52} />
        <span>
          <strong>{person.name}{person.me && <em> (you)</em>}</strong>
          <small>{person.headline || (person.followsYou ? "Follows you" : "Stayblz member")}</small>
        </span>
      </Link>
      <dl className="cm-person-stats">
        <div><dt>Horses</dt><dd>{person.horses}</dd></div>
        <div><dt>Wins</dt><dd>{person.wins}</dd></div>
        <div><dt>Earnings</dt><dd className={person.earningsCents === null ? "is-hidden" : undefined}>{money(person.earningsCents, true)}</dd></div>
        <div><dt>Followers</dt><dd>{person.followers}</dd></div>
      </dl>
      <div className="cm-person-actions">
        {person.me ? (
          <Link className="cm-btn cm-btn-sm" to="/account/horses">Manage my horses</Link>
        ) : (
          <FollowButton
            personId={person.id}
            isFollowing={person.isFollowing}
            size="sm"
            onChange={(isFollowing, followers) => onFollow?.({ ...person, isFollowing, followers })}
          />
        )}
        <Link className="cm-btn cm-btn-sm cm-btn-ghost" to={`/community/people/${person.id}`}>View profile <Icon.Arrow /></Link>
      </div>
    </article>
  );
}

/* ============================== Photo viewer ============================== */

export function Lightbox({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % urls.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + urls.length) % urls.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, urls.length]);
  return (
    <div className="cm-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button type="button" className="cm-lightbox-scrim" tabIndex={-1} aria-label="Close" onClick={onClose} />
      <img src={urls[index]} alt="" />
      <button ref={closeRef} type="button" className="cm-icon-btn cm-lightbox-close" onClick={onClose} aria-label="Close photo viewer"><Icon.Close /></button>
      {urls.length > 1 && (
        <>
          <button type="button" className="cm-icon-btn cm-lightbox-prev" onClick={() => setIndex((i) => (i - 1 + urls.length) % urls.length)} aria-label="Previous photo"><Icon.Left /></button>
          <button type="button" className="cm-icon-btn cm-lightbox-next" onClick={() => setIndex((i) => (i + 1) % urls.length)} aria-label="Next photo"><Icon.Right /></button>
          <span className="cm-lightbox-count">{index + 1} / {urls.length}</span>
        </>
      )}
    </div>
  );
}

/* ============================== Post card ============================== */

const KIND_LABEL: Record<Post["kind"], { label: string; icon: ReactNode } | null> = {
  update: null,
  horse_update: { label: "Horse update", icon: <Icon.Horse /> },
  new_horse: { label: "New horse", icon: <Icon.Plus /> },
  result: { label: "Race result", icon: <Icon.Flag /> },
  achievement: { label: "Winner", icon: <Icon.Trophy /> },
  announcement: { label: "Announcement", icon: <Icon.Mega /> },
};

const surfaceText = (s: Surface) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export function PostCard({ post, onChange, onRemoved }: { post: Post; onChange?: (p: Post) => void; onRemoved?: (id: string) => void }) {
  const confirm = useConfirm();
  const [p, setP] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [viewer, setViewer] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setP(post), [post]);
  const update = (next: Post) => {
    setP(next);
    onChange?.(next);
  };
  const kind = KIND_LABEL[p.kind];

  async function like() {
    const on = !p.liked;
    const optimistic = { ...p, liked: on, likes: p.likes + (on ? 1 : -1) };
    setP(optimistic);
    try {
      const r = await community.like(p.id, on);
      update({ ...optimistic, liked: r.liked, likes: r.likes });
    } catch {
      setP(p);
    }
  }
  async function share() {
    const url = `${window.location.origin}/community/posts/${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${p.author.name} on Stayblz`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled */
    }
  }
  async function remove() {
    setMenu(false);
    const sure = await confirm({
      title: "Remove this post?",
      message: "It's removed for everyone, with its photos, likes and comments. This can't be undone.",
      confirmLabel: "Remove post",
      cancelLabel: "Keep post",
      tone: "danger",
    });
    if (!sure) return;
    try {
      await community.removePost(p.id);
      onRemoved?.(p.id);
    } catch (e) {
      setError(errorText(e, "The post couldn't be removed."));
    }
  }
  async function saveEdit() {
    try {
      const r = await community.editPost(p.id, draft);
      if (r.post) update(r.post);
      setEditing(false);
      setError("");
    } catch (e) {
      setError(errorText(e, "Your changes couldn't be saved."));
    }
  }

  const urls = p.images.map((i) => postImageUrl(i.id));
  return (
    <article className={`cm-post gx-glass${p.kind === "announcement" ? " is-announcement" : ""}${p.kind === "achievement" ? " is-achievement" : ""}`}>
      <header className="cm-post-head">
        <Link to={`/community/people/${p.author.id}`} className="cm-post-author">
          <Avatar id={p.author.id} name={p.author.name} size={42} />
          <span>
            <strong>{p.author.name}</strong>
            <small>
              {p.author.headline && <>{p.author.headline} · </>}
              <time dateTime={p.createdAt} title={new Date(p.createdAt).toLocaleString()}>{timeAgo(p.createdAt)}</time>
              {p.editedAt && " · edited"}
              {p.visibility === "followers" && <> · <Icon.Lock /> Followers</>}
            </small>
          </span>
        </Link>
        {kind && <span className={`cm-kind is-${p.kind}`}>{kind.icon} {kind.label}</span>}
        {p.mine && (
          <div className="cm-menu">
            <button type="button" className="cm-icon-btn" aria-label="Post options" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Icon.More /></button>
            {menu && (
              <div className="cm-menu-list gx-glass" role="menu">
                <button type="button" role="menuitem" onClick={() => { setEditing(true); setMenu(false); setDraft(p.body); }}><Icon.Edit /> Edit text</button>
                <button type="button" role="menuitem" className="is-danger" onClick={remove}><Icon.Trash /> Remove post</button>
              </div>
            )}
          </div>
        )}
      </header>

      {editing ? (
        <div className="cm-edit">
          <textarea value={draft} maxLength={2000} rows={3} onChange={(e) => setDraft(e.target.value)} aria-label="Edit post" />
          <div className="cm-row-end">
            <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="cm-btn cm-btn-sm cm-btn-primary" onClick={saveEdit}>Save</button>
          </div>
        </div>
      ) : (
        p.body && <p className="cm-post-body">{p.body}</p>
      )}

      {p.result && (
        <div className={`cm-result${p.result.finish === 1 ? " is-win" : ""}`}>
          <span className="cm-result-pos">{p.result.finish ? ordinal(p.result.finish) : "DNF"}</span>
          <span className="cm-result-text">
            <strong>{p.result.raceName || "Race"}</strong>
            <small>
              {[p.result.track, new Date(`${p.result.raceDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), p.result.distance, surfaceText(p.result.surface)]
                .filter(Boolean)
                .join(" · ")}
              {p.result.fieldSize ? ` · ${p.result.fieldSize} runners` : ""}
            </small>
          </span>
          {p.result.earningsCents !== undefined && p.result.earningsCents > 0 && <span className="cm-result-money">{money(p.result.earningsCents)}</span>}
        </div>
      )}

      {urls.length > 0 && (
        <div className={`cm-photos is-${Math.min(urls.length, 4)}`}>
          {urls.map((u, i) => (
            <button type="button" key={u} onClick={() => setViewer(i)} aria-label={`Open photo ${i + 1} of ${urls.length}`}>
              <img src={u} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {p.horse && (
        <Link to={`/community/horses/${p.horse.id}`} className="cm-horse-chip">
          {p.horse.coverImageId ? <img src={horseImageUrl(p.horse.coverImageId)} alt="" /> : <span className="cm-horse-chip-icon"><Icon.Horse /></span>}
          <span>
            <strong>{p.horse.name}</strong>
            <small>{[p.horse.breed, STATUS_LABELS[p.horse.status]].filter(Boolean).join(" · ")}</small>
          </span>
          <Icon.Arrow />
        </Link>
      )}

      {error && <p className="cm-error" role="alert">{error}</p>}

      <footer className="cm-post-actions">
        <button type="button" className={`cm-action${p.liked ? " is-liked" : ""}`} aria-pressed={p.liked} onClick={like}>
          <Icon.Heart filled={p.liked} /> <span>{p.likes || ""}</span><span className="cm-sr">{p.liked ? "Unlike" : "Like"}</span>
        </button>
        <button type="button" className="cm-action" aria-expanded={showComments} onClick={() => setShowComments((v) => !v)}>
          <Icon.Comment /> <span>{p.comments || ""}</span><span className="cm-sr">Comments</span>
        </button>
        <button type="button" className="cm-action" onClick={share}>
          <Icon.Share /><span className="cm-sr">Share</span>
        </button>
      </footer>

      {showComments && <Comments postId={p.id} onCount={(n) => update({ ...p, comments: n })} />}
      {viewer !== null && <Lightbox urls={urls} start={viewer} onClose={() => setViewer(null)} />}
    </article>
  );
}

function Comments({ postId, onCount }: { postId: string; onCount: (n: number) => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    community
      .comments(postId)
      .then((r) => live && setList(r.comments))
      .catch((e) => live && setError(errorText(e, "Comments couldn't be loaded.")));
    return () => {
      live = false;
    };
  }, [postId]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await community.addComment(postId, text);
      const next = [...(list ?? []), r.comment];
      setList(next);
      onCount(next.length);
      setText("");
      setError("");
    } catch (err) {
      setError(errorText(err, "Your comment couldn't be posted."));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await community.removeComment(id);
      const next = (list ?? []).filter((c) => c.id !== id);
      setList(next);
      onCount(next.length);
    } catch (err) {
      setError(errorText(err, "That comment couldn't be removed."));
    }
  }
  return (
    <section className="cm-comments" aria-label="Comments">
      {list === null && !error && <p className="cm-muted">Loading comments…</p>}
      {list?.length === 0 && <p className="cm-muted">No comments yet. Start the conversation.</p>}
      {list?.map((c) => (
        <div key={c.id} className="cm-comment">
          <Avatar id={c.author.id} name={c.author.name} size={30} />
          <div className="cm-comment-bubble">
            <Link to={`/community/people/${c.author.id}`}>{c.author.name}</Link>
            <p>{c.body}</p>
            <small>
              {timeAgo(c.createdAt)}
              {c.canRemove && (
                <button type="button" onClick={() => remove(c.id)}>Remove</button>
              )}
            </small>
          </div>
        </div>
      ))}
      {error && <p className="cm-error" role="alert">{error}</p>}
      <form className="cm-comment-form" onSubmit={send}>
        <input value={text} maxLength={1000} placeholder="Write a comment…" aria-label="Write a comment" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="cm-icon-btn cm-send" disabled={!text.trim() || busy} aria-label="Post comment"><Icon.Send /></button>
      </form>
    </section>
  );
}

/* ============================== Composer ============================== */

type Pending = { key: string; file: File; preview: string; id?: string; error?: string };

export function Composer({
  me,
  horses,
  isStaff,
  presetHorseId,
  onPosted,
}: {
  me: { id: string; name: string };
  horses: { id: string; name: string }[];
  isStaff?: boolean;
  presetHorseId?: string;
  onPosted: (post: Post) => void;
}) {
  const [body, setBody] = useState("");
  const [horseId, setHorseId] = useState(presetHorseId ?? "");
  const [audience, setAudience] = useState<"members" | "followers">("members");
  const [announcement, setAnnouncement] = useState(false);
  const [photos, setPhotos] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = 4 - photos.length;
    const chosen = [...files].slice(0, room);
    if (files.length > room) setError("You can add up to 4 photos to a post.");
    const added: Pending[] = chosen.map((file) => ({ key: `${file.name}-${Math.random()}`, file, preview: URL.createObjectURL(file) }));
    setPhotos((list) => [...list, ...added]);
    setOpen(true);
    for (const item of added) {
      try {
        const r = await uploadPostImage(item.file);
        setPhotos((list) => list.map((p) => (p.key === item.key ? { ...p, id: r.image.id } : p)));
      } catch (e) {
        setPhotos((list) => list.map((p) => (p.key === item.key ? { ...p, error: errorText(e, "Upload failed") } : p)));
      }
    }
  }
  function removePhoto(key: string) {
    const item = photos.find((p) => p.key === key);
    if (item?.id) void community.removeUpload(item.id).catch(() => undefined);
    if (item) URL.revokeObjectURL(item.preview);
    setPhotos((list) => list.filter((p) => p.key !== key));
  }
  const uploading = photos.some((p) => !p.id && !p.error);
  const ready = photos.filter((p) => p.id).map((p) => p.id!) as string[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || uploading || (!body.trim() && !ready.length)) return;
    setBusy(true);
    setError("");
    try {
      const r = await community.createPost({
        body,
        kind: announcement ? "announcement" : "update",
        horseId: horseId || null,
        visibility: audience,
        imageIds: ready,
      });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setBody("");
      setPhotos([]);
      setAnnouncement(false);
      if (!presetHorseId) setHorseId("");
      setOpen(false);
      if (r.post) onPosted(r.post);
    } catch (err) {
      setError(errorText(err, "Your post couldn't be published."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`cm-composer gx-glass${open ? " is-open" : ""}`} onSubmit={submit}>
      <div className="cm-composer-main">
        <Avatar id={me.id} name={me.name} size={42} />
        <textarea
          value={body}
          maxLength={2000}
          rows={open ? 3 : 1}
          placeholder={horses.length ? "Share a horse update…" : "Share an update…"}
          aria-label="Write a post"
          onFocus={() => setOpen(true)}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {photos.length > 0 && (
        <div className="cm-pending">
          {photos.map((p) => (
            <figure key={p.key} className={p.error ? "is-error" : !p.id ? "is-uploading" : undefined}>
              <img src={p.preview} alt="" />
              {!p.id && !p.error && <span className="cm-spinner" aria-label="Uploading" />}
              {p.error && <figcaption>{p.error}</figcaption>}
              <button type="button" className="cm-icon-btn" aria-label="Remove photo" onClick={() => removePhoto(p.key)}><Icon.Close /></button>
            </figure>
          ))}
        </div>
      )}
      {error && <p className="cm-error" role="alert">{error}</p>}
      {(open || photos.length > 0) && (
        <div className="cm-composer-bar">
          <div className="cm-composer-tools">
            <button type="button" className="cm-tool" onClick={() => fileRef.current?.click()} disabled={photos.length >= 4}>
              <Icon.Photo /> <span>Photo</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            {horses.length > 0 && !presetHorseId && (
              <label className="cm-tool cm-tool-select">
                <Icon.Horse />
                <select value={horseId} onChange={(e) => setHorseId(e.target.value)} aria-label="Tag one of your horses">
                  <option value="">Tag a horse</option>
                  {horses.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="cm-tool cm-tool-select">
              <Icon.Globe />
              <select value={audience} onChange={(e) => setAudience(e.target.value as "members" | "followers")} aria-label="Who can see this post">
                <option value="members">Everyone</option>
                <option value="followers">Followers</option>
              </select>
            </label>
            {isStaff && (
              <label className="cm-tool cm-check">
                <input type="checkbox" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} /> Announcement
              </label>
            )}
          </div>
          <button type="submit" className="cm-btn cm-btn-primary" disabled={busy || uploading || (!body.trim() && !ready.length)}>
            {busy ? "Posting…" : uploading ? "Uploading…" : "Post"}
          </button>
        </div>
      )}
    </form>
  );
}
