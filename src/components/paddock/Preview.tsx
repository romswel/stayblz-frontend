import { useEffect, useRef, useState, type CSSProperties } from "react";
import AvatarFace from "../account/AvatarFace";
import Menu, { type MenuEntry } from "../messenger/Menu";
import { canPickSpeaker, type DeviceChoice, type LocalMedia } from "./engine/media";
import { play } from "./engine/sounds";
import { CamIcon, CamOffIcon, ChevronDownIcon, MicIcon, MicOffIcon, MoreIcon, SpeakerIcon } from "./icons";
import { initials, useMedia } from "./useCall";

/**
 * A <video> for a MediaStream. Always muted: call audio plays separately.
 * fit "auto" fills the box unless the video's shape is very different (a phone held upright on a
 * wide screen), so faces are never cut off but there are no black bars for no reason.
 */
export function StreamVideo({ stream, mirror = false, fit = "cover", label }: { stream: MediaStream; mirror?: boolean; fit?: "cover" | "contain" | "auto"; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [autoFit, setAutoFit] = useState<"cover" | "contain">("cover");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);
  useEffect(() => {
    const el = ref.current;
    if (!el || fit !== "auto") return;
    const decide = () => {
      const { videoWidth: vw, videoHeight: vh, clientWidth: bw, clientHeight: bh } = el;
      if (!vw || !vh || !bw || !bh) return;
      const box = bw / bh;
      setAutoFit(Math.abs(vw / vh - box) / box < 0.3 ? "cover" : "contain");
    };
    el.addEventListener("resize", decide);
    el.addEventListener("loadedmetadata", decide);
    const observer = new ResizeObserver(decide);
    observer.observe(el);
    return () => {
      el.removeEventListener("resize", decide);
      el.removeEventListener("loadedmetadata", decide);
      observer.disconnect();
    };
  }, [fit]);
  const contain = fit === "contain" || (fit === "auto" && autoFit === "contain");
  return (
    <video
      ref={ref}
      className={`pd-video${mirror ? " is-mirror" : ""}${contain ? " is-contain" : ""}`}
      autoPlay
      muted
      playsInline
      aria-label={label}
    />
  );
}

/** Mic level as a row of bars, drawn without re-rendering React. */
export function LevelMeter({ media, label = "Microphone level" }: { media: LocalMedia; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const level = media.micOn ? media.level() : 0;
      ref.current?.style.setProperty("--level", String(Math.min(1, level * 1.6)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [media]);
  return (
    <span ref={ref} className="pd-meter" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} style={{ ["--i" as string]: i }} />
      ))}
    </span>
  );
}

/** A face for someone with their camera off: their profile picture, or initials. */
export function Face({ name, accountId, className = "pd-face", style }: { name: string; accountId?: string | null; className?: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style} aria-hidden="true">
      <AvatarFace id={accountId}>{initials(name)}</AvatarFace>
    </span>
  );
}

