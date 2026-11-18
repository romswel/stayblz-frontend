import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import Modal from "../Modal";
import { PlayIcon } from "../marketplace/ListingMedia";
import {
  SEX_LABELS,
  community,
  errorText,
  horseImageUrl,
  horseMediaPicture,
  money,
  ordinal,
  type HorseDetail,
  type HorseMedia,
  type Post,
} from "./api";
import { Avatar, FollowButton, Icon, StatusBadge } from "./ui";

type SharedHorse = NonNullable<Post["horse"]>;

/**
 * Pop-ups opened from inside a glass card go straight under <body>: a card's backdrop-filter would
 * otherwise trap the fixed overlay inside the card. The dialog adds `gx-layer` to keep the theme colours.
 */
export function TopLayer({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
type Item = { id: string; kind: "photo" | "video"; hasPoster: boolean };

/** The main picture first, then the owner's order (the same order the Feed uses). */
function mainFirst(images: HorseDetail["images"], coverId: string | null): Item[] {
  const list = images.map((i) => ({ id: i.id, kind: i.kind ?? "photo", hasPoster: !!i.hasPoster }));
  const at = list.findIndex((i) => i.id === coverId);
  return at > 0 ? [list[at], ...list.slice(0, at), ...list.slice(at + 1)] : list;
}

/** Feed rows saved before horse media existed carry only the cover. */
function feedMedia(horse: SharedHorse): HorseMedia[] {
  if (horse.media) return horse.media;
  return horse.coverImageId ? [{ id: horse.coverImageId, kind: "photo", width: null, height: null, hasPoster: false }] : [];
}

function Tile({ item, label, onOpen, more }: { item: Item; label: string; onOpen: () => void; more?: number }) {
  const picture = horseMediaPicture(item);
  return (
    <button type="button" className={`cm-hshare-tile${item.kind === "video" ? " is-video" : ""}`} onClick={onOpen} aria-label={label}>
      {picture ? <img src={picture} alt="" loading="lazy" /> : <span className="cm-hshare-blank" aria-hidden="true" />}
      {item.kind === "video" && (
        <span className="cm-hshare-play" aria-hidden="true">
          <PlayIcon size={18} />
        </span>
      )}
      {!!more && more > 0 && <span className="cm-hshare-more" aria-hidden="true">+{more}</span>}
    </button>
  );
}

/**
 * A shared horse in the Feed: name and breed, then one large picture with smaller ones below it
 * (videos show their poster and a play mark; "+N" when there are more). Clicking any of them, the
 * name or the breed opens the horse viewer; that is the only way into the horse's details here.
 */
export function HorseShareBlock({ horse }: { horse: SharedHorse }) {
  const [open, setOpen] = useState<string | null>(null);
  const media = feedMedia(horse);
  const total = Math.max(horse.mediaCount ?? media.length, media.length);
  const [main, ...rest] = media;
  const extra = total - media.length;
  const first = main?.id ?? "";
  return (
    <section className="cm-hshare" aria-label={`Shared horse: ${horse.name}`}>
      <div className="cm-hshare-head">
        <h3>
          <button type="button" className="cm-hshare-name" onClick={() => setOpen(first)}>
            {horse.name}
          </button>
        </h3>
        {horse.breed && (
          <button type="button" className="cm-hshare-breed" onClick={() => setOpen(first)}>
            {horse.breed}
          </button>
        )}
      </div>
      {main ? (
        <div className="cm-hshare-grid">
          <div className="cm-hshare-main">
            <Tile item={main} label={`Open ${horse.name}: ${main.kind === "video" ? "video" : "photo"} 1 of ${total}`} onOpen={() => setOpen(main.id)} />
          </div>
          {rest.length > 0 && (
            <div className={`cm-hshare-thumbs is-${rest.length}`}>
              {rest.map((m, i) => {
                const last = i === rest.length - 1;
                return (
                  <Tile
                    key={m.id}
                    item={m}
                    more={last ? extra : 0}
                    label={last && extra > 0 ? `Open ${horse.name}: ${extra} more photos and videos` : `Open ${horse.name}: ${m.kind === "video" ? "video" : "photo"} ${i + 2} of ${total}`}
                    onOpen={() => setOpen(m.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="cm-hshare-empty" onClick={() => setOpen("")} aria-label={`Open ${horse.name}`}>
          <Icon.Horse />
        </button>
      )}
      {open !== null && <HorseViewer horseId={horse.id} name={horse.name} initial={media} startId={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/**
 * Floating horse viewer over a darkened page: the photo or video large on the left, everything
 * about the horse on the right (stacked on phones). Arrow keys and the buttons move between items.
 */
export function HorseViewer({
  horseId,
  name,
  initial,
  startId,
  onClose,
}: {
  horseId: string;
  name: string;
  initial: HorseMedia[];
  startId: string;
  onClose: () => void;
}) {
  const [horse, setHorse] = useState<HorseDetail | null>(null);
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState(startId);

  useEffect(() => {
    const c = new AbortController();
    community
      .horse(horseId)
      .then((r) => !c.signal.aborted && setHorse(r.horse))
      .catch((e) => !c.signal.aborted && setError(errorText(e, "This horse isn't available.")));
    return () => c.abort();
  }, [horseId]);

  const items: Item[] = useMemo(
    () => (horse ? mainFirst(horse.images, horse.coverImageId) : initial.map((m) => ({ id: m.id, kind: m.kind, hasPoster: m.hasPoster }))),
    [horse, initial],
  );
  const found = items.findIndex((i) => i.id === currentId);
  const index = found >= 0 ? found : 0;
  const item = items[index];
  const go = (step: number) => items.length && setCurrentId(items[(index + step + items.length) % items.length].id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "VIDEO" || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <TopLayer>
    <Modal label={`${horse?.name ?? name}: photos and details`} className="gx-layer cm-hv" onClose={onClose}>
      <div className="cm-hv-stage">
        {item ? (
          item.kind === "video" ? (
            <video
              key={item.id}
              src={horseImageUrl(item.id)}
              poster={horseMediaPicture(item) ?? undefined}
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <img key={item.id} src={horseImageUrl(item.id)} alt={`${horse?.name ?? name}, photo ${index + 1}`} />
          )
        ) : (
          <span className="cm-hv-none">
            <Icon.Horse />
            <small>No photos yet</small>
          </span>
        )}
        {items.length > 1 && (
          <>
            <button type="button" className="cm-hv-nav is-prev" onClick={() => go(-1)} aria-label="Previous">
              <Icon.Left />
            </button>
            <button type="button" className="cm-hv-nav is-next" onClick={() => go(1)} aria-label="Next">
              <Icon.Right />
            </button>
            <span className="cm-hv-count">{index + 1} / {items.length}</span>
          </>
        )}
        {items.length > 1 && (
          <div className="cm-hv-thumbs" role="list" aria-label="All photos and videos">
            {items.map((m, i) => {
              const picture = horseMediaPicture(m);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="listitem"
                  className={i === index ? "is-on" : undefined}
                  aria-current={i === index ? "true" : undefined}
                  aria-label={`${m.kind === "video" ? "Video" : "Photo"} ${i + 1}`}
                  onClick={() => setCurrentId(m.id)}
                >
                  {picture ? <img src={picture} alt="" loading="lazy" /> : <span className="cm-hshare-blank" />}
                  {m.kind === "video" && <span className="cm-hv-thumb-play" aria-hidden="true"><PlayIcon size={12} /></span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <aside className="cm-hv-info">
        <button type="button" className="cm-icon-btn cm-hv-close" onClick={onClose} aria-label="Close" title="Close" data-autofocus>
          <Icon.Close />
        </button>
        {error ? (
          <div className="cm-hv-error">
            <h2>{name}</h2>
            <p className="cm-error" role="alert">{error}</p>
          </div>
        ) : !horse ? (
          <div className="cm-hv-loading" aria-busy="true">
            <h2>{name}</h2>
            <span className="cm-sk cm-sk-a" />
            <span className="cm-sk cm-sk-b" />
            <span className="cm-sk cm-sk-c" />
          </div>
        ) : (
          <HorseInfo horse={horse} />
        )}
      </aside>
    </Modal>
    </TopLayer>
  );
}

function HorseInfo({ horse }: { horse: HorseDetail }) {
  const age = horse.foaledYear ? new Date().getFullYear() - horse.foaledYear : null;
  const s = horse.stats;
  const winRate = s.starts ? Math.round((s.wins / s.starts) * 100) : 0;
  const facts = (
    [
      ["Breed", horse.breed],
      ["Sex", horse.sex ? SEX_LABELS[horse.sex] : ""],
      ["Age", age !== null ? `${age} (foaled ${horse.foaledYear})` : ""],
      ["Colour", horse.color],
      ["Sire", horse.sire],
      ["Dam", horse.dam],
      ["Trainer", horse.trainer],
      ["Location", horse.location],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const races = horse.records.slice(0, 5);
  return (
    <div className="cm-hv-body">
      <header className="cm-hv-title">
        <StatusBadge status={horse.status} />
        <h2>{horse.name}</h2>
        <p>{[horse.breed, age !== null ? `${age} yrs` : "", horse.sex ? SEX_LABELS[horse.sex] : ""].filter(Boolean).join(" · ") || "Details not added yet"}</p>
      </header>

      <dl className="cm-hv-stats">
        <div><dt>Starts</dt><dd>{s.starts}</dd></div>
        <div><dt>W-P-S</dt><dd>{s.wins}-{s.places}-{s.shows}</dd></div>
        <div><dt>Win rate</dt><dd>{s.starts ? `${winRate}%` : "—"}</dd></div>
        <div><dt>Earnings</dt><dd className={s.earningsCents === null ? "is-hidden" : undefined}>{money(s.earningsCents, true)}</dd></div>
      </dl>

      {facts.length > 0 && (
        <section>
          <h3>Details</h3>
          <dl className="cm-hv-facts">
            {facts.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {horse.description && (
        <section>
          <h3>About</h3>
          <p className="cm-hv-about">{horse.description}</p>
        </section>
      )}

      {races.length > 0 && (
        <section>
          <h3>Recent races</h3>
          <ol className="cm-hv-races">
            {races.map((r) => (
              <li key={r.id}>
                <span className={`cm-hv-finish${r.finish === 1 ? " is-win" : ""}`}>{r.finish ? ordinal(r.finish) : "DNF"}</span>
                <span>
                  <strong>{r.raceName || r.track}</strong>
                  <small>
                    {[r.raceName ? r.track : "", new Date(`${r.raceDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), r.distance]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="cm-hv-owner">
        <h3>Owner</h3>
        <div>
          <Link to={`/community/people/${horse.owner.id}`} className="cm-hv-owner-id">
            <Avatar id={horse.owner.id} name={horse.owner.name} size={40} />
            <span>
              <strong>{horse.owner.name}{horse.owner.me && <em> (you)</em>}</strong>
              {horse.owner.headline && <small>{horse.owner.headline}</small>}
            </span>
          </Link>
          {!horse.owner.me && <FollowButton personId={horse.owner.id} isFollowing={horse.owner.isFollowing} size="sm" />}
        </div>
      </section>
    </div>
  );
}
