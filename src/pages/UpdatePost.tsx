import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { canUse } from "../components/account/roles";
import RichText from "../components/updates/RichText";
import { PostMeta, UpdateItems } from "../components/updates/UpdateParts";
import { formatDate, kindLabels, type UpdatePost as Post } from "../components/updates/types";
import StatusPage from "../components/status/StatusPage";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import "../components/updates/updates.css";
import "./landing.css";
import "./faq.css";

type Neighbour = { slug: string; title: string } | null;
type Loaded = { update: Post; newer: Neighbour; older: Neighbour };

function usePost(slug: string) {
  const [state, setState] = useState<{ data: Loaded | null; loading: boolean; error: string; missing: string }>({
    data: null,
    loading: true,
    error: "",
    missing: "",
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "", missing: "" });
    api
      .get<Loaded>(`/api/updates/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: "", missing: "" });
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 404)
          setState({ data: null, loading: false, error: "", missing: reason.code ?? "not_found" });
        else setState({ data: null, loading: false, missing: "", error: reason instanceof Error ? reason.message : "This post could not be loaded." });
      });
    return () => controller.abort();
  }, [slug, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function ShareButton({ post }: { post: Post }) {
  const [note, setNote] = useState("");
  async function share() {
    const url = `${window.location.origin}/updates/${post.slug}`;
    setNote("");
    try {
      if (navigator.share) await navigator.share({ title: post.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied.");
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setNote("Copy the address from your browser to share it.");
    }
  }
  return (
    <span className="up-share">
      <button type="button" className="btn btn-quiet" onClick={() => void share()}>
        Share
      </button>
      {note && <span role="status">{note}</span>}
    </span>
  );
}

function PostBody({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const { user } = useAuth();
  const { data, loading, error, missing, retry } = usePost(slug);
  if (loading)
    return (
      <div className="up-post up-skeleton-post" aria-busy="true">
        <p className="sr-only" role="status">
          Loading the post…
        </p>
        <span />
        <span />
        <span />
      </div>
    );
  if (missing)
    return (
      <StatusPage
        kind="not-found"
        title="We couldn't find that post"
        message={
          !signedIn && missing === "not_found_or_members"
            ? "It may have been removed, or it's for members only. Log in to read members-only posts."
            : "It may have been moved or removed. The newest posts are on the Updates page."
        }
        actions={
          <>
            <Link className="btn btn-primary status-primary" to="/updates">
              See all updates
            </Link>
            {!signedIn && (
              <Link className="btn btn-quiet" to="/login" state={{ destination: `/updates/${slug}` }}>
                Log in
              </Link>
            )}
          </>
        }
      />
    );
  if (error || !data)
    return (
      <div className="form-error" role="alert">
        {error || "This post could not be loaded."}{" "}
        <button type="button" className="btn btn-quiet" onClick={retry}>
          Try again
        </button>
      </div>
    );
  const post = data.update;
  return (
    <article className={`up-post kind-${post.kind}`} aria-labelledby="up-post-title">
      <nav className="up-crumbs" aria-label="Breadcrumb">
        <Link to="/updates">Updates</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/updates?kind=${post.kind}`}>{kindLabels[post.kind]}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{post.title}</span>
      </nav>
      <header className="up-post-head">
        <PostMeta post={post} />
        <h1 id="up-post-title">{post.title}</h1>
        {post.summary && <p className="up-post-summary">{post.summary}</p>}
        <div className="up-post-byline">
          <span>
            By {post.authorLabel} · {formatDate(post.publishedAt)}
          </span>
          <span className="up-post-tools">
            <ShareButton post={post} />
            {canUse(user, "admin") && (
              <Link className="btn btn-quiet" to={`/admin/updates/${post.id}`}>
                Edit
              </Link>
            )}
          </span>
        </div>
      </header>
      {post.items.length > 0 && (
        <section className="up-post-notes" aria-label="Changes">
          <UpdateItems post={post} grouped />
        </section>
      )}
      {post.body && <RichText text={post.body} />}
      <nav className="up-neighbours" aria-label="More updates">
        {data.newer ? (
          <Link to={`/updates/${data.newer.slug}`} className="up-neighbour">
            <small>← Newer</small>
            {data.newer.title}
          </Link>
        ) : (
          <span />
        )}
        {data.older ? (
          <Link to={`/updates/${data.older.slug}`} className="up-neighbour is-older">
            <small>Older →</small>
            {data.older.title}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

/** One Update post. Public posts can be read and shared without an account. */
export default function UpdatePost() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const pageRef = usePublicMotion();
  if (user)
    return (
      <div className="up-page up-page-post" key={slug}>
        <PostBody slug={slug} signedIn />
      </div>
    );
  return (
    <div className="landing" id="top" ref={pageRef}>
      <PublicHeader />
      <main className="faq-main up-public" id="updates-main">
        <div className="up-public-body up-public-post" key={slug}>
          <PostBody slug={slug} signedIn={false} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
