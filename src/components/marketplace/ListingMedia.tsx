import { useEffect, useRef, useState, type DragEvent } from "react";
import { MAX_DOCUMENTS, MAX_PHOTOS, formatBytes } from "./options";
import { mediaUrl, uploadDocument, uploadPhoto } from "./media";

/** One photo or document in the form: already saved, uploading, or failed. */
export type MediaItem = {
  key: string;
  /** Set once the server has the file. */
  id?: string;
  status: "ready" | "uploading" | "error";
  /** Local preview while uploading (object URL), else the API address. */
  preview?: string;
  name: string;
  size: number;
  error?: string;
  /** Uploaded in this form session and not saved yet (removed again on Cancel). */
  fresh?: boolean;
};

let counter = 0;
const nextKey = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export const savedPhoto = (id: string): MediaItem => ({ key: id, id, status: "ready", preview: mediaUrl(id), name: "", size: 0 });
export const savedDocument = (d: { id: string; name: string; size: number }): MediaItem => ({
  key: d.id,
  id: d.id,
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

function useUploader(
  items: MediaItem[],
  setItems: (update: (items: MediaItem[]) => MediaItem[]) => void,
  upload: (file: File) => Promise<{ id: string; name: string; size: number }>,
  makePreview: boolean,
) {
  // Object URLs are freed when an item leaves the list or the form closes.
  const previews = useRef(new Map<string, string>());
  useEffect(() => {
    const live = new Set(items.map((i) => i.key));
    for (const [key, href] of previews.current)
      if (!live.has(key)) {
        URL.revokeObjectURL(href);
        previews.current.delete(key);
      }
  }, [items]);
  useEffect(() => () => previews.current.forEach((href) => URL.revokeObjectURL(href)), []);

  return function add(files: File[]) {
    for (const file of files) {
      const key = nextKey();
      let preview: string | undefined;
      if (makePreview) {
        preview = URL.createObjectURL(file);
        previews.current.set(key, preview);
      }
      setItems((list) => [...list, { key, status: "uploading", preview, name: file.name, size: file.size }]);
      upload(file).then(
        (done) => setItems((list) => list.map((i) => (i.key === key ? { ...i, id: done.id, status: "ready", name: done.name || i.name, size: done.size, fresh: true } : i))),
        (reason) =>
          setItems((list) =>
            list.map((i) =>
              i.key === key ? { ...i, status: "error", error: reason instanceof Error ? reason.message : "Upload failed." } : i,
            ),
          ),
      );
    }
  };
}

/** Photos: 1 required, up to 8. The first one is the cover. */
export function PhotoManager({
  items,
  setItems,
  disabled,
  invalid,
}: {
  items: MediaItem[];
  setItems: (update: (items: MediaItem[]) => MediaItem[]) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [note, setNote] = useState("");
  const add = useUploader(items, setItems, uploadPhoto, true);
  const room = MAX_PHOTOS - items.length;
  const ready = items.filter((i) => i.status === "ready").length;

  function pick(files: File[]) {
    setNote("");
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length < files.length) setNote("Only photos can go here. Add PDFs under Documents.");
    if (images.length > room) setNote(`A listing can have up to ${MAX_PHOTOS} photos. The first ${Math.max(room, 0)} were added.`);
    add(images.slice(0, Math.max(room, 0)));
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
    <fieldset className={`mkm-section${invalid ? " is-invalid" : ""}`} aria-describedby="mkm-photos-help">
      <legend>
        Photos <span className="mkm-req">Required</span>
      </legend>
      <p id="mkm-photos-help" className="mkm-help">
        Add 1 to {MAX_PHOTOS} photos. The first one is the cover buyers see first. JPG, PNG or WebP; large photos are
        resized for you.
      </p>
      <div className="mkm-photos">
        {items.map((item, index) => (
          <figure key={item.key} className={`mkm-photo is-${item.status}${index === 0 ? " is-cover" : ""}`}>
            {item.preview ? <img src={item.preview} alt={`Photo ${index + 1}`} loading="lazy" /> : <span className="mkm-photo-blank" />}
            <span className="mkm-photo-num">{index + 1}</span>
            {index === 0 && item.status !== "error" && <span className="mkm-cover-tag">Cover</span>}
            {item.status === "uploading" && (
              <span className="mkm-photo-state" role="status">
                <span className="mkm-spinner" aria-hidden="true" /> Uploading…
              </span>
            )}
            {item.status === "error" && (
              <span className="mkm-photo-state is-error" role="alert">
                {item.error}
              </span>
            )}
            <figcaption className="mkm-photo-tools">
              {item.status === "ready" && index > 0 && (
                <button type="button" className="mkm-tool" onClick={() => move(index, 0)} disabled={disabled} title="Make cover" aria-label={`Make photo ${index + 1} the cover`}>
                  <StarIcon />
                </button>
              )}
              <button type="button" className="mkm-tool" onClick={() => move(index, index - 1)} disabled={disabled || index === 0} title="Move left" aria-label={`Move photo ${index + 1} earlier`}>
                <LeftIcon />
              </button>
              <button type="button" className="mkm-tool" onClick={() => move(index, index + 1)} disabled={disabled || index === items.length - 1} title="Move right" aria-label={`Move photo ${index + 1} later`}>
                <RightIcon />
              </button>
              <button type="button" className="mkm-tool is-danger" onClick={() => remove(item.key)} disabled={disabled} title="Remove" aria-label={`Remove photo ${index + 1}`}>
                <CloseIcon />
              </button>
            </figcaption>
          </figure>
        ))}
        {room > 0 && (
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
            <strong>{items.length ? "Add more" : "Add photos"}</strong>
            <small>{items.length ? `${room} left` : "Tap to choose, or drop them here"}</small>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        multiple
        hidden
        onChange={(e) => {
          pick([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <p className="mkm-meter" aria-live="polite">
        <span className="mkm-meter-bar" aria-hidden="true">
          <span style={{ width: `${(Math.min(items.length, MAX_PHOTOS) / MAX_PHOTOS) * 100}%` }} />
        </span>
        {ready}/{MAX_PHOTOS} photos
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
  const add = useUploader(items, setItems, uploadDocument, false);
  const room = MAX_DOCUMENTS - items.length;

  function pick(files: File[]) {
    setNote("");
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) setNote("Only PDF files can be added.");
    if (pdfs.length > room) setNote(`Up to ${MAX_DOCUMENTS} documents per listing.`);
    add(pdfs.slice(0, Math.max(room, 0)));
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
                    ? "Uploading…"
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
