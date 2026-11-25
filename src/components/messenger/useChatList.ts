import { useCallback, useEffect, useRef, useState } from "react";
import { notifyChatsChanged, type ChatApi } from "./chatApi";
import { activityAt, toMs } from "./format";
import type { ChatPreview } from "./types";

const LIST_POLL_MS = 25_000;
/** Newest activity first: a reaction moves a chat up like a message does. */
const byNewest = (list: ChatPreview[]) =>
  [...list].sort((a, b) => toMs(activityAt(b)) - toMs(activityAt(a)) || a.id.localeCompare(b.id));

/**
 * The chat list. Refreshes every 25 s while the tab is visible (no live connection on the free
 * plan). A failed refresh keeps what's already on screen and only reports `stale`.
 * `isOpenAndRead(id)`: the chat you're looking at. A refresh that lands before the server has recorded that you read
 * it (or a thread answer from just before) must not bring its unread highlight back.
 */
export function useChatList(chatApi: ChatApi, isOpenAndRead: (id: string) => boolean = () => false) {
  const [items, setItems] = useState<ChatPreview[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const loaded = useRef(false);
  const unreadKey = useRef("");
  const openRef = useRef(isOpenAndRead);
  openRef.current = isOpenAndRead;
  const keepRead = (c: ChatPreview) => (c.unread && !c.request && openRef.current(c.id) ? { ...c, unread: false } : c);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await chatApi.list(signal);
        if (signal?.aborted) return;
        loaded.current = true;
        const rows = (Array.isArray(data?.conversations) ? data.conversations : []).map(keepRead);
        setItems(byNewest(rows));
        setStatus("ready");
        setError("");
        setStale(false);
        const key = rows
          .filter((c) => c.unread || c.request)
          .map((c) => c.id)
          .join();
        if (key !== unreadKey.current) {
          unreadKey.current = key;
          notifyChatsChanged();
        }
      } catch (reason) {
        if (signal?.aborted) return;
        const message = reason instanceof Error ? reason.message : "Chats could not be loaded.";
        if (loaded.current) setStale(true);
        else {
          setStatus("error");
          setError(message);
        }
      }
    },
    // keepRead reads the latest choice through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatApi],
  );

  useEffect(() => {
    const controller = new AbortController();
    loaded.current = false;
    setItems([]);
    setStatus("loading");
    void load(controller.signal);
    const refresh = () => {
      if (!document.hidden) void load(controller.signal);
    };
    const timer = window.setInterval(refresh, LIST_POLL_MS);
    // The site-wide poll saw something new (a message in another chat, a request…): refresh now.
    let soon = 0;
    const activity = () => {
      window.clearTimeout(soon);
      soon = window.setTimeout(refresh, 250);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("stayblz:chat-activity", activity);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(soon);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("stayblz:chat-activity", activity);
    };
  }, [load]);

  const retry = useCallback(() => {
    setStatus((s) => (s === "error" ? "loading" : s));
    void load();
  }, [load]);
  /** Add or update one chat (e.g. after opening or starting it). Fields the update doesn't carry are kept. */
  const upsert = useCallback(
    (preview: ChatPreview) =>
      setItems((old) => {
        const before = old.find((c) => c.id === preview.id);
        return byNewest([keepRead({ ...before, ...preview }), ...old.filter((c) => c.id !== preview.id)]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const patch = useCallback(
    (id: string, change: Partial<ChatPreview>) =>
      setItems((old) => byNewest(old.map((c) => (c.id === id ? { ...c, ...change } : c)))),
    [],
  );
  const remove = useCallback((id: string) => setItems((old) => old.filter((c) => c.id !== id)), []);

  return { items, status, error, stale, retry, upsert, patch, remove };
}
