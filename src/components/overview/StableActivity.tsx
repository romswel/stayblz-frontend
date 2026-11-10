import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useWorkspace, useStableApi, StableGate } from "../../workspace";
import type {
  ConversationPreview,
  InventoryItem,
  TrackedHorse,
} from "../../types";
import { OverviewSection } from "./RacingSections";
import { useAuth } from "../../auth";
import { accountDraftKey, useDraft } from "../ui/useDraft";

interface Post {
  id: string;
  author: string;
  role: string;
  body: string;
  createdAt: string;
}
function list<T>(value: T[] | undefined): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid stable response.");
  return value;
}
export default function StableActivity() {
  const { active: stable } = useWorkspace();
  const api = useStableApi();
  const hasStable = !!stable;
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<ConversationPreview[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [horses, setHorses] = useState<TrackedHorse[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(hasStable);
  const [retry, setRetry] = useState(0);
  const { user } = useAuth();
  // The feed post being written is kept per stable on this device until it's posted.
  const [draft, setDraft] = useDraft(stable?.id ? accountDraftKey(user?.id, `feed.${stable.id}`) : null, "");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  useEffect(() => {
    if (!hasStable) return;
    const controller = new AbortController();
    setLoading(true);
    setErrors([]);
    const requests = [
      api
        .get<{ posts: Post[] }>("/api/feed", { signal: controller.signal })
        .then((d) => {
          if (!controller.signal.aborted) setPosts(list(d.posts));
        }),
      api
        .get<{ conversations: ConversationPreview[] }>("/api/team-messages", {
          signal: controller.signal,
        })
        .then((d) => {
          if (!controller.signal.aborted) setMessages(list(d.conversations));
        }),
      api
        .get<{ items: InventoryItem[] }>("/api/inventory", {
          signal: controller.signal,
        })
        .then((d) => {
          if (!controller.signal.aborted) setInventory(list(d.items));
        }),
      api
        .get<{ horses: TrackedHorse[] }>("/api/horses", {
          signal: controller.signal,
        })
        .then((d) => {
          if (!controller.signal.aborted) setHorses(list(d.horses));
        }),
    ];
    void Promise.allSettled(requests).then((results) => {
      if (controller.signal.aborted) return;
      const names = ["Stable feed", "Messages", "Inventory", "Horse tracker"];
      setErrors(
        results.flatMap((r, i) =>
          r.status === "rejected" ? [`${names[i]} could not be loaded.`] : [],
        ),
      );
      setLoading(false);
    });
    return () => controller.abort();
  }, [hasStable, api, retry]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    setPostError("");
    try {
      const d = await api.post<{ post: Post }>("/api/feed", {
        body: draft.trim(),
      });
      setPosts((old) => [d.post, ...old]);
      setDraft("");
    } catch (reason) {
      setPostError(
        reason instanceof Error
          ? reason.message
          : "Your update could not be saved.",
      );
    } finally {
      setPosting(false);
    }
  }
  return (
    <OverviewSection
      id="stable-activity"
      number="01"
      title="Stable updates"
      subtitle="People, horses & the day’s work"
    >
      {!hasStable ? (
        <StableGate>
          <span />
        </StableGate>
      ) : (
        <>
          <div className="ov-stable-stats">
            {[
              ["Horses in stable", inventory?.length, "/inventory"],
              [
                "Race ready",
                horses?.filter((h) =>
                  ["Race ready", "Entered"].includes(h.status),
                ).length,
                "/tracker",
              ],
              [
                "In training",
                horses?.filter((h) => h.status === "In training").length,
                "/tracker",
              ],
              [
                "Recovering",
                horses?.filter((h) => h.status === "Recovering").length,
                "/tracker",
              ],
            ].map(([label, value, to]) => (
              <Link key={label} to={String(to)}>
                <strong>{value ?? "—"}</strong>
                <span>{label}</span>
              </Link>
            ))}
          </div>
          {errors.length > 0 && (
            <div className="ov-load-error">
              <p role="status">{errors.join(" ")}</p>
              <button
                className="ws-button"
                disabled={loading}
                onClick={() => setRetry((n) => n + 1)}
              >
                Retry stable data
              </button>
            </div>
          )}
          <div className="ov-stable-grid">
            <div>
              <h3>Stable feed</h3>
              <form className="ov-composer" onSubmit={submit}>
                <textarea
                  disabled={posting}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={500}
                  aria-label="Write a feed post"
                  placeholder="Share an update with the stable…"
                />
                <div>
                  <span>{draft.length}/500</span>
                  <button
                    className="ws-button"
                    disabled={posting || !draft.trim()}
                  >
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </form>
              {postError && (
                <p className="form-error" role="alert">
                  {postError}
                </p>
              )}
              {posts.slice(0, 5).map((p) => (
                <article className="ov-post" key={p.id}>
                  <div>
                    <strong>{p.author}</strong>
                    <span>{p.role}</span>
                  </div>
                  <p>{p.body}</p>
                  <time>
                    {Number.isFinite(Date.parse(p.createdAt))
                      ? new Date(p.createdAt).toLocaleDateString()
                      : ""}
                  </time>
                </article>
              ))}
              {!posts.length && (
                <p className="ov-footnote">
                  {loading
                    ? "Loading updates…"
                    : errors.includes("Stable feed could not be loaded.")
                      ? "Feed unavailable."
                      : "No updates yet."}
                </p>
              )}
              {posts.length > 5 && (
                <details className="ov-older-posts">
                  <summary>Older updates ({posts.length - 5})</summary>
                  {posts.slice(5).map((p) => (
                    <article className="ov-post" key={p.id}>
                      <strong>{p.author}</strong>
                      <p>{p.body}</p>
                    </article>
                  ))}
                </details>
              )}
            </div>
            <div>
              <h3>
                Messages <Link to="/team-messages">Open ↗</Link>
              </h3>
              {messages.slice(0, 3).map((m) => (
                <Link className="ov-message" key={m.id} to="/team-messages">
                  <strong>
                    {m.title}
                    {m.unread > 0 && <span>{m.unread}</span>}
                  </strong>
                  <p>{m.lastMessage}</p>
                </Link>
              ))}
              {!messages.length && (
                <p className="ov-footnote">
                  {loading
                    ? "Loading messages…"
                    : errors.includes("Messages could not be loaded.")
                      ? "Messages unavailable."
                      : "No conversations yet."}
                </p>
              )}
              <p className="ov-footnote">
                Private conversations are visible only to their participants.
              </p>
              <h3 className="ov-engagement-heading">Upcoming races</h3>
              {horses
                ?.filter((h) => h.nextRace)
                .slice(0, 4)
                .map((h) => (
                  <Link key={h.id} className="ov-message" to="/tracker">
                    <strong>{h.name}</strong>
                    <p>{h.nextRace}</p>
                  </Link>
                ))}
              {horses && !horses.some((h) => h.nextRace) && (
                <p className="ov-footnote">No upcoming races added.</p>
              )}
            </div>
          </div>
        </>
      )}
    </OverviewSection>
  );
}
