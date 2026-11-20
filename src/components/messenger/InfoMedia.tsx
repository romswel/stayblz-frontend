import { useEffect, useState } from "react";
import AttachmentView from "./AttachmentView";
import { MediaTile } from "./MediaViewer";
import type { ChatApi } from "./chatApi";
import { clock, dayLabel, isAudio, isImage, isVideo } from "./format";
import { ArrowLeftIcon, LinkIcon } from "./icons";
import { normalizeMessage } from "./threadModel";
import type { ChatMessage } from "./types";

export type MediaTab = "media" | "files" | "voice" | "links";
const TABS: { key: MediaTab; label: string }[] = [
  { key: "media", label: "Media" },
  { key: "files", label: "Files" },
  { key: "voice", label: "Voice" },
  { key: "links", label: "Links" },
];
const LINK = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Chat info → "Media, files and links": photos & videos in a grid, files, voice clips, and shared links. */
export default function InfoMedia({
  chatId,
  chatApi,
  tab,
  onTab,
  onBack,
  onJump,
  onOpenImage,
  fileLoader,
  refreshKey,
}: {
  chatId: string;
  chatApi: ChatApi;
  tab: MediaTab;
  onTab: (tab: MediaTab) => void;
  onBack: () => void;
  onJump: (id: string) => void;
  onOpenImage: (m: ChatMessage, url: string, list?: ChatMessage[]) => void;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
  /** Changes when the chat gains or loses a file, so the lists reload. */
  refreshKey: number;
}) {
  const [media, setMedia] = useState<ChatMessage[] | null>(null);
  const [links, setLinks] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const c = new AbortController();
    setError("");
    chatApi
      .media(chatId, c.signal)
      .then((d) => !c.signal.aborted && setMedia((d?.messages ?? []).map(normalizeMessage)))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Media couldn't be loaded."));
    return () => c.abort();
  }, [chatApi, chatId, refreshKey]);
  useEffect(() => {
    if (tab !== "links" || links) return;
    const c = new AbortController();
    chatApi
      .links(chatId, c.signal)
      .then((d) => !c.signal.aborted && setLinks((d?.messages ?? []).map(normalizeMessage)))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Links couldn't be loaded."));
    return () => c.abort();
  }, [chatApi, chatId, tab, links]);

  const all = media ?? [];
  const visual = all.filter((m) => m.attachment && (isImage(m.attachment.type) || isVideo(m.attachment.type)));
  const files = all.filter((m) => m.attachment && !isImage(m.attachment.type) && !isVideo(m.attachment.type) && !isAudio(m.attachment.type));
  const voice = all.filter((m) => m.attachment && isAudio(m.attachment.type));
  const loading = tab === "links" ? !links && !error : !media && !error;

  return (
    <div className="mx-info-sub">
      <div className="mx-info-subhead">
        <button type="button" className="mx-icon-btn" aria-label="Back to chat info" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <h3>Media, files and links</h3>
      </div>
      <div className="mx-seg mx-info-tabs" role="tablist" aria-label="Show">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mx-info-subbody">
        {error && <p className="form-error">{error}</p>}
        {loading && <p className="mx-hint" role="status">Loading…</p>}
        {tab === "media" && media && (
          visual.length ? (
            <div className="mx-media-grid">
              {visual.map((m) => (
                <MediaTile key={m.id} m={m} load={fileLoader(m)} onOpen={() => onOpenImage(m, "", visual)} />
              ))}
            </div>
          ) : (
            <p className="mx-hint">No photos or videos yet.</p>
          )
        )}
        {tab === "files" && media && (
          files.length ? (
            <div className="mx-info-files">
              {files.map((m) => (
                <AttachmentView key={m.id} a={m.attachment!} fileKey={m.id} load={fileLoader(m)} onOpenImage={() => undefined} onError={setError} />
              ))}
            </div>
          ) : (
            <p className="mx-hint">No files yet.</p>
          )
        )}
        {tab === "voice" && media && (
          voice.length ? (
            <ul className="mx-info-voice">
              {voice.map((m) => (
                <li key={m.id}>
                  <small>
                    {m.mine ? "You" : m.from} · {dayLabel(m.sentAt)} {clock(m.sentAt)}
                  </small>
                  <AttachmentView a={m.attachment!} fileKey={m.id} load={fileLoader(m)} onOpenImage={() => undefined} onError={setError} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mx-hint">No voice clips yet.</p>
          )
        )}
        {tab === "links" && links && (
          links.length ? (
            <ul className="mx-info-links">
              {links.flatMap((m) =>
                [...m.body.matchAll(LINK)].map((match, i) => {
                  let host = match[0];
                  try {
                    host = new URL(match[0]).host.replace(/^www\./, "");
                  } catch {
                    /* keep the raw text */
                  }
                  return (
                    <li key={`${m.id}-${i}`}>
                      <span className="mx-link-icon">
                        <LinkIcon />
                      </span>
                      <span className="mx-link-text">
                        <a href={match[0]} target="_blank" rel="noopener noreferrer nofollow">
                          {host}
                        </a>
                        <small>{match[0]}</small>
                      </span>
                      <button type="button" className="mx-pill" onClick={() => onJump(m.id)}>
                        Show
                      </button>
                    </li>
                  );
                }),
              )}
            </ul>
          ) : (
            <p className="mx-hint">No links shared yet.</p>
          )
        )}
      </div>
    </div>
  );
}
