/**
 * This browser's camera, microphone and screen for Stayblz Paddock. Plain TypeScript (no React):
 * the green room and the call share one instance, so the camera never restarts on joining.
 *
 * Camera off = the camera is released (its light goes off). Mic off = muted, still open, so
 * unmuting is instant and "you're talking while muted" can be noticed.
 */
export type MediaProblem = "blocked" | "missing" | "busy" | "failed" | "insecure";
export interface DeviceChoice {
  audioinput: string;
  videoinput: string;
  audiooutput: string;
}
export interface DeviceLists {
  audioinput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
}

const CHOICE_KEY = "stayblz.paddock.devices";
function readChoice(): DeviceChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "{}");
    return {
      audioinput: typeof raw.audioinput === "string" ? raw.audioinput : "",
      videoinput: typeof raw.videoinput === "string" ? raw.videoinput : "",
      audiooutput: typeof raw.audiooutput === "string" ? raw.audiooutput : "",
    };
  } catch {
    return { audioinput: "", videoinput: "", audiooutput: "" };
  }
}

export function problemOf(error: unknown): MediaProblem {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "missing";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  return "failed";
}
export const problemText: Record<MediaProblem, (what: string) => string> = {
  blocked: (what) => `Your browser is blocking the ${what}. Allow it from the icon in the address bar, then try again.`,
  missing: (what) => `No ${what} was found. Plug one in, or check your computer's settings.`,
  busy: (what) => `Your ${what} is being used by another app. Close that app, then try again.`,
  failed: (what) => `The ${what} couldn't start. Try again, or pick another device in settings.`,
  insecure: () => "Cameras and microphones only work on a secure (https) page.",
};

export const canShareScreen = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices;
export const canPickSpeaker = () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

export class LocalMedia {
  micTrack: MediaStreamTrack | null = null;
  camTrack: MediaStreamTrack | null = null;
  screenTrack: MediaStreamTrack | null = null;
  /** What the self view shows. Rebuilt when the camera changes. */
  camStream: MediaStream | null = null;
  screenStream: MediaStream | null = null;
  micOn = false;
  camOn = false;
  problems: { mic: MediaProblem | null; cam: MediaProblem | null; screen: MediaProblem | null } = { mic: null, cam: null, screen: null };
  devices: DeviceLists = { audioinput: [], videoinput: [], audiooutput: [] };
  choice: DeviceChoice = readChoice();
  /** Mirror the self view (not what others see). */
  mirror = true;
  private listeners = new Set<() => void>();
  private audio: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private analysedTrack: MediaStreamTrack | null = null;
  private levelBuffer: Uint8Array<ArrayBuffer> | null = null;
  private busy: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private onDeviceChange = () => void this.refreshDevices();
  onScreenEnded: (() => void) | null = null;

  constructor() {
    navigator.mediaDevices?.addEventListener?.("devicechange", this.onDeviceChange);
  }

