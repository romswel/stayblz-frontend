import { useEffect, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import {
  BREEDS,
  COLORS,
  DISCIPLINES,
  GENDERS,
  TYPES,
  formatAge,
  formatBytes,
  formatDuration,
  formatHands,
  formatPrice,
  labelOf,
  type Listing,
} from "./options";
import { getListing, mediaUrl, pictureUrl, posterUrl } from "./media";
import { PlayIcon } from "./ListingMedia";
import "./marketplace-media.css";

const I = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
const LeftIcon = () => (<svg {...I}><path d="M15 18l-6-6 6-6" /></svg>);
const RightIcon = () => (<svg {...I}><path d="M9 6l6 6-6 6" /></svg>);
const FileIcon = () => (<svg {...I}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>);
const DownloadIcon = () => (<svg {...I} width={16} height={16}><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" /></svg>);
const PinIcon = () => (<svg {...I} width={14} height={14}><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>);

/** A listing's photos (gallery) and documents, opened from a marketplace card. */
export default function ListingDetails({
  listing: summary,
  onClose,
  onEdit,
}: {
  listing: Listing;
  onClose: () => void;
  onEdit?: (listing: Listing) => void;
}) {
  const [state, setState] = useState<{ loading: boolean; error: string; listing: Listing }>({
    loading: true,
    error: "",
    listing: summary,
  });
  const [index, setIndex] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const c = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    getListing(summary.id, c.signal)
      .then((listing) => !c.signal.aborted && setState({ loading: false, error: "", listing }))
      .catch((e) => !c.signal.aborted && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "This listing couldn't be loaded." })));
    return () => c.abort();
  }, [summary.id, reload]);

  const l = state.listing;
  const photos = l.media ?? (l.cover ? [l.cover] : []);
  const documents = l.documents ?? [];
  const current = photos[Math.min(index, Math.max(photos.length - 1, 0))];
  const go = (step: number) => photos.length > 1 && setIndex((i) => (i + step + photos.length) % photos.length);

  // Arrow keys move through the photos (outside text fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, video")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Touch: swipe the main photo left or right.
  const [touchX, setTouchX] = useState<number | null>(null);

  return (
    <Modal label={`${l.name}, ${formatPrice(l.price)}`} className="modal-wide mkm-details-modal" onClose={onClose}>
      <DialogHead kicker={labelOf(TYPES, l.type)} title={l.name} onClose={onClose} />
      <div className="dlg mkm-details">
        <section className="mkm-gallery" aria-label="Photos and videos">
          {current ? (
            <div
              className="mkm-stage"
              onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX === null) return;
                const dx = e.changedTouches[0].clientX - touchX;
                if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
                setTouchX(null);
              }}
            >
              {current.kind === "video" ? (
                <video
                  key={current.id}
                  src={mediaUrl(current.id)}
                  poster={current.poster ? posterUrl(current.id) : undefined}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={`${l.name}, video ${index + 1} of ${photos.length}`}
                />
              ) : (
                <img key={current.id} src={mediaUrl(current.id)} alt={`${l.name}, photo ${index + 1} of ${photos.length}`} />
              )}
              {photos.length > 1 && (
                <>
                  <button type="button" className="mkm-nav is-prev" onClick={() => go(-1)} aria-label="Previous photo">
                    <LeftIcon />
                  </button>
                  <button type="button" className="mkm-nav is-next" onClick={() => go(1)} aria-label="Next photo">
                    <RightIcon />
                  </button>
                  <span className="mkm-stage-count" aria-live="polite">
                    {index + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="mkm-stage is-empty">{state.loading ? "Loading…" : "No photos or videos yet."}</div>
          )}
          {photos.length > 1 && (
            <div className="mkm-thumbs" role="tablist" aria-label="Choose a photo or video">
              {photos.map((p, i) => {
                const picture = pictureUrl(p);
                return (
                  <button
                    type="button"
                    key={p.id}
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`${p.kind === "video" ? "Video" : "Photo"} ${i + 1}`}
                    className={`mkm-thumb${i === index ? " is-active" : ""}${p.kind === "video" ? " is-video" : ""}`}
                    onClick={() => setIndex(i)}
                  >
                    {picture ? <img src={picture} alt="" loading="lazy" /> : <span className="mkm-thumb-blank" />}
                    {p.kind === "video" && (
                      <span className="mkm-thumb-play" aria-hidden="true">
                        <PlayIcon size={12} />
                        {p.duration ? formatDuration(p.duration) : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mkm-info" aria-label="Details">
          <div className="mkm-price-row">
            <strong className="mkm-price">{formatPrice(l.price)}</strong>
            <span className="mkm-loc">
              <PinIcon /> {l.location}
            </span>
          </div>
          <dl className="mkm-facts">
            <div><dt>Breed</dt><dd>{labelOf(BREEDS, l.breed)}</dd></div>
            <div><dt>Discipline</dt><dd>{labelOf(DISCIPLINES, l.discipline)}</dd></div>
            <div><dt>Gender</dt><dd>{labelOf(GENDERS, l.gender)}</dd></div>
            <div><dt>Color</dt><dd>{labelOf(COLORS, l.color)}</dd></div>
            <div><dt>Age</dt><dd>{formatAge(l.age)}</dd></div>
            <div><dt>Height</dt><dd>{formatHands(l.heightIn)}</dd></div>
          </dl>

          <h3 className="mkm-subhead">Documents</h3>
          {state.error ? (
            <p className="mkm-load-error" role="alert">
              <span>{state.error}</span>
              <button type="button" className="btn btn-quiet" onClick={() => setReload((n) => n + 1)}>
                Try again
              </button>
            </p>
          ) : state.loading && !l.documents ? (
            <p className="mkm-muted">Loading…</p>
          ) : documents.length ? (
            <ul className="mkm-docs is-read">
              {documents.map((d) => (
                <li key={d.id} className="mkm-doc">
                  <span className="mkm-doc-icon" aria-hidden="true">
                    <FileIcon />
                  </span>
                  <span className="mkm-doc-text">
                    <b>{d.name}</b>
                    <small>PDF · {formatBytes(d.size)}</small>
                  </span>
                  <a className="mkm-tool" href={mediaUrl(d.id)} download={d.name} aria-label={`Download ${d.name}`} title="Download">
                    <DownloadIcon />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mkm-muted">The seller hasn't added any documents.</p>
          )}

          <p className="mkm-seller">
            {l.mine ? "Listed by you" : <>Listed by <b>{l.sellerName}</b></>}
          </p>
          {l.mine && onEdit && (
            <button type="button" className="btn btn-primary mkm-edit" onClick={() => onEdit(l)}>
              Edit listing
            </button>
          )}
        </section>
      </div>
    </Modal>
  );
}
