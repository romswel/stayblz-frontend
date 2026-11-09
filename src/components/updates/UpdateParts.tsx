import { Link } from "react-router-dom";
import { kindLabels, relativeDate, tagLabels, tagOrder, type UpdatePost, type UpdateTag } from "./types";

export function KindBadge({ kind }: { kind: UpdatePost["kind"] }) {
  return <span className={`up-kind kind-${kind}`}>{kindLabels[kind]}</span>;
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
export function UpdateCard({ post, isNew, featured = false }: { post: UpdatePost; isNew?: boolean; featured?: boolean }) {
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
      <span className="up-read" aria-hidden="true">
        Read {post.kind === "update" ? "the patch notes" : "more"} →
      </span>
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
