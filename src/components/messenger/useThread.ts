import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api";
import { notifyChatsChanged, type ChatApi } from "./chatApi";
import { lastFromOthers, mergeMessages, normalizeMessage, normalizeThread, previewOf, toggleReaction } from "./threadModel";
import type { ChatMessage, ChatPreview, ChatThread } from "./types";
import { useOutbox } from "./useOutbox";

export { mergeMessages, normalizeThread, previewOf, toggleReaction } from "./threadModel";

/** Poll quickly while a conversation is active, slower when it goes quiet, never while hidden. */
const FAST_MS = 4_000;
const SLOW_MS = 12_000;
const QUIET_AFTER_MS = 2 * 60_000;
const TYPING_EVERY_MS = 3_000;

const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

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
 * One open conversation: first page, older pages, polling for changes (messages, receipts, typing,
 * who's active), read receipts, and every message action. Sending lives in useOutbox.
 */
export function useThread(chatApi: ChatApi, id: string | undefined, options: Options) {
  const { userId, displayName } = options;
  const [thread, setThread] = useState<ChatThread | null>(null);
  // Actions read the latest thread from here, so they don't change (and re-draw every message) on each poll.
  const threadRef = useRef(thread);
  threadRef.current = thread;
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
  const typingSent = useRef(0);
  const idRef = useRef(id);
  idRef.current = id;
  const callbacks = useRef(options);
  callbacks.current = options;

  const mergeInto = useCallback((chatId: string, incoming: ChatMessage[]) => {
    setThread((old) => (old && old.id === chatId ? { ...old, messages: mergeMessages(old.messages, incoming.map(normalizeMessage)) } : old));
  }, []);

  const outbox = useOutbox(chatApi, id, {
    userId,
    displayName,
    onSent: (chatId, m) => {
      activity.current = Date.now();
      mergeInto(chatId, [m]);
      callbacks.current.onPatch(chatId, {
        lastMessage: m.body || (m.attachment ? (m.attachment.type.startsWith("image/") ? "📷 Photo" : `📎 ${m.attachment.name}`) : ""),
        lastMessageMine: true,
        lastMessageAt: m.sentAt,
        lastStatus: "sent",
        unread: false,
        archived: false,
      });
    },
    onError: (chatId, text) => {
      if (idRef.current === chatId) setNotice(text);
    },
  });

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
        if (meta.typing.length) activity.current = Date.now();
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

  /** Optimistic change to one message, put back if the server says no. */
  const change = useCallback(
    async (messageId: string, local: (m: ChatMessage) => ChatMessage, remote: () => Promise<{ message: ChatMessage }>, failText: string) => {
      const chatId = idRef.current;
      const original = threadRef.current?.messages.find((m) => m.id === messageId);
      if (!chatId || !original) return false;
      mergeInto(chatId, [local(original)]);
      try {
        const data = await remote();
        if (data?.message) mergeInto(chatId, [data.message]);
        return true;
      } catch (reason) {
        mergeInto(chatId, [original]);
        if (idRef.current === chatId) setNotice(message(reason, failText));
        return false;
      }
    },
    [mergeInto],
  );

  const react = useCallback(
    (messageId: string, emoji: string) =>
      change(messageId, (m) => toggleReaction(m, emoji), () => chatApi.react(idRef.current!, messageId, emoji), "Reaction not saved. Try again."),
    [change, chatApi],
  );
  const edit = useCallback(
    (messageId: string, body: string) =>
      change(messageId, (m) => ({ ...m, body, edited: true }), () => chatApi.edit(idRef.current!, messageId, body), "Edit not saved. Try again."),
    [change, chatApi],
  );
  const pin = useCallback(
    async (messageId: string, on: boolean) => {
      const ok = await change(messageId, (m) => ({ ...m, pinned: on }), () => chatApi.pin(idRef.current!, messageId, on), "Couldn't pin that. Try again.");
      if (ok && on) {
        const m = threadRef.current?.messages.find((x) => x.id === messageId);
        if (m)
          setThread((old) =>
            old
              ? {
                  ...old,
                  pinnedMessages: [
                    { id: m.id, from: m.from, body: m.body.slice(0, 160), attachment: m.attachment?.name ?? null, pinnedAt: new Date().toISOString() },
                    ...old.pinnedMessages.filter((p) => p.id !== m.id),
                  ],
                }
              : old,
          );
      }
      if (ok && !on) setThread((old) => (old ? { ...old, pinnedMessages: old.pinnedMessages.filter((p) => p.id !== messageId) } : old));
    },
    [change, chatApi],
  );
  const unsend = useCallback(
    (messageId: string) =>
      change(
        messageId,
        (m) => ({ ...m, removed: true, body: "", attachment: null, reactions: [] }),
        () => chatApi.unsend(idRef.current!, messageId),
        "Message not unsent. Try again.",
      ),
    [change, chatApi],
  );

  /** "Typing…" ping, at most every 3 s while typing; never stored. */
  const typing = useCallback(
    (on: boolean) => {
      const chatId = idRef.current;
      if (!chatId || threadRef.current?.request) return;
      const now = Date.now();
      if (on && now - typingSent.current < TYPING_EVERY_MS) return;
      if (!on && !typingSent.current) return;
      typingSent.current = on ? now : 0;
      void chatApi.typing(chatId, on).catch(() => undefined);
    },
    [chatApi],
  );

  const loadOlder = useCallback(async () => {
    if (!id || !before || olderLoading) return;
    const chatId = id;
    setOlderLoading(true);
    try {
      const data = await chatApi.thread(chatId, { before });
      if (idRef.current !== chatId) return;
      mergeInto(chatId, normalizeThread(data.conversation).messages);
      setBefore(data.before ?? null);
    } catch (reason) {
      if (idRef.current === chatId) setNotice(message(reason, "Older messages could not be loaded."));
    } finally {
      if (idRef.current === chatId) setOlderLoading(false);
    }
  }, [before, chatApi, id, mergeInto, olderLoading]);

  const messages = useMemo(() => (thread ? [...thread.messages, ...outbox.local] : []), [thread, outbox.local]);

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
    send: (body: string, replyTo: Parameters<typeof outbox.sendText>[1]) => {
      typingSent.current = 0;
      outbox.sendText(body, replyTo);
    },
    sendFiles: outbox.sendFiles,
    retrySend: outbox.retry,
    discard: outbox.discard,
    react,
    edit,
    pin,
    unsend,
    typing,
    /** Search this chat on the server (all messages, not just the loaded ones). */
    searchIn: (q: string, signal?: AbortSignal) =>
      chatApi.search(idRef.current!, q, signal).then((d) => (d?.messages ?? []).map(normalizeMessage)),
    notice,
    setNotice,
    syncTrouble,
  };
}
export type ThreadState = ReturnType<typeof useThread>;
