import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api";
import { createRequestId } from "../../requestId";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { notifyChatsChanged, type ChatApi } from "./chatApi";
import { toMs } from "./format";
import type { ChatMessage, ChatPreview, ChatReply, ChatThread, OutboxItem } from "./types";

/** Poll quickly while a conversation is active, slower when it goes quiet, never while hidden. */
const FAST_MS = 4_000;
const SLOW_MS = 12_000;
const QUIET_AFTER_MS = 2 * 60_000;

const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => toMs(a.sentAt) - toMs(b.sentAt) || a.id.localeCompare(b.id));
}

/** Fill in anything a response left out (an older server, a partial poll) so rendering never breaks. */
export function normalizeMessage(m: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    id: m.id,
    senderId: m.senderId ?? (m.mine ? "me" : (m.from ?? "")),
    from: m.from ?? "Member",
    body: m.body ?? "",
    sentAt: m.sentAt ?? new Date(0).toISOString(),
    mine: !!m.mine,
    removed: !!m.removed,
    reactions: Array.isArray(m.reactions) ? m.reactions : [],
    replyTo: m.replyTo ?? null,
  };
}
export function normalizeThread(c: Partial<ChatThread> & { id: string }): ChatThread {
  return {
    id: c.id,
    kind: c.kind ?? "group",
    title: c.title ?? "Chat",
    participants: c.participants ?? [],
    lastMessage: c.lastMessage ?? "",
    lastMessageMine: !!c.lastMessageMine,
    lastMessageAt: c.lastMessageAt ?? "",
    unread: !!c.unread,
    request: !!c.request,
    waiting: !!c.waiting,
    canInvite: !!c.canInvite,
    members: c.members ?? [],
    reads: c.reads ?? [],
    messages: (c.messages ?? []).map(normalizeMessage),
  };
}

export function previewOf(thread: ChatThread): ChatPreview {
  const { members: _members, reads: _reads, messages: _messages, ...preview } = thread;
  return preview;
}

/** Your reaction moves to `emoji`, or is removed when it was already `emoji`. */
export function toggleReaction(m: ChatMessage, emoji: string): ChatMessage {
  const previous = m.reactions.find((r) => r.mine)?.emoji;
  let reactions = m.reactions
    .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
    .filter((r) => r.count > 0);
  if (previous !== emoji) {
    const found = reactions.find((r) => r.emoji === emoji);
    reactions = found
      ? reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
      : [...reactions, { emoji, count: 1, mine: true }];
  }
  return { ...m, reactions };
}

function useDocumentVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

interface Options {
  userId: string;
  displayName: string;
  /** Keep the chat list in step with what the thread learned. */
  onPreview: (preview: ChatPreview) => void;
  onPatch: (id: string, change: Partial<ChatPreview>) => void;
}

/**
 * One open conversation: first page, older pages, polling for changes, read receipts, and an
 * outbox so a message that fails to send is never lost (kept on this device until it's sent
 * or removed).
 */
