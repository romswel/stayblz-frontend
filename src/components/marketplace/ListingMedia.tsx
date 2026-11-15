import { useEffect, useRef, useState, type DragEvent } from "react";
import { MAX_DOCUMENTS, MAX_PHOTOS, MAX_VIDEOS, formatBytes, formatDuration, type ListingMedia } from "./options";
import {
  MAX_VIDEO_BYTES,
  megabytes,
  mediaUrl,
  pictureUrl,
  uploadDocument,
  uploadLimits,
  uploadPhoto,
  uploadVideo,
  videoType,
  type UploadedFile,
} from "./media";

/** The biggest video the server takes right now (50 MB until files move to R2, then 100 MB). */
function useVideoLimit() {
  const [bytes, setBytes] = useState(MAX_VIDEO_BYTES);
  useEffect(() => {
    let live = true;
    void uploadLimits().then((l) => live && setBytes(l.videoBytes));
    return () => {
      live = false;
    };
  }, []);
  return bytes;
}

/** One photo, video or document in the form: already saved, uploading, or failed. */
export type MediaItem = {
  key: string;
  kind: "photo" | "video" | "document";
  /** Set once the server has the file. */
  id?: string;
  status: "ready" | "uploading" | "error";
  /** 0 to 1 while uploading. */
  progress?: number;
  /** Picture to show: a local preview while uploading (object URL), else the API address. */
  preview?: string;
  /** Videos: a local object URL to play before it's saved. */
  localVideo?: string;
  duration?: number | null;
  name: string;
  size: number;
  error?: string;
  /** Uploaded in this form session and not saved yet (removed again on Cancel). */
  fresh?: boolean;
};

let counter = 0;
const left = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const nextKey = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export const savedMedia = (m: ListingMedia): MediaItem => ({
  key: m.id,
  id: m.id,
  kind: m.kind,
  status: "ready",
  preview: pictureUrl(m) ?? undefined,
  duration: m.duration ?? null,
  name: "",
  size: 0,
});
export const savedDocument = (d: { id: string; name: string; size: number }): MediaItem => ({
  key: d.id,
  id: d.id,
  kind: "document",
  status: "ready",
  name: d.name,
  size: d.size,
});

const I = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
const CameraIcon = () => (<svg {...I} width={22} height={22}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>);
const FileIcon = () => (<svg {...I} width={18} height={18}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>);
const LeftIcon = () => (<svg {...I} width={14} height={14}><path d="M15 18l-6-6 6-6" /></svg>);
const RightIcon = () => (<svg {...I} width={14} height={14}><path d="M9 6l6 6-6 6" /></svg>);
const StarIcon = () => (<svg {...I} width={14} height={14}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>);
const CloseIcon = () => (<svg {...I} width={14} height={14}><path d="M18 6 6 18M6 6l12 12" /></svg>);
const PlusIcon = () => (<svg {...I} width={14} height={14}><path d="M12 5v14M5 12h14" /></svg>);
export const PlayIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...I} width={size} height={size} fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
);

function useUploader(items: MediaItem[], setItems: (update: (items: MediaItem[]) => MediaItem[]) => void) {
  // Object URLs are freed when an item leaves the list or the form closes.
  const urls = useRef(new Map<string, string[]>());
  useEffect(() => {
    const live = new Set(items.map((i) => i.key));
    for (const [key, list] of urls.current)
      if (!live.has(key)) {
        list.forEach((u) => URL.revokeObjectURL(u));
        urls.current.delete(key);
      }
  }, [items]);
  useEffect(() => () => urls.current.forEach((list) => list.forEach((u) => URL.revokeObjectURL(u))), []);

  const patch = (key: string, change: Partial<MediaItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));

  return function add(file: File, kind: MediaItem["kind"]) {
    const key = nextKey();
    const made: string[] = [];
    let preview: string | undefined;
    let localVideo: string | undefined;
    if (kind === "photo") made.push((preview = URL.createObjectURL(file)));
    if (kind === "video") made.push((localVideo = URL.createObjectURL(file)));
    urls.current.set(key, made);
    setItems((list) => [...list, { key, kind, status: "uploading", progress: 0, preview, localVideo, name: file.name, size: file.size }]);
    const onProgress = (p: number) => patch(key, { progress: p });
    const upload: Promise<UploadedFile> =
      kind === "photo" ? uploadPhoto(file, onProgress) : kind === "video" ? uploadVideo(file, onProgress) : uploadDocument(file, onProgress);
    upload.then(
      (done) =>
        patch(key, {
          id: done.id,
          status: "ready",
          progress: 1,
          name: done.name || file.name,
          size: done.size,
          duration: done.duration ?? null,
          fresh: true,
          ...(kind === "video" && done.poster ? { preview: `${mediaUrl(done.id)}/poster` } : {}),
        }),
      (reason) => patch(key, { status: "error", error: reason instanceof Error ? reason.message : "Upload failed." }),
    );
  };
}

