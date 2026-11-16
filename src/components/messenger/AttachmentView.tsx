import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { cachedFileUrl } from "./files";
import { fileSize, isAudio, isImage, isVideo, seconds } from "./format";
import { DownloadIcon, FileIcon, PauseIcon, PlayIcon } from "./icons";
import type { ChatAttachment } from "./types";

type Loader = () => Promise<Blob>;

/** blob: URL for a stored chat file (members only; fetched with the session, cached in memory). */
export function useFileUrl(key: string | null, load: Loader | null, preview?: string, enabled = true) {
  const [url, setUrl] = useState<string | null>(preview ?? null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (preview) {
      setUrl(preview);
      return;
    }
    if (!key || !load || !enabled) return;
    let live = true;
    setFailed(false);
    setLoading(true);
    cachedFileUrl(key, load)
      .then((u) => live && setUrl(u))
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [key, preview, enabled]); // `load` is a fresh function each render; the file key identifies the file.
  return { url, failed, loading };
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

/** One clip plays at a time: starting another pauses the one before. */
let nowPlaying: HTMLMediaElement | null = null;
function claim(el: HTMLMediaElement) {
  if (nowPlaying && nowPlaying !== el) nowPlaying.pause();
  nowPlaying = el;
}

interface ViewProps {
  a: ChatAttachment;
  fileKey: string | null;
  load: Loader | null;
  preview?: string;
  mine?: boolean;
  onOpenImage: (url: string) => void;
  onError: (text: string) => void;
}

/** A photo (tap to view large), a video (tap to play), a voice clip (play bar), or a file card (tap to download). */
export default function AttachmentView(props: ViewProps) {
  const { a } = props;
  if (isImage(a.type)) return <Photo {...props} />;
  if (isVideo(a.type)) return <VideoView {...props} />;
  if (isAudio(a.type)) return <VoicePlayer {...props} />;
  return <FileCard {...props} />;
}

function Photo({ a, fileKey, load, preview, onOpenImage }: ViewProps) {
  const { url, failed } = useFileUrl(fileKey, load, preview);
  const [shown, setShown] = useState(false);
  const ratio = a.width && a.height ? `${a.width} / ${a.height}` : "4 / 3";
  return (
    <button
      type="button"
      className={`mx-photo${url && shown ? " is-ready" : " is-loading"}`}
      style={{ aspectRatio: ratio }}
      aria-label={`Photo: ${a.name}. Open larger`}
      disabled={!url}
      onClick={() => url && onOpenImage(url)}
    >
      {url ? <img src={url} alt="" loading="lazy" onLoad={() => setShown(true)} /> : <span>{failed ? "Photo unavailable" : ""}</span>}
    </button>
  );
}

function VideoView({ a, fileKey, load, preview, onError }: ViewProps) {
  // Videos can be large: nothing downloads until you press play (your own just-sent video plays from memory).
  const [wanted, setWanted] = useState(!!preview);
  const { url, failed, loading } = useFileUrl(fileKey, load, preview, wanted);
  const video = useRef<HTMLVideoElement>(null);
  const ratio = a.width && a.height ? `${a.width} / ${a.height}` : "16 / 9";
  useEffect(() => {
    if (wanted && url && !preview) void video.current?.play().catch(() => undefined);
  }, [wanted, url, preview]);
  useEffect(() => {
    if (failed) onError("That video couldn't be loaded. Try again.");
  }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (url)
    return (
      <div className="mx-video" style={{ aspectRatio: ratio }}>
        <video
          ref={video}
          src={url}
          controls
          playsInline
          preload="metadata"
          onPlay={(e) => claim(e.currentTarget)}
          aria-label={`Video: ${a.name}`}
        />
      </div>
    );
  return (
    <button
      type="button"
      className={`mx-video is-cover${loading ? " is-loading" : ""}`}
      style={{ aspectRatio: ratio }}
      aria-label={`Play video: ${a.name}${a.duration ? `, ${seconds(a.duration)}` : ""}, ${fileSize(a.size)}`}
      disabled={loading}
      onClick={() => setWanted(true)}
    >
      <span className="mx-video-play">{loading ? <i className="mx-spinner" /> : <PlayIcon size={22} />}</span>
      <span className="mx-video-meta">
        {a.duration ? seconds(a.duration) : "Video"} · {fileSize(a.size)}
      </span>
    </button>
  );
}

const BARS = 30;
/** A fixed, friendly-looking wave shape per clip (decoration only; the progress fill is the real position). */
function waveOf(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const noise = ((h >>> 0) % 1000) / 1000;
    const shape = Math.sin((i / (BARS - 1)) * Math.PI) * 0.55 + 0.3;
    return Math.max(0.16, Math.min(1, shape * 0.7 + noise * 0.5));
  });
}
const SPEEDS = [1, 1.5, 2];