  private changes = 0;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
  /** Bumps on every change (for React's useSyncExternalStore). */
  version = () => this.changes;
  private emit() {
    this.changes++;
    this.listeners.forEach((listener) => listener());
  }
  /** One change at a time: quick double-clicks can't open two cameras. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.busy.then(work, work);
    this.busy = next.catch(() => undefined);
    return next;
  }

  private saveChoice() {
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(this.choice));
    } catch {
      /* Remembering devices is a convenience. */
    }
  }

  async refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      this.devices = {
        audioinput: all.filter((d) => d.kind === "audioinput" && d.deviceId),
        videoinput: all.filter((d) => d.kind === "videoinput" && d.deviceId),
        audiooutput: all.filter((d) => d.kind === "audiooutput" && d.deviceId),
      };
      this.emit();
    } catch {
      /* Device names are optional. */
    }
  }

  private audioConstraints(): MediaTrackConstraints {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(this.choice.audioinput ? { deviceId: { ideal: this.choice.audioinput } } : {}),
    };
  }
  private videoConstraints(): MediaTrackConstraints {
    return {
      width: { ideal: 960 },
      height: { ideal: 540 },
      frameRate: { ideal: 24, max: 30 },
      ...(this.choice.videoinput ? { deviceId: { ideal: this.choice.videoinput } } : { facingMode: "user" }),
    };
  }

  private async getTrack(kind: "audio" | "video"): Promise<MediaStreamTrack> {
    if (!window.isSecureContext) throw Object.assign(new Error("insecure"), { name: "InsecureContext" });
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("missing"), { name: "NotFoundError" });
    const constraints = kind === "audio" ? { audio: this.audioConstraints() } : { video: this.videoConstraints() };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      // A remembered device that's gone: try the default once.
      if (problemOf(error) === "missing" && this.choice[kind === "audio" ? "audioinput" : "videoinput"]) {
        this.choice[kind === "audio" ? "audioinput" : "videoinput"] = "";
        this.saveChoice();
        stream = await navigator.mediaDevices.getUserMedia(kind === "audio" ? { audio: this.audioConstraints() } : { video: this.videoConstraints() });
      } else throw error;
    }
    const track = stream.getTracks()[0];
    if (!track) throw Object.assign(new Error("missing"), { name: "NotFoundError" });
    return track;
  }

  private setProblem(kind: "mic" | "cam" | "screen", error: unknown) {
    this.problems[kind] = error instanceof Error && error.name === "InsecureContext" ? "insecure" : problemOf(error);
  }

  /** The green room's first ask: either can fail on its own, the other still works. */
  start(want: { mic: boolean; cam: boolean }) {
    return this.serial(async () => {
      await Promise.all([want.mic ? this.openMic(true) : Promise.resolve(), want.cam ? this.openCam() : Promise.resolve()]);
      await this.refreshDevices();
      this.emit();
    });
  }

  private async openMic(on: boolean) {
    try {
      const track = await this.getTrack("audio");
      if (this.stopped) return void track.stop();
      this.micTrack?.stop();
      this.micTrack = track;
      track.enabled = on;
      this.micOn = on;
      this.problems.mic = null;
      track.addEventListener("ended", () => {
        if (this.micTrack !== track) return;
        this.micTrack = null;
        this.micOn = false;
        this.problems.mic = "failed";
        this.emit();
      });
      this.watchLevel(track);
    } catch (error) {
      this.micOn = false;
      this.setProblem("mic", error);
    }
  }

  private async openCam() {
    try {
      const track = await this.getTrack("video");
      if (this.stopped) return void track.stop();
      this.camTrack?.stop();
      this.camTrack = track;
      track.contentHint = "motion";
      this.camStream = new MediaStream([track]);
      this.camOn = true;
      this.problems.cam = null;
      const settings = track.getSettings?.() ?? {};
      if (settings.facingMode) this.mirror = settings.facingMode !== "environment";
      track.addEventListener("ended", () => {
        if (this.camTrack !== track) return;
        // Phones stop the camera in the background; we switch it back on when the page returns.
        this.camTrack = null;
        this.camStream = null;
        this.camOn = false;
        this.emit();
      });
    } catch (error) {
      this.camOn = false;
      this.setProblem("cam", error);
    }
  }

  setMic(on: boolean) {
    return this.serial(async () => {
      if (on && !this.micTrack) await this.openMic(true);
      else if (this.micTrack) {
        this.micTrack.enabled = on;
        this.micOn = on;
      }
      this.emit();
      return this.micOn;
    });
  }

  setCam(on: boolean) {
    return this.serial(async () => {
      if (on && !this.camTrack) await this.openCam();
      else if (!on && this.camTrack) {
        this.camTrack.stop();
        this.camTrack = null;
        this.camStream = null;
        this.camOn = false;
      }
      this.emit();
      return this.camOn;
    });
  }

  /** Pick a device. The new one replaces the old in the call without a reconnect. */
  choose(kind: keyof DeviceChoice, deviceId: string) {
    return this.serial(async () => {
      this.choice = { ...this.choice, [kind]: deviceId };
      this.saveChoice();
      if (kind === "audioinput" && this.micTrack) await this.openMic(this.micOn);
      if (kind === "videoinput" && this.camTrack) await this.openCam();
      this.emit();
    });
  }

  setMirror(on: boolean) {
    this.mirror = on;
    this.emit();
  }

  /** Phones: front ↔ back camera. */
  flipCamera() {
    const cams = this.devices.videoinput;
    if (cams.length < 2) return Promise.resolve();
    const current = this.camTrack?.getSettings?.().deviceId ?? this.choice.videoinput;
    const index = cams.findIndex((d) => d.deviceId === current);
    return this.choose("videoinput", cams[(index + 1) % cams.length].deviceId);
  }

  startScreen() {
    return this.serial(async () => {
      if (this.screenTrack) return true;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 30 } },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!track) return false;
        track.contentHint = "detail";
        this.screenTrack = track;
        this.screenStream = new MediaStream([track]);
        this.problems.screen = null;
        // "Stop sharing" in the browser's own bar.
        track.addEventListener("ended", () => {
          if (this.screenTrack !== track) return;
          this.screenTrack = null;
          this.screenStream = null;
          this.emit();
          this.onScreenEnded?.();
        });
        this.emit();
        return true;
      } catch (error) {
        // Closing the picker isn't a problem worth showing.
        if (problemOf(error) !== "blocked" || (error as Error).message?.includes("Permission denied by system"))
          this.setProblem("screen", error);
        this.emit();
        return false;
      }
    });
  }

  stopScreen() {
    if (!this.screenTrack) return;
    this.screenTrack.stop();
    this.screenTrack = null;
    this.screenStream = null;
    this.emit();
  }

  /** Mic level 0–1, read from a copy of the mic so it still works while muted. */
  level(): number {
    if (!this.analyser || !this.levelBuffer) return 0;
    this.analyser.getByteTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (const v of this.levelBuffer) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / this.levelBuffer.length) * 4);
  }

  private watchLevel(track: MediaStreamTrack) {
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === "suspended") void this.audio.resume().catch(() => undefined);
      this.analysedTrack?.stop();
      const copy = track.clone();
      copy.enabled = true;
      this.analysedTrack = copy;
      const source = this.audio.createMediaStreamSource(new MediaStream([copy]));
      const analyser = this.audio.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.analyser = analyser;
      this.levelBuffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } catch {
      this.analyser = null;
    }
  }
  /** The browser allows sound after a click; call from Join. */
  resumeAudio() {
    void this.audio?.resume().catch(() => undefined);
  }

  stop() {
    this.stopped = true;
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.onDeviceChange);
    for (const track of [this.micTrack, this.camTrack, this.screenTrack, this.analysedTrack]) track?.stop();
    this.micTrack = this.camTrack = this.screenTrack = this.analysedTrack = null;
    this.camStream = this.screenStream = null;
    this.micOn = this.camOn = false;
    void this.audio?.close().catch(() => undefined);
    this.audio = null;
    this.emit();
    this.listeners.clear();
  }
}