/** Photos (up to 8) and videos (up to 3), in one ordered list. Item 1 is the cover. */
export function MediaManager({
  items,
  setItems,
  disabled,
  invalid = false,
}: {
  items: MediaItem[];
  setItems: (update: (items: MediaItem[]) => MediaItem[]) => void;
  disabled: boolean;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [note, setNote] = useState("");
  const add = useUploader(items, setItems);
  const videoBytes = useVideoLimit();
  const photos = items.filter((i) => i.kind === "photo").length;
  const videos = items.filter((i) => i.kind === "video").length;
  const full = photos >= MAX_PHOTOS && videos >= MAX_VIDEOS;

  function pick(files: File[]) {
    const notes: string[] = [];
    let p = photos;
    let v = videos;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        if (p >= MAX_PHOTOS) notes.push(`Up to ${MAX_PHOTOS} photos.`);
        else (p++, add(file, "photo"));
      } else if (videoType(file)) {
        if (v >= MAX_VIDEOS) notes.push(`Up to ${MAX_VIDEOS} videos.`);
        else (v++, add(file, "video"));
      } else notes.push(`${file.name} isn't a photo or video${/\.pdf$/i.test(file.name) ? " (add PDFs under Documents)" : ""}.`);
    }
    setNote([...new Set(notes)].join(" "));
  }
  function move(index: number, to: number) {
    setItems((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  }
  const remove = (key: string) => setItems((list) => list.filter((i) => i.key !== key));
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (!disabled && e.dataTransfer.files.length) pick([...e.dataTransfer.files]);
  };

  return (
    <fieldset className={`mkm-section${invalid ? " is-invalid" : ""}`} aria-describedby="mkm-media-help">
      <legend>
        Photos &amp; videos <span className="mkm-opt">Optional</span>
      </legend>
      <p id="mkm-media-help" className="mkm-help">
        Up to {MAX_PHOTOS} photos (JPG, PNG, WebP) and {MAX_VIDEOS} videos (MP4, MOV or WebM, up to 3 minutes and{" "}
        {megabytes(videoBytes)} each). The first one is the cover buyers see first. You can also publish without any.
      </p>
      <div className="mkm-photos">
        {items.map((item, index) => {
          const label = `${item.kind === "video" ? "Video" : "Photo"} ${index + 1}`;
          return (
            <figure key={item.key} className={`mkm-photo is-${item.status} is-${item.kind}${index === 0 ? " is-cover" : ""}`}>
              {item.preview ? (
                <img src={item.preview} alt={label} loading="lazy" />
              ) : item.localVideo ? (
                <video src={item.localVideo} muted playsInline preload="metadata" aria-label={label} />
              ) : item.kind === "video" && item.id ? (
                <video src={mediaUrl(item.id)} muted playsInline preload="metadata" aria-label={label} />
              ) : (
                <span className="mkm-photo-blank" />
              )}
              <span className="mkm-photo-num">{index + 1}</span>
              {index === 0 && item.status !== "error" && <span className="mkm-cover-tag">Cover</span>}
              {item.kind === "video" && item.status !== "error" && (
                <span className="mkm-video-badge">
                  <PlayIcon size={11} /> {item.duration ? formatDuration(item.duration) : "Video"}
                </span>
              )}
              {item.status === "uploading" && (
                <span className="mkm-photo-state" role="status">
                  <span className="mkm-progress" aria-hidden="true">
                    <span style={{ width: `${Math.round((item.progress ?? 0) * 100)}%` }} />
                  </span>
                  Uploading {Math.round((item.progress ?? 0) * 100)}%
                </span>
              )}
              {item.status === "error" && (
                <span className="mkm-photo-state is-error" role="alert">
                  {item.error}
                </span>
              )}
              <figcaption className="mkm-photo-tools">
                {item.status === "ready" && index > 0 && (
                  <button type="button" className="mkm-tool" onClick={() => move(index, 0)} disabled={disabled} title="Make cover" aria-label={`Make ${label.toLowerCase()} the cover`}>
                    <StarIcon />
                  </button>
                )}
                <button type="button" className="mkm-tool" onClick={() => move(index, index - 1)} disabled={disabled || index === 0} title="Move left" aria-label={`Move ${label.toLowerCase()} earlier`}>
                  <LeftIcon />
                </button>
                <button type="button" className="mkm-tool" onClick={() => move(index, index + 1)} disabled={disabled || index === items.length - 1} title="Move right" aria-label={`Move ${label.toLowerCase()} later`}>
                  <RightIcon />
                </button>
                <button type="button" className="mkm-tool is-danger" onClick={() => remove(item.key)} disabled={disabled} title="Remove" aria-label={`Remove ${label.toLowerCase()}`}>
                  <CloseIcon />
                </button>
              </figcaption>
            </figure>
          );
        })}
        {!full && (
          <button
            type="button"
            className={`mkm-drop${drag ? " is-drag" : ""}${items.length === 0 ? " is-empty" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            disabled={disabled}
          >
            <CameraIcon />
            <strong>{items.length ? "Add more" : "Add photos or videos"}</strong>
            <small>{items.length ? `${left(MAX_PHOTOS - photos, "photo")} · ${left(MAX_VIDEOS - videos, "video")} left` : "Tap to choose, or drop them here"}</small>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*,video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm"
        multiple
        hidden
        onChange={(e) => {
          pick([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <p className="mkm-meter" aria-live="polite">
        <span className="mkm-meter-bar" aria-hidden="true">
          <span style={{ width: `${(Math.min(photos, MAX_PHOTOS) / MAX_PHOTOS) * 100}%` }} />
        </span>
        {photos}/{MAX_PHOTOS} photos · {videos}/{MAX_VIDEOS} videos
        {note && <span className="mkm-note"> · {note}</span>}
      </p>
    </fieldset>
  );
}

/** Optional PDFs: vet records, registration papers, X-ray reports… */
export function DocumentManager({
  items,
  setItems,
  disabled,
}: {
  items: MediaItem[];
  setItems: (update: (items: MediaItem[]) => MediaItem[]) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const add = useUploader(items, setItems);
  const room = MAX_DOCUMENTS - items.length;

  function pick(files: File[]) {
    setNote("");
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) setNote("Only PDF files can be added.");
    if (pdfs.length > room) setNote(`Up to ${MAX_DOCUMENTS} documents per listing.`);
    pdfs.slice(0, Math.max(room, 0)).forEach((f) => add(f, "document"));
  }

  return (
    <fieldset className="mkm-section">
      <legend>
        Documents <span className="mkm-opt">Optional</span>
      </legend>
      <p className="mkm-help">
        Vet records, registration papers, X-ray reports or a pedigree, as PDF (up to 10 MB each, {MAX_DOCUMENTS} in all).
        Signed-in members can download them from the listing.
      </p>
      {items.length > 0 && (
        <ul className="mkm-docs">
          {items.map((item) => (
            <li key={item.key} className={`mkm-doc is-${item.status}`}>
              <span className="mkm-doc-icon" aria-hidden="true">
                <FileIcon />
              </span>
              <span className="mkm-doc-text">
                <b>{item.name}</b>
                <small>
                  {item.status === "uploading"
                    ? `Uploading ${Math.round((item.progress ?? 0) * 100)}%`
                    : item.status === "error"
                      ? item.error
                      : `PDF · ${formatBytes(item.size)}`}
                </small>
              </span>
              <button
                type="button"
                className="mkm-tool is-danger"
                onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                disabled={disabled}
                aria-label={`Remove ${item.name}`}
                title="Remove"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <button type="button" className="mkm-add-doc" onClick={() => input.current?.click()} disabled={disabled}>
          <PlusIcon /> Add a PDF
        </button>
      )}
      {note && <p className="mkm-note">{note}</p>}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          pick([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </fieldset>
  );
}
