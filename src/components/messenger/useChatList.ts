import { useCallback, useEffect, useRef, useState } from "react";
import { notifyChatsChanged, type ChatApi } from "./chatApi";
import { toMs } from "./format";
import type { ChatPreview } from "./types";

const LIST_POLL_MS = 25_000;
const byNewest = (list: ChatPreview[]) =>
  [...list].sort((a, b) => toMs(b.lastMessageAt) - toMs(a.lastMessageAt) || a.id.localeCompare(b.id));

/**
 * The chat list. Refreshes every 25 s while the tab is visible (no live connection on the free
 * plan). A failed refresh keeps what's already on screen and only reports `stale`.
 */
export function useChatList(chatApi: ChatApi) {
  const [items, setItems] = useState<ChatPreview[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const loaded = useRef(false);
  const unreadKey = useRef("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await chatApi.list(signal);
        if (signal?.aborted) return;
        loaded.current = true;
        setItems(byNewest(data.conversations));
        setStatus("ready");
        setError("");
        setStale(false);
        const key = data.conversations
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
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const retry = useCallback(() => {
    setStatus((s) => (s === "error" ? "loading" : s));
    void load();
  }, [load]);
  /** Add or replace one chat (e.g. after opening or starting it). */
  const upsert = useCallback(
    (preview: ChatPreview) => setItems((old) => byNewest([preview, ...old.filter((c) => c.id !== preview.id)])),
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
