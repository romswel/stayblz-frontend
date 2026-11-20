import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useFileUrl } from "./AttachmentView";
import { gifUrl } from "./chatMarkdown";
import { cachedFileUrl } from "./files";
import { clock, dayLabel, isImage, isVideo } from "./format";
import { ArrowLeftIcon, CloseIcon, DownloadIcon } from "./icons";
import type { ChatMessage } from "./types";

type Loader = () => Promise<Blob>;
export interface ViewerItem {
  id: string;
  kind: "image" | "video" | "gif";
  name: string;
  message: ChatMessage;
  /** A ready picture: a GIF's link, or your own just-sent file still in memory. */
  src?: string;
}

/** The photos, videos and GIFs among these messages, oldest first (what the viewer steps through). */
export function mediaItems(messages: ChatMessage[]): ViewerItem[] {
  const out: ViewerItem[] = [];
  for (const m of messages) {
    if (m.removed || m.system || m.status === "failed") continue;
    const a = m.attachment;
    if (a && (isImage(a.type) || isVideo(a.type))) out.push({ id: m.id, kind: isVideo(a.type) ? "video" : "image", name: a.name, message: m, src: m.previewUrl });
    else if (!a) {
      const gif = gifUrl(m.body);
      if (gif) out.push({ id: m.id, kind: "gif", name: "GIF", message: m, src: gif });
    }
  }
  return out;
}

const MAX_ZOOM = 6;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
interface View {
  s: number;
  x: number;
  y: number;
}
const FIT: View = { s: 1, x: 0, y: 0 };

/**
 * Full-window viewer for a chat's photos, videos and GIFs: Previous / Next (buttons, ← →, swipe), zoom (buttons,
 * + / − / 0, mouse wheel, pinch, double-click or double-tap) and drag to look around while zoomed. Swipe down or
 * Escape closes it. Opened from a photo in the chat, a GIF, the pinned list, or Chat info → Media.
 */