export function useThread(chatApi: ChatApi, id: string | undefined, options: Options) {
  const { userId, displayName } = options;
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "missing">("idle");
  const [error, setError] = useState("");
  const [before, setBefore] = useState<string | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [syncTrouble, setSyncTrouble] = useState(false);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const visible = useDocumentVisible();
  const since = useRef<string | null>(null);
  const activity = useRef(Date.now());
  const readFor = useRef<string | null>(null);
  const idRef = useRef(id);
  idRef.current = id;
  const callbacks = useRef(options);
  callbacks.current = options;

  const [outbox, setOutbox] = useDraft<Record<string, OutboxItem[]>>(
    accountDraftKey(userId, `chat.outbox.${chatApi.mode}`),
    {},
    { maxAgeDays: 14, delayMs: 0, isEmpty: (all) => Object.values(all).every((list) => !list?.length) },
  );
  const flying = useRef(new Set<string>());
  const [inFlight, setInFlight] = useState<string[]>([]);

  // Load the conversation when it changes. Late answers for a previous chat are ignored.
  useEffect(() => {
    setThread(null);
    setBefore(null);
    setError("");
    setNotice("");
    setSyncTrouble(false);
    since.current = null;
    readFor.current = null;
    if (!id) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    chatApi
      .thread(id, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const c = normalizeThread(data.conversation);
        setThread(c);
        setBefore(data.before ?? null);
        since.current = data.now ?? null;
        activity.current = Date.now();
        // Already read: don't spend a write on it.
        if (!c.unread) readFor.current = lastFromOthers(c.messages)?.id ?? null;
        setStatus("ready");
        callbacks.current.onPreview(previewOf(c));
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 404) setStatus("missing");
        else {
          setError(message(reason, "This chat could not be loaded."));
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [chatApi, id, reloadKey]);

  // Poll for new and changed messages while this chat is open and the tab is visible.
  useEffect(() => {
    if (!id || status !== "ready" || !visible) return;
    let stopped = false;
    let failures = 0;
    let timer = 0;
    let controller: AbortController | null = null;
    const delay = () =>
      failures ? Math.min(30_000, 8_000 * failures) : Date.now() - activity.current < QUIET_AFTER_MS ? FAST_MS : SLOW_MS;
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(tick, ms);
    };
    async function tick() {
      if (stopped || !since.current) return;
      controller = new AbortController();
      try {
        const data = await chatApi.updates(id!, since.current, controller.signal);
        if (stopped) return;
        failures = 0;
        setSyncTrouble(false);
        since.current = data.now ?? since.current;
        const { messages: changed, ...meta } = normalizeThread(data.conversation);
        setThread((old) => {
          if (!old || old.id !== id) return old;
          const known = new Set(old.messages.map((m) => m.id));
          if (changed.some((m) => !known.has(m.id))) activity.current = Date.now();
          return { ...old, ...meta, messages: mergeMessages(old.messages, changed) };
        });
        if (changed.length) callbacks.current.onPreview(previewOf({ ...meta, messages: [] }));
      } catch (reason) {
        if (stopped) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setStatus("missing");
          return;
        }
        failures++;
        if (failures >= 2) setSyncTrouble(true);
      }
      schedule(delay());
    }
    const wake = () => {
      activity.current = Date.now();
      schedule(0);
    };
    window.addEventListener("focus", wake);
    // Coming back to the tab checks straight away.
    schedule(document.hasFocus() ? delay() : 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      window.removeEventListener("focus", wake);
    };
  }, [chatApi, id, status, visible]);

  // Read receipts: once per newest message from someone else, only while you can see it.
  const lastOther = thread ? lastFromOthers(thread.messages) : undefined;
  useEffect(() => {
    if (!thread || thread.request || !lastOther || !visible) return;
    if (readFor.current === lastOther.id) return;
    readFor.current = lastOther.id;
    const chatId = thread.id;
    chatApi
      .read(chatId)
      .then(() => {
        callbacks.current.onPatch(chatId, { unread: false });
        notifyChatsChanged();
      })
      .catch(() => {
        readFor.current = null;
      });
  }, [chatApi, thread?.id, thread?.request, lastOther?.id, visible]);

  const deliver = useCallback(
    async (chatId: string, item: OutboxItem) => {
      if (flying.current.has(item.clientId)) return;
      flying.current.add(item.clientId);
      setInFlight([...flying.current]);
      activity.current = Date.now();
      try {
        const data = await chatApi.send(chatId, item.body, item.clientId, item.replyTo?.id ?? null);
        setOutbox((old) => without(old, chatId, item.clientId));
        setThread((old) =>
          old && old.id === chatId ? { ...old, messages: mergeMessages(old.messages, [normalizeMessage(data.message)]) } : old,
        );
        callbacks.current.onPatch(chatId, {
          lastMessage: data.message.body,
          lastMessageMine: true,
          lastMessageAt: data.message.sentAt,
          unread: false,
        });
      } catch (reason) {
        if (idRef.current === chatId) setNotice(message(reason, "Message not sent. Tap Retry."));
      } finally {
        flying.current.delete(item.clientId);
        setInFlight([...flying.current]);
      }
    },
    [chatApi, setOutbox],
  );

  const send = useCallback(
    (body: string, replyTo: ChatReply | null) => {
      if (!id) return;
      const item: OutboxItem = { clientId: createRequestId(), body, replyTo, at: new Date().toISOString() };
      setNotice("");
      setOutbox((old) => ({ ...old, [id]: [...(old[id] ?? []), item] }));
      void deliver(id, item);
    },
    [deliver, id, setOutbox],
  );
  const retrySend = useCallback(
    (clientId: string) => {
      const item = id ? outbox[id]?.find((o) => o.clientId === clientId) : undefined;
      if (id && item) {
        setNotice("");
        void deliver(id, item);
      }
    },
    [deliver, id, outbox],
  );
  const discard = useCallback(
    (clientId: string) => {
      if (id) setOutbox((old) => without(old, id, clientId));
    },
    [id, setOutbox],
  );

  const react = useCallback(
    async (messageId: string, emoji: string) => {
      if (!thread) return;
      const chatId = thread.id;
      const original = thread.messages.find((m) => m.id === messageId);
      if (!original) return;
      setThread((old) =>
        old && old.id === chatId
          ? { ...old, messages: old.messages.map((m) => (m.id === messageId ? toggleReaction(m, emoji) : m)) }
          : old,
      );
      try {
        const data = await chatApi.react(chatId, messageId, emoji);
        setThread((old) => (old && old.id === chatId ? { ...old, messages: mergeMessages(old.messages, [normalizeMessage(data.message)]) } : old));
      } catch (reason) {
        setThread((old) => (old && old.id === chatId ? { ...old, messages: mergeMessages(old.messages, [original]) } : old));
        if (idRef.current === chatId) setNotice(message(reason, "Reaction not saved. Try again."));
      }
    },
    [chatApi, thread],
  );

  const unsend = useCallback(
    async (messageId: string) => {
      if (!thread) return;
      const chatId = thread.id;
      try {
        const data = await chatApi.unsend(chatId, messageId);
        setThread((old) => (old && old.id === chatId ? { ...old, messages: mergeMessages(old.messages, [normalizeMessage(data.message)]) } : old));
      } catch (reason) {
        if (idRef.current === chatId) setNotice(message(reason, "Message not unsent. Try again."));
      }
    },
    [chatApi, thread],
  );

  const loadOlder = useCallback(async () => {
    if (!id || !before || olderLoading) return;
    const chatId = id;
    setOlderLoading(true);
    try {
      const data = await chatApi.thread(chatId, { before });
      if (idRef.current !== chatId) return;
      setThread((old) =>
        old && old.id === chatId
          ? { ...old, messages: mergeMessages(old.messages, normalizeThread(data.conversation).messages) }
          : old,
      );
      setBefore(data.before ?? null);
    } catch (reason) {
      if (idRef.current === chatId) setNotice(message(reason, "Older messages could not be loaded."));
    } finally {
      if (idRef.current === chatId) setOlderLoading(false);
    }
  }, [before, chatApi, id, olderLoading]);

  // Server messages, then this device's unsent ones.
  const pending = id ? outbox[id] : undefined;
  const messages = useMemo(() => {
    if (!thread) return [];
    const local: ChatMessage[] = (pending ?? []).map((o) => ({
      id: `local-${o.clientId}`,
      clientId: o.clientId,
      senderId: userId,
      from: displayName,
      body: o.body,
      sentAt: o.at,
      mine: true,
      removed: false,
      reactions: [],
      replyTo: o.replyTo,
      status: inFlight.includes(o.clientId) ? "sending" : "failed",
    }));
    return [...thread.messages, ...local];
  }, [thread, pending, inFlight, userId, displayName]);

  return {
    thread,
    setThread,
    messages,
    status,
    error,
    retry: () => setReloadKey((k) => k + 1),
    before,
    olderLoading,
    loadOlder,
    send,
    retrySend,
    discard,
    react,
    unsend,
    notice,
    setNotice,
    syncTrouble,
  };
}
export type ThreadState = ReturnType<typeof useThread>;

function lastFromOthers(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) if (!messages[i].mine) return messages[i];
  return undefined;
}
function without(all: Record<string, OutboxItem[]>, chatId: string, clientId: string) {
  const rest = (all[chatId] ?? []).filter((o) => o.clientId !== clientId);
  const next = { ...all };
  if (rest.length) next[chatId] = rest;
  else delete next[chatId];
  return next;
}
