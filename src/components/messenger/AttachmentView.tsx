import { useEffect, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { cachedFileUrl } from "./files";
import { fileSize, isImage } from "./format";
import { DownloadIcon, FileIcon } from "./icons";
import type { ChatAttachment } from "./types";

type Loader = () => Promise<Blob>;

/** blob: URL for a stored chat file (members only; fetched with the session, cached in memory). */
export function useFileUrl(key: string | null, load: Loader | null, preview?: string) {
  const [url, setUrl] = useState<string | null>(preview ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (preview) {
      setUrl(preview);
      return;
    }
    if (!key || !load) return;
    let live = true;
    setFailed(false);
    cachedFileUrl(key, load)
      .then((u) => live && setUrl(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key, preview]); // `load` is a fresh function each render; the file key identifies the file.
  return { url, failed };
}

/** Saves a stored file to the device. */
export async function downloadFile(name: string, load: Loader) {
  const blob = await load();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A photo (tap to view large) or a file card (tap to download). */
export default function AttachmentView({
  a,
  fileKey,
  load,
  preview,
  onOpenImage,
  onError,
}: {
  a: ChatAttachment;
  fileKey: string | null;
  load: Loader | null;
  preview?: string;
  onOpenImage: (url: string) => void;
  onError: (text: string) => void;
}) {
  const image = isImage(a.type);
  const { url, failed } = useFileUrl(image ? fileKey : null, image ? load : null, preview);
  if (image) {
    const ratio = a.width && a.height ? `${a.width} / ${a.height}` : "4 / 3";
    return (
      <button
        type="button"
        className={`mx-photo${url ? "" : " is-loading"}`}
        style={{ aspectRatio: ratio }}
        aria-label={`Photo: ${a.name}. Open larger`}
        disabled={!url}
        onClick={() => url && onOpenImage(url)}
      >
        {url ? <img src={url} alt="" loading="lazy" /> : <span>{failed ? "Photo unavailable" : ""}</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="mx-file"
      disabled={!load}
      onClick={() => load && void downloadFile(a.name, load).catch(() => onError("That file couldn't be downloaded. Try again."))}
      aria-label={`Download ${a.name}, ${fileSize(a.size)}`}
    >
      <FileIcon />
      <span className="mx-file-text">
        <span className="mx-file-name">{a.name}</span>
        <span className="mx-file-meta">{fileSize(a.size)}</span>
      </span>
      {load && <DownloadIcon />}
    </button>
  );
}

export function Lightbox({ url, name, onDownload, onClose }: { url: string; name: string; onDownload: () => void; onClose: () => void }) {
  return (
    <Modal label={`Photo: ${name}`} onClose={onClose} className="mx-lightbox">
      <DialogHead kicker="Photo" title={name} onClose={onClose} />
      <div className="mx-lightbox-body">
        <img src={url} alt={name} />
      </div>
      <div className="dlg-actions mx-lightbox-actions">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={onDownload}>
          <DownloadIcon /> Download
        </button>
      </div>
    </Modal>
  );
}