/** Camera preview with mic/camera switches (green room, waiting room). */
export function SelfPreview({ media, name, accountId, onSettings, compact = false }: { media: LocalMedia; name: string; accountId?: string | null; onSettings?: () => void; compact?: boolean }) {
  useMedia(media);
  const blockedCam = media.problems.cam;
  const more = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const starting = !media.camOn && !media.micOn && !media.problems.cam && !media.problems.mic && !media.devices.videoinput.length;
  return (
    <div className={`pd-preview${compact ? " is-compact" : ""}`}>
      {media.camOn && media.camStream ? (
        <StreamVideo stream={media.camStream} mirror={media.mirror} label="Your camera" />
      ) : (
        <div className="pd-preview-off">
          <Face name={name} accountId={accountId} className="pd-face is-large" />
          {!compact && <span>{starting ? "Starting your camera…" : blockedCam ? "Camera unavailable" : "Camera is off"}</span>}
        </div>
      )}
      <span className="pd-preview-name">{name}</span>
      {onSettings && (
        <>
          <button
            ref={more}
            type="button"
            className="pd-preview-more"
            aria-label="Preview options"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreIcon size={18} />
          </button>
          {menu && (
            <Menu
              anchor={more.current}
              label="Preview options"
              items={[
                { label: "Mirror my video", checked: media.mirror, onSelect: () => media.setMirror(!media.mirror) },
                { label: "Play a test sound", icon: <SpeakerIcon size={16} />, onSelect: () => play("join", media.choice.audiooutput, true) },
                { label: "All settings…", onSelect: onSettings },
              ]}
              onClose={() => setMenu(false)}
            />
          )}
        </>
      )}
      <div className="pd-preview-controls">
        <button
          type="button"
          className={`pd-round${media.micOn ? "" : " is-off"}`}
          aria-pressed={media.micOn}
          aria-label={media.micOn ? "Turn off microphone" : "Turn on microphone"}
          title={media.micOn ? "Turn off microphone" : "Turn on microphone"}
          onClick={() => void media.setMic(!media.micOn)}
        >
          {media.micOn ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          type="button"
          className={`pd-round${media.camOn ? "" : " is-off"}`}
          aria-pressed={media.camOn}
          aria-label={media.camOn ? "Turn off camera" : "Turn on camera"}
          title={media.camOn ? "Turn off camera" : "Turn on camera"}
          onClick={() => void media.setCam(!media.camOn)}
        >
          {media.camOn ? <CamIcon /> : <CamOffIcon />}
        </button>
      </div>
      {!compact && (
        <span className="pd-preview-level">
          <LevelMeter media={media} />
        </span>
      )}
    </div>
  );
}

/** Microphone ▾  Speaker ▾  Camera ▾ — quick device choices under the preview. */
export function DeviceChips({ media, onSpeaker }: { media: LocalMedia; onSpeaker?: (id: string) => void }) {
  useMedia(media);
  const [open, setOpen] = useState<keyof DeviceChoice | null>(null);
  const refs = { audioinput: useRef<HTMLButtonElement>(null), audiooutput: useRef<HTMLButtonElement>(null), videoinput: useRef<HTMLButtonElement>(null) };
  const current = (kind: keyof DeviceChoice) =>
    kind === "audioinput"
      ? (media.micTrack?.getSettings?.().deviceId ?? media.choice.audioinput)
      : kind === "videoinput"
        ? (media.camTrack?.getSettings?.().deviceId ?? media.choice.videoinput)
        : media.choice.audiooutput;
  const word = { audioinput: "Microphone", audiooutput: "Speaker", videoinput: "Camera" } as const;
  const labelOf = (kind: keyof DeviceChoice) => {
    const list = media.devices[kind];
    const id = current(kind);
    const found = list.find((d) => d.deviceId === id) ?? (kind === "audiooutput" ? undefined : list[0]);
    if (!list.length) return kind === "audiooutput" ? "System default" : `No ${word[kind].toLowerCase()}`;
    return found?.label || (kind === "audiooutput" ? "System default" : `${word[kind]} 1`);
  };
  const items = (kind: keyof DeviceChoice): MenuEntry[] => {
    const list = media.devices[kind].filter((d) => kind !== "audiooutput" || d.deviceId !== "default");
    const id = current(kind);
    const entries: MenuEntry[] = [{ section: word[kind] }];
    if (kind === "audiooutput")
      entries.push({ label: "System default", checked: !id, onSelect: () => (void media.choose(kind, ""), onSpeaker?.("")) });
    if (!list.length && kind !== "audiooutput") entries.push({ label: `No ${word[kind].toLowerCase()} found`, disabled: true, onSelect: () => undefined });
    list.forEach((d, i) =>
      entries.push({
        label: d.label || `${word[kind]} ${i + 1}`,
        checked: d.deviceId === id,
        onSelect: () => {
          void media.choose(kind, d.deviceId);
          if (kind === "audiooutput") onSpeaker?.(d.deviceId);
        },
      }),
    );
    if (kind === "audiooutput") entries.push({ label: "Play a test sound", icon: <SpeakerIcon size={16} />, onSelect: () => play("join", media.choice.audiooutput, true) });
    return entries;
  };
  const kinds: (keyof DeviceChoice)[] = canPickSpeaker() && media.devices.audiooutput.length ? ["audioinput", "audiooutput", "videoinput"] : ["audioinput", "videoinput"];
  const icon = { audioinput: <MicIcon size={16} />, audiooutput: <SpeakerIcon size={16} />, videoinput: <CamIcon size={16} /> };
  return (
    <div className="pd-chips" role="group" aria-label="Devices">
      {kinds.map((kind) => (
        <button
          key={kind}
          ref={refs[kind]}
          type="button"
          className="pd-chip-btn"
          aria-haspopup="menu"
          aria-expanded={open === kind}
          aria-label={`${word[kind]}: ${labelOf(kind)}`}
          onClick={() => setOpen((v) => (v === kind ? null : kind))}
        >
          {icon[kind]}
          <span>{labelOf(kind)}</span>
          <ChevronDownIcon />
        </button>
      ))}
      {open && <Menu anchor={refs[open].current} label={`Choose ${word[open].toLowerCase()}`} align="start" items={items(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

const deviceName = (d: MediaDeviceInfo, i: number, kind: string) => d.label || `${kind} ${i + 1}`;

/** Camera, microphone and speaker choices. */
export function DevicePickers({ media, onSpeaker }: { media: LocalMedia; onSpeaker?: (id: string) => void }) {
  useMedia(media);
  const { devices, choice } = media;
  const currentCam = media.camTrack?.getSettings?.().deviceId ?? choice.videoinput;
  const currentMic = media.micTrack?.getSettings?.().deviceId ?? choice.audioinput;
  const speakers = canPickSpeaker() && devices.audiooutput.length > 0;
  return (
    <div className="pd-devices">
      <label className="pd-device">
        <span className="ld-label">
          <MicIcon size={15} /> Microphone
        </span>
        <select
          value={devices.audioinput.some((d) => d.deviceId === currentMic) ? currentMic : ""}
          onChange={(e) => void media.choose("audioinput", e.target.value)}
          disabled={!devices.audioinput.length}
        >
          {!devices.audioinput.length && <option value="">No microphone found</option>}
          {devices.audioinput.length > 0 && !devices.audioinput.some((d) => d.deviceId === currentMic) && <option value="">Default microphone</option>}
          {devices.audioinput.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {deviceName(d, i, "Microphone")}
            </option>
          ))}
        </select>
      </label>
      <label className="pd-device">
        <span className="ld-label">
          <CamIcon size={15} /> Camera
        </span>
        <select
          value={devices.videoinput.some((d) => d.deviceId === currentCam) ? currentCam : ""}
          onChange={(e) => void media.choose("videoinput", e.target.value)}
          disabled={!devices.videoinput.length}
        >
          {!devices.videoinput.length && <option value="">No camera found</option>}
          {devices.videoinput.length > 0 && !devices.videoinput.some((d) => d.deviceId === currentCam) && <option value="">Default camera</option>}
          {devices.videoinput.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {deviceName(d, i, "Camera")}
            </option>
          ))}
        </select>
      </label>
      {speakers && (
        <label className="pd-device">
          <span className="ld-label">
            <SpeakerIcon size={15} /> Speaker
          </span>
          <span className="pd-device-row">
            <select
              value={devices.audiooutput.some((d) => d.deviceId === choice.audiooutput) ? choice.audiooutput : ""}
              onChange={(e) => {
                void media.choose("audiooutput", e.target.value);
                onSpeaker?.(e.target.value);
              }}
            >
              <option value="">System default</option>
              {devices.audiooutput
                .filter((d) => d.deviceId !== "default")
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {deviceName(d, i, "Speaker")}
                  </option>
                ))}
            </select>
            <button type="button" className="btn btn-quiet pd-test" onClick={() => play("join", choice.audiooutput, true)}>
              Test
            </button>
          </span>
        </label>
      )}
    </div>
  );
}

