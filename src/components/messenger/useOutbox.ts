import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRequestId } from "../../requestId";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import type { ChatApi } from "./chatApi";
import { prepareFile } from "./files";
import type { ChatMessage, ChatReply, OutboxItem } from "./types";

const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

interface FileItem {
  clientId: string;
  chatId: string;
  file: File;
  previewUrl?: string;
  replyTo: ChatReply | null;
  at: string;
}

/**
 * Sending. Text waits in an outbox saved on this device (so a failed send survives a reload) until
 * the server confirms it; files wait in memory with a preview. Retries reuse the same client id,
 * so the server never stores a message twice.
 */
export function useOutbox(
  chatApi: ChatApi,
  id: string | undefined,
  opts: { userId: string; displayName: string; onSent: (chatId: string, m: ChatMessage) => void; onError: (chatId: string, text: string) => void },
) {
  const { userId, displayName } = opts;
  const callbacks = useRef(opts);
  callbacks.current = opts;
  const [texts, setTexts] = useDraft<Record<string, OutboxItem[]>>(
    accountDraftKey(userId, `chat.outbox.${chatApi.mode}`),
    {},
    { maxAgeDays: 14, delayMs: 0, isEmpty: (all) => Object.values(all).every((list) => !list?.length) },
  );
  const [files, setFiles] = useState<FileItem[]>([]);
  const flying = useRef(new Set<string>());
  const [inFlight, setInFlight] = useState<string[]>([]);
  const fly = (clientId: string, on: boolean) => {
    if (on) flying.current.add(clientId);
    else flying.current.delete(clientId);
    setInFlight([...flying.current]);
  };

  // Free photo previews when they're no longer shown.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl)), []);

  const deliverText = useCallback(
    async (chatId: string, item: OutboxItem) => {
      if (flying.current.has(item.clientId)) return;
      fly(item.clientId, true);
      try {
        const data = await chatApi.send(chatId, item.body, item.clientId, item.replyTo?.id ?? null);
        setTexts((old) => without(old, chatId, item.clientId));
        callbacks.current.onSent(chatId, data.message);
      } catch (reason) {
        callbacks.current.onError(chatId, message(reason, "Message not sent. Tap Retry."));
      } finally {
        fly(item.clientId, false);
      }
    },
    [chatApi, setTexts],
  );

  const deliverFile = useCallback(
    async (item: FileItem) => {
      if (flying.current.has(item.clientId)) return;
      fly(item.clientId, true);
      try {
        const ready = await prepareFile(item.file);
        const data = await chatApi.upload(item.chatId, ready.blob, {
          name: ready.name,
          type: ready.type,
          clientId: item.clientId,
          replyTo: item.replyTo?.id ?? null,
          width: ready.width,
          height: ready.height,
        });
        setFiles((old) => old.filter((f) => f.clientId !== item.clientId));
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        callbacks.current.onSent(item.chatId, data.message);
      } catch (reason) {
        callbacks.current.onError(item.chatId, message(reason, "File not sent. Tap Retry."));
      } finally {
        fly(item.clientId, false);
      }
    },
    [chatApi],
  );

  const sendText = useCallback(
    (body: string, replyTo: ChatReply | null) => {
      if (!id) return;
      const item: OutboxItem = { clientId: createRequestId(), body, replyTo, at: new Date().toISOString() };
      setTexts((old) => ({ ...old, [id]: [...(old[id] ?? []), item] }));
      void deliverText(id, item);
    },
    [deliverText, id, setTexts],
  );

  const sendFiles = useCallback(
    (list: File[], replyTo: ChatReply | null) => {
      if (!id) return;
      if (list.length > 10) callbacks.current.onError(id, `Up to 10 files at a time. Sending the first 10 of ${list.length}.`);
      const items: FileItem[] = list.slice(0, 10).map((file, i) => ({
        clientId: createRequestId(),
        chatId: id,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        replyTo: i === 0 ? replyTo : null,
        at: new Date(Date.now() + i).toISOString(),
      }));
      setFiles((old) => [...old, ...items]);
      items.forEach((item) => void deliverFile(item));
    },
    [deliverFile, id],
  );

  const retry = useCallback(
    (clientId: string) => {
      const text = id ? texts[id]?.find((o) => o.clientId === clientId) : undefined;
      if (id && text) return void deliverText(id, text);
      const file = files.find((f) => f.clientId === clientId);
      if (file) void deliverFile(file);
    },
    [deliverFile, deliverText, files, id, texts],
  );
  const discard = useCallback(
    (clientId: string) => {
      if (id) setTexts((old) => without(old, id, clientId));
      setFiles((old) => {
        const gone = old.find((f) => f.clientId === clientId);
        if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
        return old.filter((f) => f.clientId !== clientId);
      });
    },
    [id, setTexts],
  );

  /** This chat's unsent messages, shaped like messages so the timeline can show them. */
  const pendingText = id ? texts[id] : undefined;
  const local = useMemo<ChatMessage[]>(() => {
    if (!id) return [];
    const base = { senderId: userId, from: displayName, mine: true, removed: false, edited: false, forwarded: false, system: false, pinned: false, reactions: [] };
    const fromText = (pendingText ?? []).map<ChatMessage>((o) => ({
      ...base,
      id: `local-${o.clientId}`,
      clientId: o.clientId,
      body: o.body,
      sentAt: o.at,
      attachment: null,
      replyTo: o.replyTo,
      status: inFlight.includes(o.clientId) ? "sending" : "failed",
    }));
    const fromFiles = files
      .filter((f) => f.chatId === id)
      .map<ChatMessage>((f) => ({
        ...base,
        id: `local-${f.clientId}`,
        clientId: f.clientId,
        body: "",
        sentAt: f.at,
        attachment: { name: f.file.name, size: f.file.size, type: f.file.type || "application/octet-stream" },
        file: f.file,
        previewUrl: f.previewUrl,
        replyTo: f.replyTo,
        status: inFlight.includes(f.clientId) ? "sending" : "failed",
      }));
    return [...fromText, ...fromFiles].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }, [id, pendingText, files, inFlight, userId, displayName]);

  return { sendText, sendFiles, retry, discard, local };
}

function without(all: Record<string, OutboxItem[]>, chatId: string, clientId: string) {
  const rest = (all[chatId] ?? []).filter((o) => o.clientId !== clientId);
  const next = { ...all };
  if (rest.length) next[chatId] = rest;
  else delete next[chatId];
  return next;
}