export default function MediaViewer({
  items,
  startId,
  fileLoader,
  onClose,
  onDownload,
  onShowInChat,
}: {
  items: ViewerItem[];
  startId: string;
  fileLoader: (m: ChatMessage) => Loader | null;
  onClose: () => void;
  onDownload?: (m: ChatMessage) => void;
  /** Close the viewer and scroll the chat to this message. */
  onShowInChat?: (m: ChatMessage) => void;
}) {
  // Follow the item by id, so older messages loading in (or new ones arriving) never swap the picture you're on.
  const [currentId, setCurrentId] = useState(startId);
  const found = items.findIndex((i) => i.id === currentId);
  const index = found >= 0 ? found : 0;
  const [view, setView] = useState<View>(FIT);
  const [swipe, setSwipe] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLImageElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const item = items[Math.min(index, items.length - 1)];
  const count = items.length;
  const zoomable = !!item && item.kind !== "video";

  const go = useCallback(
    (step: number) => {
      const next = items[clamp(index + step, 0, items.length - 1)];
      if (next) setCurrentId(next.id);
      setView(FIT);
    },
    [items, index],
  );

  /** Keeps the zoomed picture from being dragged off the screen. */
  const fit = useCallback((v: View): View => {
    const img = media.current;
    const box = stage.current;
    if (v.s <= 1.001 || !img || !box) return FIT;
    const maxX = Math.max(0, (img.offsetWidth * v.s - box.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * v.s - box.clientHeight) / 2);
    return { s: v.s, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
  }, []);
  /** Zoom by `factor`, keeping the point under (clientX, clientY) — or the middle — where it is. */
  const zoomBy = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const box = stage.current?.getBoundingClientRect();
      setView((v) => {
        const s = clamp(v.s * factor, 1, MAX_ZOOM);
        if (!box) return { ...v, s };
        const px = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2);
        const py = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2);
        return fit({ s, x: px - (px - v.x) * (s / v.s), y: py - (py - v.y) * (s / v.s) });
      });
    },
    [fit],
  );
  const toggleZoom = (clientX?: number, clientY?: number) => {
    if (!zoomable) return;
    if (viewRef.current.s > 1.05) setView(FIT);
    else zoomBy(2.5, clientX, clientY);
  };

  // Open: lock the page, focus Close, keys; close: give focus back.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      before?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest?.("input, textarea");
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if (typing) return;
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if ((e.key === "+" || e.key === "=") && zoomable) zoomBy(1.25);
      else if (e.key === "-" && zoomable) zoomBy(0.8);
      else if (e.key === "0") setView(FIT);
      else if (e.key === "Tab") {
        // Keep focus inside the viewer.
        const list = Array.from(root.current?.querySelectorAll<HTMLElement>("button:not([disabled]), video, [tabindex='0']") ?? []);
        if (!list.length) return;
        const at = list.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && at <= 0) {
          e.preventDefault();
          list[list.length - 1].focus();
        } else if (!e.shiftKey && at === list.length - 1) {
          e.preventDefault();
          list[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [go, onClose, zoomBy, zoomable]);
  // Mouse wheel / trackpad pinch zooms (a non-passive listener, so the page doesn't scroll instead).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!zoomable) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, zoomable]);
  // Have the neighbours ready, so Next is instant.
  useEffect(() => {
    for (const n of [index - 1, index + 1]) {
      const it = items[n];
      if (!it || it.kind !== "image" || it.src) continue;
      const load = fileLoader(it.message);
      if (load) void cachedFileUrl(it.id, load).catch(() => undefined);
    }
  }, [index, items, fileLoader]);
  useEffect(() => {
    if (!items.length) onClose();
  }, [items.length, onClose]);

  // Touch and mouse: drag to look around when zoomed, pinch to zoom, swipe to change or close, double-tap to zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: "pan" | "pinch" | "swipe"; x: number; y: number; view: View; dist: number; moved: boolean } | null>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element).closest("button, video, a")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && zoomable) {
      const s = spread();
      gesture.current = { kind: "pinch", x: s.x, y: s.y, view: viewRef.current, dist: s.dist || 1, moved: true };
      setSwipe({ x: 0, y: 0 });
    } else if (pointers.current.size === 1) {
      gesture.current = { kind: viewRef.current.s > 1.01 ? "pan" : "swipe", x: e.clientX, y: e.clientY, view: viewRef.current, dist: 0, moved: false };
    }
    setMoving(true);
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) > 6) g.moved = true;
    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const s = spread();
      const box = stage.current?.getBoundingClientRect();
      const scale = clamp(g.view.s * (s.dist / g.dist), 1, MAX_ZOOM);
      if (!box) return;
      const px = g.x - (box.left + box.width / 2);
      const py = g.y - (box.top + box.height / 2);
      setView(fit({ s: scale, x: px - (px - g.view.x) * (scale / g.view.s) + (s.x - g.x), y: py - (py - g.view.y) * (scale / g.view.s) + (s.y - g.y) }));
    } else if (g.kind === "pan") {
      setView(fit({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy }));
    } else if (g.kind === "swipe" && e.pointerType !== "mouse") {
      setSwipe(Math.abs(dx) > Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: Math.max(0, dy) });
    }
  }
  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 1 && g?.kind === "pinch") {
      // One finger left after a pinch: carry on as a drag from here.
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: "pan", x: p.x, y: p.y, view: viewRef.current, dist: 0, moved: true };
      return;
    }
    if (pointers.current.size) return;
    gesture.current = null;
    setMoving(false);
    setSwipe({ x: 0, y: 0 });
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.kind === "swipe" && g.moved && e.pointerType !== "mouse") {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      else if (dy > 110 && dy > Math.abs(dx)) onClose();
      return;
    }
    // Double-tap (touch) zooms in or back out where you tapped.
    if (!g.moved && e.pointerType !== "mouse") {
      const now = Date.now();
      const last = lastTap.current;
      if (now - last.t < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
        lastTap.current = { t: 0, x: 0, y: 0 };
        toggleZoom(e.clientX, e.clientY);
      } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  if (!item) return null;
  const m = item.message;
  const who = m.mine ? "You" : m.from;
  const kindLabel = item.kind === "video" ? "Video" : item.kind === "gif" ? "GIF" : "Photo";
  const zoomPct = Math.round(view.s * 100);

  return createPortal(
    <div
      ref={root}
      className="mx-viewer mx-layer gx-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`${kindLabel} ${index + 1} of ${count}, from ${who}`}
    >
      <div className="mx-viewer-bar">
        <div className="mx-viewer-title">
          <strong>{who}</strong>
          <small>
            {dayLabel(m.sentAt)} · {clock(m.sentAt)}
            {count > 1 ? ` · ${index + 1} of ${count}` : ""}
          </small>
        </div>
        <div className="mx-viewer-tools">
          {zoomable && (
            <span className="mx-viewer-zoom" role="group" aria-label="Zoom">
              <button type="button" aria-label="Zoom out" title="Zoom out (−)" disabled={view.s <= 1} onClick={() => zoomBy(1 / 1.5)}>
                <MinusGlyph />
              </button>
              <button type="button" className="mx-viewer-pct" aria-label={`Zoom ${zoomPct}%. Reset`} title="Fit to screen (0)" onClick={() => setView(FIT)}>
                {zoomPct}%
              </button>
              <button type="button" aria-label="Zoom in" title="Zoom in (+)" disabled={view.s >= MAX_ZOOM} onClick={() => zoomBy(1.5)}>
                <PlusGlyph />
              </button>
            </span>
          )}
          {onShowInChat && (
            <button type="button" className="mx-viewer-btn is-text" onClick={() => onShowInChat(m)}>
              Show in chat
            </button>
          )}
          {onDownload && item.kind !== "gif" && !m.status && (
            <button type="button" className="mx-viewer-btn" aria-label="Download" title="Download" onClick={() => onDownload(m)}>
              <DownloadIcon />
            </button>
          )}
          <button ref={closeBtn} type="button" className="mx-viewer-btn" aria-label="Close viewer" title="Close (Esc)" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        ref={stage}
        className={`mx-viewer-stage${view.s > 1.01 ? " is-zoomed" : ""}${moving ? " is-moving" : ""}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => {
          if ((e.target as Element).closest("button, video")) return;
          toggleZoom(e.clientX, e.clientY);
        }}
      >
        <div
          className="mx-viewer-slide"
          style={swipe.x || swipe.y ? { transform: `translate3d(${swipe.x}px, ${swipe.y}px, 0)`, opacity: 1 - Math.min(0.5, swipe.y / 400) } : undefined}
        >
          <Slide key={item.id} item={item} load={item.src ? null : fileLoader(m)} view={view} mediaRef={media} />
        </div>
      </div>

      {count > 1 && (
        <>
          <button type="button" className="mx-viewer-nav is-prev" aria-label="Previous" title="Previous (←)" disabled={index === 0} onClick={() => go(-1)}>
            <ArrowLeftIcon />
          </button>
          <button type="button" className="mx-viewer-nav is-next" aria-label="Next" title="Next (→)" disabled={index === count - 1} onClick={() => go(1)}>
            <ArrowLeftIcon />
          </button>
        </>
      )}
      <p className="mx-viewer-hint" aria-hidden="true">
        {zoomable ? "Pinch or double-tap to zoom · drag to look around" : ""}
      </p>
    </div>,
    document.body,
  );
}

function Slide({ item, load, view, mediaRef }: { item: ViewerItem; load: Loader | null; view: View; mediaRef: MutableRefObject<HTMLImageElement | null> }) {
  const { url, failed } = useFileUrl(item.src ? null : item.id, load, item.src);
  const [ready, setReady] = useState(false);
  if (failed || (!url && !load && !item.src))
    return <p className="mx-viewer-msg">This {item.kind === "video" ? "video" : "photo"} isn't available.</p>;
  if (!url) return <i className="mx-spinner mx-viewer-spin" role="status" aria-label="Loading" />;
  if (item.kind === "video")
    return <video className="mx-viewer-media" src={url} controls playsInline autoPlay aria-label={`Video: ${item.name}`} />;
  return (
    <>
      {!ready && <i className="mx-spinner mx-viewer-spin" aria-hidden="true" />}
      <img
        ref={mediaRef}
        className={`mx-viewer-media${ready ? " is-ready" : ""}`}
        src={url}
        alt={item.kind === "gif" ? "GIF" : item.name}
        draggable={false}
        referrerPolicy="no-referrer"
        onLoad={() => setReady(true)}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})` }}
      />
    </>
  );
}

/** A square in Chat info → Media: the photo, or a video's cover with its length (nothing downloads until opened). */
export function MediaTile({ m, load, onOpen }: { m: ChatMessage; load: Loader | null; onOpen: () => void }) {
  const a = m.attachment;
  const video = !!a && isVideo(a.type);
  const { url, failed } = useFileUrl(video ? null : m.id, video ? null : load);
  if (!a) return null;
  return (
    <button
      type="button"
      className={`mx-tile${video ? " is-video" : ""}${url ? " is-ready" : ""}`}
      aria-label={`${video ? "Video" : "Photo"}: ${a.name}. Open`}
      onClick={onOpen}
    >
      {!video && url && <img src={url} alt="" loading="lazy" decoding="async" draggable={false} />}
      {!video && failed && <span className="mx-tile-note">Unavailable</span>}
      {video && (
        <span className="mx-tile-play" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          {a.duration ? <small>{`${Math.floor(a.duration / 60)}:${String(a.duration % 60).padStart(2, "0")}`}</small> : null}
        </span>
      )}
    </button>
  );
}

const PlusGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const MinusGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);