/**
 * Check-in before going in: camera, microphone and speaker, each with a plain status, so problems show
 * up here rather than in the call. Updates as devices change.
 */
export function CheckIn({ media }: { media: LocalMedia }) {
  useMedia(media);
  const speaker = media.devices.audiooutput.find((d) => d.deviceId === media.choice.audiooutput);
  const rows: { key: string; label: string; state: "ok" | "off" | "bad"; text: string }[] = [
    {
      key: "cam",
      label: "Camera",
      state: media.camTrack ? "ok" : media.problems.cam ? "bad" : "off",
      text: media.camTrack ? "Ready" : media.problems.cam ? "Not working" : "Off (others see your initials)",
    },
    {
      key: "mic",
      label: "Microphone",
      state: media.micTrack ? "ok" : media.problems.mic ? "bad" : "off",
      text: media.micTrack ? "Ready" : media.problems.mic ? "Not working" : "Off (you go in muted)",
    },
    {
      key: "speaker",
      label: "Speaker",
      state: "ok",
      text: speaker?.label || "System default",
    },
  ];
  return (
    <ul className="pd-checkin" aria-label="Device check">
      {rows.map((row) => (
        <li key={row.key} className={`is-${row.state}`}>
          <span className="pd-checkin-mark" aria-hidden="true">
            {row.state === "ok" ? "\u2713" : row.state === "bad" ? "!" : "\u2013"}
          </span>
          <span className="pd-checkin-label">{row.label}</span>
          <span className="pd-checkin-text">{row.text}</span>
        </li>
      ))}
    </ul>
  );
}
