import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useStableApi, type Teammate } from "../workspace";
import type { Conversation, ConversationPreview, Message } from "../types";
import { api as personalApi } from "../api";
import ConversationInvites from "../components/my-racing/ConversationInvites";
import { createRequestId } from "../requestId";
import { accountDraftKey, useDraft } from "../components/ui/useDraft";
export default function Messages({
  mode = "personal",
}: {
  mode?: "personal" | "team";
}) {
  const scopedApi = useStableApi();
  const api = mode === "team" ? scopedApi : personalApi;
  const base = mode === "team" ? "/api/team-messages" : "/api/messages";
  const { user } = useAuth();
  const [previews, setPreviews] = useState<ConversationPreview[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = active?.id ?? null;
  const [members, setMembers] = useState<Teammate[]>([]);
  const [threadOpen, setThreadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  // Unsent replies, per conversation, kept on this device until sent (cleared on log out).
  const [drafts, setDrafts] = useDraft<Record<string, string>>(accountDraftKey(user?.id, `messages.${mode}`), {}, {
    isEmpty: (all) => Object.values(all).every((text) => !text.trim()),
  });
  const [sending, setSending] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const deliveries = useRef(
    new Map<string, { body: string; clientId: string }>(),
  );
  const requestId = useRef(0);
  const [before, setBefore] = useState<string | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [invitation, setInvitation] = useState(() =>
    mode === "personal"
      ? (new URLSearchParams(location.hash.slice(1)).get("invite") ?? "")
      : "",
  );
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (mode === "personal" && location.hash.includes("invite="))
      history.replaceState(null, "", location.pathname + location.search);
  }, [mode]);
  async function acceptInvitation(e: FormEvent) {
    e.preventDefault();
    if (accepting || loading) return;
    setAccepting(true);
    setError("");
    try {
      const d = await personalApi.post<{ conversationId: string }>(
        "/api/messages/accept-invitation",
        { token: invitation.trim() },
      );
      setInvitation("");
      setAccepted(true);
      const list = await personalApi.get<{
        conversations: ConversationPreview[];
      }>("/api/messages");
      setPreviews(list.conversations);
      openConversation(d.conversationId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Invitation could not be accepted.",
      );
    } finally {
      setAccepting(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([
      api
        .get<{ conversations: ConversationPreview[] }>(base, {
          signal: controller.signal,
        })
        .then((d) => {
          if (controller.signal.aborted) return;
          setPreviews(d.conversations);
          if (d.conversations.length)
            openConversation(d.conversations[0].id, false);
        }),
      mode === "team"
        ? api
            .get<{ members: Teammate[] }>("/api/workspaces/members", {
              signal: controller.signal,
            })
            .then((d) => {
              if (!controller.signal.aborted) setMembers(d.members);
            })
        : Promise.resolve(),
    ])
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Messages could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      ++requestId.current;
    };
  }, [api, base]);
  function openConversation(id: string, focus = true) {
    const request = ++requestId.current;
    setActive(null);
    setError("");
    setSendError("");
    setThreadLoading(true);
    setBefore(null);
    setOlderLoading(false);
    if (focus) setThreadOpen(true);
    api
      .get<{ conversation: Conversation; before?: string | null }>(
        `${base}/${id}`,
      )
      .then((d) => {
        if (request === requestId.current) {
          setActive(d.conversation);
          setBefore(d.before ?? null);
        }
      })
      .catch((reason) => {
        if (request === requestId.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Conversation could not be loaded.",
          );
      })
      .finally(() => {
        if (request === requestId.current) setThreadLoading(false);
      });
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const d = await api.post<{ conversation: Conversation }>(
        base,
        mode === "team" ? { title, memberIds: participants } : { title },
      );
      setPreviews((old) => [d.conversation, ...old]);
      ++requestId.current;
      setActive(d.conversation);
      setBefore(null);
      setThreadLoading(false);
      setThreadOpen(true);
      setTitle("");
      setParticipants([]);
      setNewOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Conversation could not be created.",
      );
    } finally {
      setCreating(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!active) return;
    const id = active.id;
    const body = (drafts[id] ?? "").trim();
    if (!body || pending.current.has(id)) return;
    pending.current.add(id);
    setSending([...pending.current]);
    setSendError("");
    let delivery = deliveries.current.get(id);
    if (!delivery || delivery.body !== body) {
      delivery = { body, clientId: createRequestId() };
      deliveries.current.set(id, delivery);
    }
    try {
      const d = await api.post<{ message: Message }>(
        `${base}/${id}/messages`,
        delivery,
      );
      setActive((old) =>
        old?.id === id
          ? {
              ...old,
              messages: old.messages.some((m) => m.id === d.message.id)
                ? old.messages
                : [...old.messages, d.message],
            }
          : old,
      );
      setDrafts((old) => ({ ...old, [id]: "" }));
      deliveries.current.delete(id);
      setPreviews((old) =>
        old
          .map((c) =>
            c.id === id
              ? {
                  ...c,
                  lastMessage: d.message.body,
                  lastMessageAt: d.message.sentAt,
                }
              : c,
          )
          .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
      );
    } catch (reason) {
      if (activeIdRef.current === id)
        setSendError(
          reason instanceof Error
            ? reason.message
            : "Message could not be saved. Your draft has been kept.",
        );
    } finally {
      pending.current.delete(id);
      setSending([...pending.current]);
    }
  }
  async function older() {
    if (!active || !before || olderLoading) return;
    const id = active.id;
    const request = requestId.current;
    setOlderLoading(true);
    try {
      const d = await api.get<{
        conversation: Conversation;
        before: string | null;
      }>(`${base}/${id}?before=${encodeURIComponent(before)}`);
      if (request !== requestId.current) return;
      setActive((old) =>
        old?.id === id
          ? {
              ...old,
              messages: [
                ...d.conversation.messages.filter(
                  (m) => !old.messages.some((v) => v.id === m.id),
                ),
                ...old.messages,
              ],
            }
          : old,
      );
      setBefore(d.before);
    } catch (reason) {
      if (request === requestId.current)
        setSendError(
          reason instanceof Error
            ? reason.message
            : "Older messages could not be loaded.",
        );
    } finally {
      if (request === requestId.current) setOlderLoading(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">
          {mode === "team"
            ? "Stable communications"
            : "Your racing conversations"}
        </div>
        <h1>{mode === "team" ? "Team messages" : "Messages"}</h1>
        <p className="sub">
          {mode === "team"
            ? "Private conversations with selected teammates."
            : "Talk racing privately. No stable membership is needed."}{" "}
          Only participants can read or send messages.
        </p>
      </header>
      {mode === "personal" && invitation && (
        <form className="ov-paper mr-accept-invite" onSubmit={acceptInvitation}>
          <h2>You have a conversation invitation</h2>
          <p>
            Accept with the account email addressed by the invitation. This
            shares the conversation history with you.
          </p>
          <input
            aria-label="Conversation invitation code"
            type="password"
            value={invitation}
            onChange={(e) => setInvitation(e.target.value)}
            maxLength={64}
          />
          <button className="ws-button" disabled={accepting || loading}>
            {accepting ? "Joining…" : "Accept conversation invitation"}
          </button>
        </form>
      )}
      {accepted && (
        <p className="ws-notice" role="status">
          Conversation invitation accepted.
        </p>
      )}
      <button
        className="ws-button inventory-add"
        onClick={() => setNewOpen(!newOpen)}
        aria-expanded={newOpen}
      >
        New conversation
      </button>
      {newOpen && (
        <form className="panel message-new" onSubmit={create}>
          <label>
            Conversation title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <p>
            {mode === "team"
              ? "Choose teammates, or leave empty for your own notes."
              : "Start a conversation, then invite someone by their account email. You can also keep it just for yourself."}
          </p>
          {members
            .filter((m) => m.id !== user?.id)
            .map((m) => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={participants.includes(m.id)}
                  onChange={(e) =>
                    setParticipants((old) =>
                      e.target.checked
                        ? [...old, m.id]
                        : old.filter((id) => id !== m.id),
                    )
                  }
                />
                {m.displayName}
              </label>
            ))}
          <button className="ws-button" disabled={creating}>
            {creating ? "Creating…" : "Create conversation"}
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div
        className={`panel messages-layout${threadOpen ? " thread-open" : ""}`}
      >
        <div className="convo-list">
          {loading && <div className="loading">Loading conversations…</div>}
          {!loading && !error && !previews.length && (
            <div className="empty">
              No conversations yet. Start one, invite someone, or keep a private
              note.
            </div>
          )}
          {previews.map((c) => (
            <button
              key={c.id}
              className={`convo-item${active?.id === c.id ? " active" : ""}`}
              onClick={() => openConversation(c.id)}
            >
              <div className="convo-top">
                <span className="convo-title">{c.title}</span>
                <span className="convo-time">
                  {Number.isFinite(Date.parse(c.lastMessageAt))
                    ? new Date(c.lastMessageAt).toLocaleDateString()
                    : ""}
                </span>
              </div>
              <div className="convo-preview">
                {c.lastMessage || "No messages yet"}
              </div>
            </button>
          ))}
        </div>
        <div className="thread">
          {active ? (
            <>
              <div className="thread-head">
                <button
                  className="thread-back"
                  onClick={() => setThreadOpen(false)}
                >
                  Back
                </button>
                <div>
                  <div className="t">{active.title}</div>
                  <div className="p">{active.participants.join(", ")}</div>
                </div>
                <button
                  className="ws-button"
                  onClick={() => openConversation(active.id, false)}
                >
                  Refresh conversation
                </button>
              </div>
              {mode === "personal" && active.canInvite && (
                <ConversationInvites
                  key={active.id}
                  conversationId={active.id}
                />
              )}
              <div className="thread-body">
                {before && (
                  <button
                    className="ws-button"
                    onClick={() => void older()}
                    disabled={olderLoading}
                  >
                    {olderLoading ? "Loading…" : "Older messages"}
                  </button>
                )}
                {active.messages.map((m) => (
                  <div key={m.id} className={`bubble${m.mine ? " mine" : ""}`}>
                    <div className="meta">{m.mine ? "You" : m.from}</div>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>
              {sendError && (
                <p className="form-error" role="alert">
                  {sendError}
                </p>
              )}
              <form className="message-send" onSubmit={send}>
                <textarea
                  aria-label="Write a message"
                  value={drafts[active.id] ?? ""}
                  maxLength={4000}
                  disabled={sending.includes(active.id)}
                  onChange={(e) => {
                    const id = active.id;
                    setDrafts((old) => ({ ...old, [id]: e.target.value }));
                  }}
                  placeholder="Write to this conversation…"
                />
                <button
                  className="ws-button"
                  disabled={
                    sending.includes(active.id) ||
                    !(drafts[active.id] ?? "").trim()
                  }
                >
                  {sending.includes(active.id) ? "Sending…" : "Send"}
                </button>
              </form>
              <p className="message-notice">
                Messages are saved to this conversation. Live delivery and
                notifications are not connected yet; use Refresh conversation
                for new replies.
              </p>
            </>
          ) : (
            <div className="empty">
              {threadLoading
                ? "Loading conversation…"
                : "Select a conversation to read it."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
