import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { kindLabels, relativeDate, tagLabels, tagOrder, type UpdateKind, type UpdatePost, type UpdateTag } from "./types";
import { ReactionCounts } from "./ReactionBar";
import type { ReactionSummary } from "./reactions";

const glyph = (children: ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
/** A small picture for each kind of post, so the feed reads at a glance. */
export const kindIcons: Record<UpdateKind, ReactNode> = {
  update: glyph(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />),
  announcement: glyph(<><path d="M4 10v4h3l6 4V6l-6 4z" /><path d="M17 9a4 4 0 0 1 0 6" /></>),
  news: glyph(<><path d="M5 5h11v14H6a1 1 0 0 1-1-1z" /><path d="M16 9h3v9a1 1 0 0 1-1 1h-2M8 9h5M8 12h5M8 15h3" /></>),
  maintenance: glyph(<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />),
  event: glyph(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
};

export function KindBadge({ kind }: { kind: UpdatePost["kind"] }) {
  return (
    <span className={`up-kind kind-${kind}`}>
      {kindIcons[kind]}
      {kindLabels[kind]}
    </span>
  );
}

export function TagLabel({ tag }: { tag: UpdateTag }) {
  return <span className={`up-tag tag-${tag}`}>{tagLabels[tag]}</span>;
}

/** Change lines. `grouped` shows them under New / Improved / Fixed… headings, like patch notes. */
export function UpdateItems({ post, limit, grouped = false }: { post: Pick<UpdatePost, "items">; limit?: number; grouped?: boolean }) {
  const items = limit ? post.items.slice(0, limit) : post.items;
  if (!items.length) return null;
  if (grouped)
    return (
      <div className="up-groups">
        {tagOrder
          .filter((tag) => items.some((item) => item.tag === tag))
          .map((tag) => (
            <section key={tag} className={`up-group group-${tag}`} aria-label={tagLabels[tag]}>
              <h3>
                <TagLabel tag={tag} />
                <span className="up-group-count">{items.filter((item) => item.tag === tag).length}</span>
              </h3>
              <ul>
                {items
                  .filter((item) => item.tag === tag)
                  .map((item, n) => (
                    <li key={n}>{item.text}</li>
                  ))}
              </ul>
            </section>
          ))}
      </div>
    );
  return (
    <ul className="up-items">
      {items.map((item, n) => (
        <li key={n}>
          <TagLabel tag={item.tag} />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function PostMeta({ post }: { post: UpdatePost }) {
  return (
    <div className="up-meta">
      <KindBadge kind={post.kind} />
      {post.version && <span className="up-version">v{post.version.replace(/^v/i, "")}</span>}
      <time dateTime={post.publishedAt ?? undefined} title={post.publishedAt ? new Date(post.publishedAt).toLocaleString() : undefined}>
        {relativeDate(post.publishedAt)}
      </time>
      <span aria-hidden="true">·</span>
      <span>{post.readMinutes} min read</span>
      {post.audience === "members" && <span className="up-members">Members only</span>}
    </div>
  );
}

/** One post in the feed. The whole card opens the post. */
export function UpdateCard({
  post,
  isNew,
  featured = false,
  reactions,
}: {
  post: UpdatePost;
  isNew?: boolean;
  featured?: boolean;
  reactions?: ReactionSummary;
}) {
  return (
    <article className={`up-card kind-${post.kind}${featured ? " is-featured" : ""}${post.pinned ? " is-pinned" : ""}`}>
      <PostMeta post={post} />
      <h2 className="up-card-title">
        <Link to={`/updates/${post.slug}`} className="up-card-link">
          {post.title}
        </Link>
        {isNew && <span className="up-new">New</span>}
        {post.pinned && <span className="up-pin">Pinned</span>}
      </h2>
      {post.summary && <p className="up-summary">{post.summary}</p>}
      <UpdateItems post={post} limit={featured ? 5 : 3} />
      {post.items.length > (featured ? 5 : 3) && (
        <p className="up-more">+{post.items.length - (featured ? 5 : 3)} more changes</p>
      )}
      <div className="up-card-foot">
        <ReactionCounts summary={reactions} />
        <span className="up-read" aria-hidden="true">
          Read {post.kind === "update" ? "the notes" : "more"} →
        </span>
      </div>
    </article>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="up-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, n) => (
        <div key={n} className="up-card up-skeleton">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