export function VoicePlayer({ a, fileKey, load, preview, onError }: ViewProps) {
  const [wanted, setWanted] = useState(!!preview);
  const { url, failed, loading } = useFileUrl(fileKey, load, preview, wanted);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(a.duration ?? 0);
  const [speed, setSpeed] = useState(1);
  const bars = useMemo(() => waveOf(fileKey ?? a.name + a.size), [fileKey, a.name, a.size]);
  const progress = length ? Math.min(1, at / length) : 0;

  useEffect(() => {
    if (failed) onError("That voice clip couldn't be loaded. Try again.");
  }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = audio.current;
    if (wanted && url && el && !preview) {
      claim(el);
      void el.play().catch(() => undefined);
    }
  }, [wanted, url, preview]);

  function toggle() {
    const el = audio.current;
    if (!url || !el) return setWanted(true);
    if (el.paused) {
      claim(el);
      void el.play().catch(() => onError("This browser couldn't play that clip."));
    } else el.pause();
  }
  function seekTo(fraction: number) {
    const el = audio.current;
    if (!el || !length) return;
    el.currentTime = Math.max(0, Math.min(length, fraction * length));
    setAt(el.currentTime);
  }
  function onBarDown(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - box.left) / box.width);
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") seekTo(progress + 0.1);
    else if (e.key === "ArrowLeft") seekTo(progress - 0.1);
  }

  return (
    <div className={`mx-voice${playing ? " is-playing" : ""}`}>
      <button
        type="button"
        className="mx-voice-btn"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        disabled={loading}
        onClick={toggle}
      >
        {loading ? <i className="mx-spinner" /> : playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div
        className="mx-voice-wave"
        role="slider"
        tabIndex={url ? 0 : -1}
        aria-label="Position in voice message"
        aria-valuemin={0}
        aria-valuemax={Math.round(length)}
        aria-valuenow={Math.round(at)}
        aria-valuetext={`${seconds(at)} of ${seconds(length)}`}
        onPointerDown={url ? onBarDown : undefined}
        onKeyDown={onKey}
      >
        {bars.map((h, i) => (
          <i key={i} style={{ height: `${Math.round(h * 100)}%` }} className={(i + 0.5) / BARS <= progress ? "is-played" : undefined} />
        ))}
      </div>
      <span className="mx-voice-time">{seconds(playing || at ? at : length)}</span>
      {url && (
        <button
          type="button"
          className="mx-voice-speed"
          aria-label={`Playback speed ${speed}×`}
          onClick={() => {
            const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
            setSpeed(next);
            if (audio.current) audio.current.playbackRate = next;
          }}
        >
          {speed}×
        </button>
      )}
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setLength(d);
            e.currentTarget.playbackRate = speed;
          }}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={(e) => {
            setPlaying(false);
            setAt(0);
            e.currentTarget.currentTime = 0;
          }}
        />
      )}
    </div>
  );
}

function FileCard({ a, load, onError }: ViewProps) {
  return (
    <button
      type="button"
      className="mx-file"
      disabled={!load}
      onClick={() => load && void downloadFile(a.name, load).catch(() => onError("That file couldn't be downloaded. Try again."))}
      aria-label={`Download ${a.name}, ${fileSize(a.size)}`}
    >
      <span className="mx-file-icon">
        <FileIcon />
      </span>
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
    <Modal label={`Photo: ${name}`} onClose={onClose} className="mx-lightbox mx-dialog mx-layer gx-layer">
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
