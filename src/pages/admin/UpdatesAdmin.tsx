import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import UpdatesHeader from "../../components/updates/UpdatesHeader";
import { useConfirm } from "../../components/ui/Confirm";
import { accountDraftKey, useDraft } from "../../components/ui/useDraft";
import RichText from "../../components/updates/RichText";
import { PostMeta, UpdateItems } from "../../components/updates/UpdateParts";
import { useUpdates } from "../../components/updates/UpdatesContext";
import {
  formatDate,
  kindLabels,
  tagLabels,
  tagOrder,
  type UpdateKind,
  type UpdatePost,
  type UpdateTag,
} from "../../components/updates/types";
import "../../components/updates/updates.css";

type Draft = {
  kind: UpdateKind;
  title: string;
  slug: string;
  summary: string;
  version: string;
  body: string;
  items: { tag: UpdateTag; text: string }[];
  audience: "public" | "members";
  pinned: boolean;
  popup: boolean;
  authorLabel: string;
  /** Local date-time text for the input; empty means "now" on publish. */
  publishAt: string;
};

const empty: Draft = {
  kind: "update",
  title: "",
  slug: "",
  summary: "",
  version: "",
  body: "",
  items: [{ tag: "new", text: "" }],
  audience: "public",
  pinned: false,
  popup: true,
  authorLabel: "Stayblz team",
  publishAt: "",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromPost = (post: UpdatePost): Draft => ({
  kind: post.kind,
  title: post.title,
  slug: post.slug,
  summary: post.summary,
  version: post.version,
  body: post.body ?? "",
  items: post.items.length ? post.items : [],
  audience: post.audience,
  pinned: post.pinned,
  popup: post.popup,
  authorLabel: post.authorLabel,
  publishAt: toLocalInput(post.publishedAt),
});

const statusLabels: Record<UpdatePost["status"], string> = { draft: "Draft", published: "Published", archived: "Archived" };
const isScheduled = (post: UpdatePost) => post.status === "published" && !!post.publishedAt && Date.parse(post.publishedAt) > Date.now();

function useAdminUpdates() {
  const [state, setState] = useState<{ posts: UpdatePost[] | null; loading: boolean; error: string }>({ posts: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    api
      .get<{ updates: UpdatePost[] }>("/api/admin/updates", { signal: controller.signal })
      .then((body) => !controller.signal.aborted && setState({ posts: body.updates ?? [], loading: false, error: "" }))
      .catch(
        (reason) =>
          !controller.signal.aborted &&
          setState((s) => ({ ...s, loading: false, error: reason instanceof Error ? reason.message : "Posts could not be loaded." })),
      );
    return () => controller.abort();
  }, [attempt]);
  return { ...state, reload: useCallback(() => setAttempt((n) => n + 1), []) };
}

function PostList() {
  const { posts, loading, error, reload } = useAdminUpdates();
  const [filter, setFilter] = useState<"" | UpdatePost["status"]>("");
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () =>
      (posts ?? []).filter(
        (post) =>
          (!filter || post.status === filter) &&
          (!query.trim() || `${post.title} ${post.summary}`.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [posts, filter, query],
  );
  const counts = useMemo(() => {
    const result = { draft: 0, published: 0, archived: 0 };
    for (const post of posts ?? []) result[post.status]++;
    return result;
  }, [posts]);
  return (
    <div className="up-admin">
      <UpdatesHeader manage />
      <div className="up-toolbar">
        <div className="up-chips" role="group" aria-label="Status">
          {(["", "published", "draft", "archived"] as const).map((status) => (
            <button key={status || "all"} type="button" className="up-chip" aria-pressed={filter === status} onClick={() => setFilter(status)}>
              {status ? `${statusLabels[status]} (${counts[status]})` : `All (${posts?.length ?? 0})`}
            </button>
          ))}
        </div>
        <label className="up-search">
          <span className="sr-only">Search posts</span>
          <input type="search" placeholder="Search posts…" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} />
        </label>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}{" "}
          <button type="button" className="btn btn-quiet" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {loading && !posts ? (
        <p role="status">Loading posts…</p>
      ) : !shown.length && !error ? (
        <div className="up-empty">
          <span aria-hidden="true">✦</span>
          <h2>{posts?.length ? "No posts match" : "No posts yet"}</h2>
          <p>{posts?.length ? "Try another status or word." : "Write the first one: a release note, a welcome, or a notice."}</p>
        </div>
      ) : (
        <ul className="up-admin-list">
          {shown.map((post) => (
            <li key={post.id} className={`up-admin-row status-${post.status}`}>
              <div className="up-admin-main">
                <span className={`up-status status-${isScheduled(post) ? "scheduled" : post.status}`}>
                  {isScheduled(post) ? "Scheduled" : statusLabels[post.status]}
                </span>
                <Link to={`/updates/manage/${post.id}`} className="up-admin-title">
                  {post.title}
                </Link>
                <small>
                  {kindLabels[post.kind]} · {post.audience === "members" ? "Members only" : "Everyone"}
                  {post.pinned ? " · Pinned" : ""} · {post.publishedAt ? formatDate(post.publishedAt, true) : `Edited ${formatDate(post.updatedAt)}`}
                </small>
              </div>
              <div className="up-admin-actions">
                {post.status === "published" && !isScheduled(post) && (
                  <Link className="btn btn-quiet" to={`/updates/${post.slug}`}>
                    View
                  </Link>
                )}
                <Link className="btn btn-quiet" to={`/updates/manage/${post.id}`}>
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Editor({ id }: { id: string | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { reload: reloadMenu } = useUpdates();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { posts, loading, error: loadError, reload } = useAdminUpdates();
  const existing = id ? posts?.find((post) => post.id === id) : null;
  // Unsaved writing is kept on this device (per account and per post) until it's saved or discarded.
  const [kept, setKept, clearKept, restored] = useDraft<Draft | null>(accountDraftKey(user?.id, `update.${id ?? "new"}`), null, {
    maxAgeDays: 14,
  });
  const [draft, setDraft] = useState<Draft>(() => kept ?? empty);
  const [slugTouched, setSlugTouched] = useState(() => !!kept?.slug);
  const [dirty, setDirty] = useState(() => !!kept);
  const usedKept = useRef(restored);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => {
    const state = location.state as { notice?: unknown } | null;
    return typeof state?.notice === "string" ? state.notice : "";
  });
  const [view, setView] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (existing) {
      // Keep restored unsaved changes the first time the post loads.
      if (usedKept.current) {
        usedKept.current = false;
        setSlugTouched(true);
        return;
      }
      setDraft(fromPost(existing));
      setSlugTouched(true);
      setDirty(false);
    }
  }, [existing?.id, existing?.updatedAt]);
  useEffect(() => {
    if (dirty) setKept(draft);
  }, [draft, dirty, setKept]);
  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDirty(true);
    setNotice("");
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "title" && !slugTouched ? { slug: slugify(String(value)) } : {}),
    }));
  };
  const setItem = (index: number, item: Partial<Draft["items"][number]>) =>
    change(
      "items",
      draft.items.map((current, n) => (n === index ? { ...current, ...item } : current)),
    );
  const moveItem = (index: number, by: number) => {
    const items = [...draft.items];
    const [item] = items.splice(index, 1);
    items.splice(Math.max(0, Math.min(items.length, index + by)), 0, item);
    change("items", items);
  };

  async function save(status: UpdatePost["status"]) {
    if (busy) return;
    if ((draft.slug || slugify(draft.title)) === "manage") {
      setError('The web address "manage" is used by the admin page. Choose another one.');
      return;
    }
    if (existing?.status === "published" && status !== "published") {
      const sure = await confirm(
        status === "archived"
          ? {
              title: "Archive this post?",
              message: "It disappears from Updates for everyone. You can publish it again later.",
              confirmLabel: "Archive post",
            }
          : {
              title: "Unpublish this post?",
              message: "It goes back to a draft that only admins can see.",
              confirmLabel: "Unpublish",
            },
      );
      if (!sure) return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const items = draft.items.filter((item) => item.text.trim());
    const body = {
      kind: draft.kind,
      title: draft.title,
      slug: draft.slug || slugify(draft.title),
      summary: draft.summary,
      version: draft.version,
      body: draft.body,
      items,
      audience: draft.audience,
      pinned: draft.pinned,
      popup: draft.popup,
      authorLabel: draft.authorLabel,
      status,
      ...(draft.publishAt ? { publishedAt: new Date(draft.publishAt).toISOString() } : {}),
    };
    try {
      const result = id
        ? await api.put<{ update: UpdatePost }>(`/api/admin/updates/${id}`, body)
        : await api.post<{ update: UpdatePost }>("/api/admin/updates", body);
      setDirty(false);
      clearKept();
      reloadMenu();
      const message =
        status === "draft"
          ? "Draft saved. Only admins can see it."
          : status === "archived"
            ? "Archived. It no longer appears on Updates."
            : isScheduled(result.update)
              ? `Scheduled for ${formatDate(result.update.publishedAt, true)}.`
              : "Published. It's live on Updates.";
      if (!id) navigate(`/updates/manage/${result.update.id}`, { replace: true, state: { notice: message } });
      else {
        reload();
        setNotice(message);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The post could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || busy) return;
    const sure = await confirm({
      title: "Delete this post for good?",
      message: "It's removed from Updates and can't be brought back. Archive it instead if you might need it again.",
      confirmLabel: "Delete post",
      tone: "danger",
    });
    if (!sure) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/api/admin/updates/${id}`);
      setDirty(false);
      clearKept();
      reloadMenu();
      navigate("/updates/manage", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The post could not be deleted.");
      setBusy(false);
    }
  }

  if (id && loading && !posts) return <p role="status">Loading the post…</p>;
  if (id && !loading && !existing && !loadError)
    return (
      <div className="up-empty">
        <h2>That post no longer exists</h2>
        <Link className="btn btn-quiet" to="/updates/manage">
          Back to all posts
        </Link>
      </div>
    );

  const preview: UpdatePost = {
    id: id ?? "preview",
    slug: draft.slug || slugify(draft.title) || "preview",
    kind: draft.kind,
    title: draft.title || "Untitled post",
    summary: draft.summary,
    items: draft.items.filter((item) => item.text.trim()),
    version: draft.version,
    audience: draft.audience,
    pinned: draft.pinned,
    popup: draft.popup,
    status: existing?.status ?? "draft",
    publishedAt: draft.publishAt ? new Date(draft.publishAt).toISOString() : (existing?.publishedAt ?? new Date().toISOString()),
    authorLabel: draft.authorLabel || "Stayblz team",
    updatedAt: new Date().toISOString(),
    readMinutes: Math.max(1, Math.ceil((draft.body.length + JSON.stringify(draft.items).length) / 1100)),
    hasBody: !!draft.body,
    body: draft.body,
  };
  const published = existing?.status === "published";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save("published");
  };

  return (
    <div className="up-admin up-editor-page">
      <nav className="up-crumbs" aria-label="Breadcrumb">
        <Link to="/updates">Updates</Link>
        <span aria-hidden="true">/</span>
        <Link to="/updates/manage">Manage posts</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{id ? "Edit post" : "New post"}</span>
      </nav>
      <header className="up-hero">
        <div>
          <h1>{id ? "Edit post" : "New post"}</h1>
          <p className="sub">
            {existing ? (
              <>
                <span className={`up-status status-${isScheduled(existing) ? "scheduled" : existing.status}`}>
                  {isScheduled(existing) ? "Scheduled" : statusLabels[existing.status]}
                </span>{" "}
                {existing.publishedAt ? `Published ${formatDate(existing.publishedAt, true)}` : "Not published yet"}
                {dirty && " · Unsaved changes"}
              </>
            ) : (
              "Write in plain words for customers and the team. Save a draft any time."
            )}
          </p>
        </div>
      </header>
      <div className="up-view-switch" role="group" aria-label="Editor view">
        <button type="button" className="up-chip" aria-pressed={view === "write"} onClick={() => setView("write")}>
          Write
        </button>
        <button type="button" className="up-chip" aria-pressed={view === "preview"} onClick={() => setView("preview")}>
          Preview
        </button>
      </div>
      <div className={`up-editor show-${view}`}>
        <form className="up-form panel" onSubmit={submit} noValidate>
          <div className="up-form-row">
            <label>
              Type
              <select value={draft.kind} onChange={(e) => change("kind", e.target.value as UpdateKind)}>
                {(Object.keys(kindLabels) as UpdateKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Version <small>(optional, e.g. 0.9)</small>
              <input value={draft.version} maxLength={20} onChange={(e) => change("version", e.target.value)} />
            </label>
          </div>
          <label>
            Title
            <input value={draft.title} maxLength={140} required onChange={(e) => change("title", e.target.value)} />
          </label>
          <label>
            Web address
            <span className="up-slug">
              <span>/updates/</span>
              <input
                value={draft.slug}
                maxLength={80}
                onChange={(e) => {
                  setSlugTouched(true);
                  change("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
              />
            </span>
          </label>
          <label>
            Summary <small>{draft.summary.length}/400 · shown on cards and in the pop-up</small>
            <textarea rows={2} value={draft.summary} maxLength={400} onChange={(e) => change("summary", e.target.value)} />
          </label>

          <fieldset className="up-lines">
            <legend>Change lines <small>(patch notes, up to 40)</small></legend>
            {draft.items.map((item, index) => (
              <div className="up-line" key={index}>
                <select aria-label={`Label for line ${index + 1}`} value={item.tag} onChange={(e) => setItem(index, { tag: e.target.value as UpdateTag })}>
                  {tagOrder.map((tag) => (
                    <option key={tag} value={tag}>
                      {tagLabels[tag]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Change line ${index + 1}`}
                  value={item.text}
                  maxLength={400}
                  placeholder="What changed, in one sentence"
                  onChange={(e) => setItem(index, { text: e.target.value })}
                />
                <span className="up-line-tools">
                  <button type="button" aria-label={`Move line ${index + 1} up`} disabled={index === 0} onClick={() => moveItem(index, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move line ${index + 1} down`}
                    disabled={index === draft.items.length - 1}
                    onClick={() => moveItem(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => change("items", draft.items.filter((_, n) => n !== index))}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
            {draft.items.length < 40 && (
              <button type="button" className="btn btn-quiet" onClick={() => change("items", [...draft.items, { tag: "new", text: "" }])}>
                Add a line
              </button>
            )}
          </fieldset>

          <label>
            Full post <small>{draft.body.length.toLocaleString()}/20,000 · optional</small>
            <textarea className="up-body-input" rows={12} value={draft.body} maxLength={20000} onChange={(e) => change("body", e.target.value)} />
          </label>
          <details className="up-format-help">
            <summary>Formatting help</summary>
            <p>
              <code>## Heading</code> · <code>- list item</code> · <code>1. numbered</code> · <code>**bold**</code> ·{" "}
              <code>*italic*</code> · <code>[link text](https://…)</code> · <code>&gt; quote</code> · <code>---</code> for a
              divider · <code>| a | b |</code> rows for a table. The &lt; character can't be used, and titles and change lines can't use &gt; either.
            </p>
          </details>

          <fieldset className="up-options">
            <legend>Options</legend>
            <label className="acct-toggle">
              <input type="radio" name="audience" checked={draft.audience === "public"} onChange={() => change("audience", "public")} />
              <span>
                Everyone<small>Visible to visitors without an account too.</small>
              </span>
            </label>
            <label className="acct-toggle">
              <input type="radio" name="audience" checked={draft.audience === "members"} onChange={() => change("audience", "members")} />
              <span>
                Members only<small>Only signed-in accounts can read it.</small>
              </span>
            </label>
            <label className="acct-toggle">
              <input type="checkbox" checked={draft.pinned} onChange={(e) => change("pinned", e.target.checked)} />
              <span>
                Pin to the top<small>Up to three pinned posts stay above the feed.</small>
              </span>
            </label>
            <label className="acct-toggle">
              <input type="checkbox" checked={draft.popup} onChange={(e) => change("popup", e.target.checked)} />
              <span>
                Show as a pop-up<small>Once per member, unless they've turned pop-ups off.</small>
              </span>
            </label>
            <div className="up-form-row">
              <label>
                Posted by
                <input value={draft.authorLabel} maxLength={80} onChange={(e) => change("authorLabel", e.target.value)} />
              </label>
              <label>
                Publish date <small>(empty = now; a future time schedules it)</small>
                <input type="datetime-local" value={draft.publishAt} onChange={(e) => change("publishAt", e.target.value)} />
              </label>
            </div>
          </fieldset>

          {(error || loadError) && (
            <p className="form-error" role="alert">
              {error || loadError}
            </p>
          )}
          {notice && (
            <p className="up-saved" role="status">
              {notice}
            </p>
          )}
          {dirty && restored && (
            <p className="up-kept" role="status">
              We kept your unsaved changes from last time.{" "}
              <button
                type="button"
                className="up-link-button"
                onClick={() => {
                  clearKept();
                  setDraft(existing ? fromPost(existing) : empty);
                  setSlugTouched(!!existing);
                  setDirty(false);
                }}
              >
                Discard them
              </button>
            </p>
          )}
          <div className="up-form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : published ? "Save and keep published" : draft.publishAt && Date.parse(draft.publishAt) > Date.now() ? "Schedule" : "Publish"}
            </button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void save("draft")}>
              {published ? "Unpublish to draft" : "Save draft"}
            </button>
            {id && existing?.status !== "archived" && (
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void save("archived")}>
                Archive
              </button>
            )}
            {id && (
              <button type="button" className="btn btn-quiet up-danger" disabled={busy} onClick={() => void remove()}>
                Delete
              </button>
            )}
          </div>
        </form>
        <aside className="up-preview" aria-label="Preview">
          <span className="up-section-label">Preview</span>
          <article className={`up-post kind-${preview.kind}`}>
            <PostMeta post={preview} />
            <h1>{preview.title}</h1>
            {preview.summary && <p className="up-post-summary">{preview.summary}</p>}
            {preview.items.length > 0 && (
              <section className="up-post-notes">
                <UpdateItems post={preview} grouped />
              </section>
            )}
            {preview.body && <RichText text={preview.body} />}
          </article>
        </aside>
      </div>
    </div>
  );
}

/** Admin tools for Updates. The route is only mounted for admins; the API checks again. */
export default function UpdatesAdmin() {
  const { id } = useParams();
  if (!id) return <PostList />;
  return <Editor key={id} id={id === "new" ? null : id} />;
}
