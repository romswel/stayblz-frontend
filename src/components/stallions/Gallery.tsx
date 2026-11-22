import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { stallionMediaUrl, stallionPicture } from "./api";
import { CrestIcon } from "./StallionCard";
import type { StallionProfile } from "./types";

type Item = StallionProfile["media"][number];

/**
 * A stallion's photos and videos: one large picture with thumbnails, and a full-screen view that always has a way
 * out (boss's report: a photo that can't be closed without force-closing the app). Close button, Escape, a tap on
 * the dark area and the phone's Back button all close it.
 */
export default function Gallery({ media, name }: { media: Item[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const current = media[Math.min(index, media.length - 1)];
  if (!media.length)
    return (
      <div className="st-gallery is-empty gx-glass">
        <CrestIcon size={56} />
        <p>No photos or videos yet.</p>
      </div>
    );
  return (
    <div className="st-gallery">
      <button type="button" className="st-gallery-main gx-glass" onClick={() => setOpen(true)} aria-label={`Open ${current.kind} ${index + 1} of ${media.length} full screen`}>
        <Picture item={current} name={name} />
        {current.kind === "video" && <span className="st-play" aria-hidden="true">▶</span>}
        <span className="st-gallery-count">
          {index + 1} / {media.length}
        </span>
      </button>
      {media.length > 1 && (
        <ul className="st-thumbs" aria-label="Photos and videos">
          {media.map((m, i) => (
            <li key={m.id}>
              <button type="button" className={i === index ? "is-on" : undefined} aria-current={i === index} aria-label={`${m.kind === "video" ? "Video" : "Photo"} ${i + 1}`} onClick={() => setIndex(i)}>
                <Picture item={m} name={name} thumb />
                {m.kind === "video" && <span className="st-play is-small" aria-hidden="true">▶</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <Viewer media={media} start={index} name={name} onClose={(i) => { setIndex(i); setOpen(false); }} />}
    </div>
  );
}

function Picture({ item, name, thumb = false }: { item: Item; name: string; thumb?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = stallionPicture(item);
  if (!src || broken) return <span className="st-picture-blank"><CrestIcon size={thumb ? 22 : 48} /></span>;
  return <img src={src} alt={thumb ? "" : `${name}${item.kind === "video" ? " (video)" : ""}`} loading={thumb ? "lazy" : "eager"} decoding="async" onError={() => setBroken(true)} />;
}

function Viewer({ media, start, name, onClose }: { media: Item[]; start: number; name: string; onClose: (index: number) => void }) {
  const [i, setI] = useState(start);
  const close = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const indexRef = useRef(i);
  indexRef.current = i;
  // Stable on purpose: re-rendering the page must not re-add the history entry below.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closed = useCallback(() => onCloseRef.current(indexRef.current), []);
  // Closing steps back over the history entry the viewer added (so Back and Close behave the same).
  const done = useCallback(() => {
    if (window.history.state?.stallionViewer) window.history.back();
    else closed();
  }, [closed]);
  const go = (step: number) => setI((n) => (n + step + media.length) % media.length);
  const item = media[i];

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    // The phone's Back button closes the viewer instead of leaving the page (added once, even if this runs twice).
    if (!window.history.state?.stallionViewer) window.history.pushState({ ...(window.history.state ?? {}), stallionViewer: true }, "");
    window.addEventListener("popstate", closed);
    return () => {
      window.removeEventListener("popstate", closed);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [closed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") done();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, media.length]);

  return createPortal(
    <div
      className="st-viewer gx-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`${name}: ${item.kind} ${i + 1} of ${media.length}`}
      onClick={(e) => e.target === e.currentTarget && done()}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (dy > 90 && Math.abs(dy) > Math.abs(dx)) done();
        else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="st-viewer-bar">
        <span>
          {i + 1} / {media.length}
        </span>
        <button ref={close} type="button" className="st-viewer-close" onClick={done} aria-label="Close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          <span>Close</span>
        </button>
      </div>
      <div className="st-viewer-stage" onClick={(e) => e.target === e.currentTarget && done()}>
        {item.kind === "video" ? (
          <video key={item.id} src={stallionMediaUrl(item.id)} poster={item.poster ? `${stallionMediaUrl(item.id)}/poster` : undefined} controls playsInline autoPlay preload="metadata" />
        ) : (
          <img key={item.id} src={stallionMediaUrl(item.id)} alt={`${name}, photo ${i + 1}`} />
        )}
      </div>
      {media.length > 1 && (
        <>
          <button type="button" className="st-viewer-nav is-prev" onClick={() => go(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="st-viewer-nav is-next" onClick={() => go(1)} aria-label="Next">
            ›
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
