/**
 * One Stayblz Paddock call: this browser's media + the API line + a direct link to each person.
 * Plain TypeScript with a subscribe/getView pair, so React only draws what it's given and nothing
 * here depends on which page is open (the call carries on while you browse Stayblz).
 */
import { ApiError } from "../../../api";
import {
  knockApi,
  leaveBeacon,
  must,
  paddockApi,
  type FeedItem,
  type GoneReason,
  type JoinAnswer,
  type Knock,
  type PeerRole,
  type PeerState,
  type Snapshot,
  type WirePeer,
} from "../paddockApi";
import { canPickSpeaker, problemText, type DeviceChoice, type LocalMedia } from "./media";
import { PeerLink, type LinkStatus, type Quality } from "./peer";
import { LiveChannel } from "./signaling";
import { play } from "./sounds";
import { callStore, type ActiveCall } from "./store";

export type CallPhase = "in" | "left" | "ended" | "removed" | "failed";

export interface Person {
  id: string;
  name: string;
  role: PeerRole;
  guest: boolean;
  me: boolean;
  /** Saddlecloth number by arrival, 1–8. */
  number: number;
  state: PeerState;
  joinedAt: number;
  /** Camera video to show, or null (off, or nothing arriving yet). */
  cam: MediaStream | null;
  screen: MediaStream | null;
  link: LinkStatus | "self";
  quality: Quality | null;
  speaking: boolean;
}
export interface ChatLine {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
  mine: boolean;
  status: "sending" | "sent" | "failed";
}
export interface Toast {
  id: string;
  kind: "info" | "knock" | "chat" | "hand" | "warn";
  text: string;
  knockId?: string;
}
export interface FloatingReaction {
  id: string;
  emoji: string;
  name: string;
}
export interface CallView {
  phase: CallPhase;
  endMessage: string;
  code: string;
  title: string;
  role: PeerRole;
  canManage: boolean;
  locked: boolean;
  guestsAllowed: boolean;
  startedAt: number;
  /** When this browser joined (its own clock). */
  joinedAt: number;
  maxPeople: number;
  me: Person;
  people: Person[];
  knocks: Knock[];
  chat: ChatLine[];
  unread: number;
  reactions: FloatingReaction[];
  toasts: Toast[];
  activeSpeaker: string | null;
  trouble: boolean;
  rejoining: boolean;
  audioBlocked: boolean;
  relayAvailable: boolean;
  relayInUse: boolean;
  mic: boolean;
  cam: boolean;
  screen: boolean;
  hand: boolean;
  media: LocalMedia;
  speaker: string;
}

interface Remote {
  wire: WirePeer;
  link: PeerLink;
  audio: HTMLAudioElement | null;
  audioStream: MediaStream | null;
  analyser: AnalyserNode | null;
  level: number;
  speakingUntil: number;
}

const camBitrateFor = (people: number) => (people <= 2 ? 1_000_000 : people <= 4 ? 600_000 : people <= 6 ? 400_000 : 280_000);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const SPEAKING_LEVEL = 0.05;

export const peerKey = (code: string) => `stayblz.paddock.peer.${code}`;
export const passKey = (code: string) => `stayblz.paddock.pass.${code}`;
const session = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      /* Remembering is a convenience. */
    }
  },
};

export class PaddockCall implements ActiveCall {
  readonly code: string;
  private seat: string;
  private peerId: string;
  private pass: string | null;
  private iceServers: RTCIceServer[];
  private relayAvailable: boolean;
  private channel: LiveChannel;
  private remotes = new Map<string, Remote>();
  private snapshot: Snapshot | null = null;
  private listeners = new Set<() => void>();
  private view: CallView;
  private emitQueued = false;
  private phase: CallPhase = "in";
  private endMessage = "";
  private chat: ChatLine[] = [];
  private unread = 0;
  private chatOpen = false;
  private toasts: Toast[] = [];
  private reactions: FloatingReaction[] = [];
  private seenKnocks = new Set<string>();
  private hand = false;
  private camWanted: boolean;
  private lastSent = "";
  private trouble = false;
  private rejoining = false;
  private audioBlocked = false;
  private activeSpeaker: string | null = null;
  private activeSince = 0;
  private audioContext: AudioContext | null = null;
  private levelTimer = 0;
  private mutedTalkSince = 0;
  private mutedHintAt = 0;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private audioBox: HTMLDivElement;
  private unsubscribeMedia: () => void;
  private roomSize = 1;
  /** When the call started, in this device's clock; kept through server restarts. */
  private startedAt = 0;
  private readonly joinedAt = Date.now();
  /** After a server restart, people re-join one by one: keep working links for a moment. */
  private epoch = "";
  private graceUntil = 0;
  private graceTimer = 0;

  constructor(
    code: string,
    answer: JoinAnswer,
    readonly media: LocalMedia,
    private readonly myName: string,
  ) {
    this.code = code;
    this.seat = answer.seat;
    this.peerId = answer.peerId;
    this.pass = answer.pass ?? null;
    this.iceServers = answer.iceServers;
    this.relayAvailable = answer.relay;
    this.camWanted = media.camOn;
    session.set(peerKey(code), this.peerId);
    if (this.pass) session.set(passKey(code), this.pass);
    this.audioBox = document.createElement("div");
    this.audioBox.hidden = true;
    this.audioBox.className = "pd-audio";
    document.body.appendChild(this.audioBox);
    this.channel = new LiveChannel(this.seat, {
      snapshot: (s) => this.onSnapshot(s),
      gone: (reason, message) => this.onGone(reason, message),
      trouble: (on) => {
        this.trouble = on;
        this.emit();
      },
    });
    this.media.onScreenEnded = () => this.sendState();
    this.unsubscribeMedia = media.subscribe(() => {
      for (const r of this.remotes.values()) r.link.updateTracks();
      this.sendState();
      this.emit();
    });
    this.view = this.buildView();
  }

  start() {
    this.media.resumeAudio();
    this.channel.start();
    this.sendState();
    this.levelTimer = window.setInterval(() => this.watchLevels(), 250);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    void this.keepScreenOn();
    callStore.set(this);
  }

  // ————— Store plumbing —————
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
  getView = () => this.view;
  isLive = () => this.phase === "in";
  private emit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    queueMicrotask(() => {
      this.emitQueued = false;
      this.view = this.buildView();
      this.listeners.forEach((listener) => listener());
    });
  }

  // ————— Incoming —————
  private onSnapshot(s: Snapshot) {
    const first = !this.snapshot;
    this.snapshot = s;
    // The server's clock may differ from ours; a restart starts its count again, ours doesn't.
    const start = s.room.startedAt - (s.now - Date.now());
    if (!this.startedAt || start < this.startedAt) this.startedAt = start;
    // A new inbox for me means the server forgot the room (a restart): others are re-joining too.
    if (this.epoch && s.you.epoch !== this.epoch) {
      this.graceUntil = Date.now() + 12_000;
      window.clearTimeout(this.graceTimer);
      this.graceTimer = window.setTimeout(() => this.pruneMissing(), 12_500);
    }
    this.epoch = s.you.epoch;
    // Everyone here except me gets a direct link.
    for (const wire of s.peers) {
      if (wire.id === this.peerId) continue;
      const existing = this.remotes.get(wire.id);
      if (existing) existing.wire = wire;
      else this.addRemote(wire);
    }
    this.pruneMissing();
    for (const signal of s.signals) {
      if (signal.type === "control") this.onControl((signal.data as { action?: string })?.action);
      else this.remotes.get(signal.from)?.link.handle(signal.type, signal.gen, signal.data);
    }
    this.onFeed(s.feed, first);
    if (s.you.role === "host" || s.you.role === "cohost")
      for (const k of s.knocks)
        if (!this.seenKnocks.has(k.id)) {
          this.seenKnocks.add(k.id);
          play("knock", this.media.choice.audiooutput);
          this.toast({ kind: "knock", text: `${k.name}${k.guest ? " (guest)" : ""} wants to join`, knockId: k.id }, 20_000);
        }
    this.emit();
  }

  private onFeed(feed: FeedItem[], first: boolean) {
    for (const item of feed) {
      const mine = item.from === this.peerId;
      if (item.kind === "chat") {
        const existing = this.chat.find((c) => c.id === item.id && c.from === item.from);
        if (existing) existing.status = "sent";
        else {
          this.chat.push({ id: item.id, from: item.from, name: item.name, text: item.text, at: item.at, mine, status: "sent" });
          if (!mine && !first) {
            if (!this.chatOpen) {
              this.unread++;
              this.toast({ kind: "chat", text: `${item.name}: ${item.text}` }, 5_000);
            }
            play("message", this.media.choice.audiooutput);
          }
        }
        if (this.chat.length > 300) this.chat.splice(0, this.chat.length - 300);
      } else if (item.kind === "reaction" && !mine) this.float(item.text, item.name);
      else if (item.kind === "notice" && !mine && !first) {
        this.toast({ kind: "info", text: item.text }, 4_000);
        play(item.text.endsWith("joined") ? "join" : "leave", this.media.choice.audiooutput);
      }
    }
  }

  private onControl(action: string | undefined) {
    if (action === "mute" && this.media.micOn) {
      void this.media.setMic(false);
      this.toast({ kind: "warn", text: "A host muted your microphone. Unmute when you want to talk." }, 6_000);
    } else if (action === "lower-hand" && this.hand) {
      this.hand = false;
      this.sendState();
      this.toast({ kind: "info", text: "A host lowered your hand." }, 4_000);
    } else if (action === "stop-screen" && this.media.screenTrack) {
      this.media.stopScreen();
      this.toast({ kind: "warn", text: "A host stopped your presentation." }, 5_000);
    }
  }

  private async onGone(reason: GoneReason, message: string) {
    if (reason === "expired") return this.rejoin();
    this.finish(reason === "removed" ? "removed" : reason === "ended" ? "ended" : "left", message);
  }

  /** The seat lapsed (normal every 15 minutes, or after a server restart): join again quietly. */
  private async rejoin() {
    if (this.rejoining || this.phase !== "in") return;
    this.rejoining = true;
    this.emit();
    for (let attempt = 0; attempt < 8 && this.phase === "in"; attempt++) {
      try {
        const state = { mic: this.media.micOn, cam: this.media.camOn, screen: !!this.media.screenTrack, hand: this.hand };
        const answer = this.pass
          ? must(await knockApi.rejoin(this.pass, this.peerId, undefined, state))
          : await paddockApi.join(this.code, this.peerId, undefined, state);
        this.seat = answer.seat;
        this.iceServers = answer.iceServers;
        this.relayAvailable = answer.relay;
        this.rejoining = false;
        this.lastSent = "";
        this.channel.setSeat(answer.seat);
        this.sendState();
        this.emit();
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          this.rejoining = false;
          return this.finish(error.code === "removed" ? "removed" : "failed", error.message);
        }
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(10_000, 1000 * 2 ** attempt)));
      }
    }
    this.rejoining = false;
    if (this.phase === "in") this.finish("failed", "We lost the connection to Stayblz. Check your internet, then rejoin.");
  }

  // ————— People —————
  private addRemote(wire: WirePeer) {
    const remote: Remote = {
      wire,
      audio: null,
      audioStream: null,
      analyser: null,
      level: 0,
      speakingUntil: 0,
      link: new PeerLink({
        selfId: this.peerId,
        remoteId: wire.id,
        iceServers: this.iceServers,
        send: (type, gen, data) => this.channel.signal(wire.id, type, gen, data),
        local: () => ({ audio: this.media.micTrack, cam: this.media.camTrack, screen: this.media.screenTrack }),
        onChange: () => {
          this.attachAudio(remote);
          this.emit();
        },
        camBitrate: () => camBitrateFor(this.roomSize),
      }),
    };
    this.remotes.set(wire.id, remote);
  }

  /** People no longer in the room lose their link (unless they're still connected during a restart's grace). */
  private pruneMissing() {
    if (this.phase !== "in" || !this.snapshot) return;
    const present = new Set(this.snapshot.peers.map((p) => p.id));
    const grace = Date.now() < this.graceUntil;
    for (const [id, remote] of this.remotes)
      if (!present.has(id) && !(grace && remote.link.status === "connected")) this.dropRemote(id, remote);
    if (this.remotes.size + 1 !== this.roomSize) {
      this.roomSize = this.remotes.size + 1;
      for (const r of this.remotes.values()) void r.link.applyBitrates();
    }
    this.emit();
  }

  private dropRemote(id: string, remote: Remote) {
    remote.link.close();
    remote.audio?.remove();
    this.remotes.delete(id);
    if (this.activeSpeaker === id) this.activeSpeaker = null;
  }

  /** Sound plays from hidden audio elements (videos stay muted, so nothing plays twice). */
  private attachAudio(remote: Remote) {
    const stream = remote.link.streams.audio;
    if (!stream || stream === remote.audioStream) return;
    remote.audioStream = stream;
    if (!remote.audio) {
      remote.audio = document.createElement("audio");
      remote.audio.autoplay = true;
      this.audioBox.appendChild(remote.audio);
    }
    remote.audio.srcObject = stream;
    this.applySpeaker(remote.audio);
    remote.audio.play().catch(() => {
      this.audioBlocked = true;
      this.emit();
    });
    try {
      this.audioContext ??= new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      remote.analyser = analyser;
    } catch {
      remote.analyser = null;
    }
  }

  private applySpeaker(el: HTMLAudioElement) {
    const id = this.media.choice.audiooutput;
    if (!canPickSpeaker()) return;
    void (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(id || "").catch(() => undefined);
  }

  /** The browser blocked sound until a click: the "Turn on sound" button calls this. */
  resumeAudio() {
    this.audioBlocked = false;
    void this.audioContext?.resume().catch(() => undefined);
    this.media.resumeAudio();
    for (const r of this.remotes.values())
      r.audio?.play().catch(() => {
        this.audioBlocked = true;
      });
    this.emit();
  }

  private watchLevels() {
    if (this.phase !== "in") return;
    const now = performance.now();
    let changed = false;
    const buffer = new Uint8Array(new ArrayBuffer(512));
    let loudest: string | null = null;
    let loudestLevel = 0;
    for (const [id, r] of this.remotes) {
      if (!r.analyser || !r.wire.state.mic) {
        r.level = 0;
      } else {
        r.analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const v of buffer) sum += ((v - 128) / 128) ** 2;
        r.level = Math.sqrt(sum / buffer.length) * 4;
      }
      const wasSpeaking = r.speakingUntil > now;
      if (r.level > SPEAKING_LEVEL) r.speakingUntil = now + 700;
      if (wasSpeaking !== r.speakingUntil > now) changed = true;
      if (r.speakingUntil > now && r.level > loudestLevel) {
        loudest = id;
        loudestLevel = r.level;
      }
    }
    if (loudest && loudest !== this.activeSpeaker && now - this.activeSince > 900) {
      this.activeSpeaker = loudest;
      this.activeSince = now;
      changed = true;
    }
    // "You're muted" hint when someone talks into a muted mic for a moment.
    const myLevel = this.media.level();
    if (!this.media.micOn && this.media.micTrack && myLevel > 0.14) {
      this.mutedTalkSince ||= now;
      if (now - this.mutedTalkSince > 1200 && now - this.mutedHintAt > 30_000) {
        this.mutedHintAt = now;
        this.toast({ kind: "warn", text: "You're muted. Unmute (Ctrl+D) or hold Space to talk." }, 5_000);
      }
    } else this.mutedTalkSince = 0;
    const meSpeaking = this.media.micOn && myLevel > SPEAKING_LEVEL;
    if (meSpeaking !== this.view.me.speaking) changed = true;
    if (changed) this.emit();
  }

  // ————— Outgoing —————
  private sendState() {
    if (this.phase !== "in") return;
    const state = { mic: this.media.micOn, cam: this.media.camOn, screen: !!this.media.screenTrack, hand: this.hand };
    const key = JSON.stringify(state);
    if (key === this.lastSent) return;
    this.lastSent = key;
    this.channel.state(state);
  }

  toggleMic = async () => {
    await this.media.setMic(!this.media.micOn);
    if (this.media.problems.mic) this.toast({ kind: "warn", text: problemMessage(this.media, "mic") }, 7_000);
  };
  toggleCam = async () => {
    this.camWanted = !this.media.camOn;
    await this.media.setCam(this.camWanted);
    if (this.camWanted && this.media.problems.cam) this.toast({ kind: "warn", text: problemMessage(this.media, "cam") }, 7_000);
  };
  toggleScreen = async () => {
    if (this.media.screenTrack) return this.media.stopScreen();
    const ok = await this.media.startScreen();
    if (!ok && this.media.problems.screen) this.toast({ kind: "warn", text: problemMessage(this.media, "screen") }, 7_000);
  };
  setHand = (on: boolean) => {
    this.hand = on;
    if (on) play("hand", this.media.choice.audiooutput);
    this.sendState();
    this.emit();
  };
  react = (emoji: string) => {
    this.float(emoji, this.myName);
    void this.channel.post("/react", { emoji });
  };
  sendChat = (text: string) => {
    const line: ChatLine = { id: uid(), from: this.peerId, name: this.myName, text, at: Date.now(), mine: true, status: "sending" };
    this.chat.push(line);
    this.emit();
    void this.deliver(line);
  };
  retryChat = (id: string) => {
    const line = this.chat.find((c) => c.id === id && c.mine);
    if (!line) return;
    line.status = "sending";
    this.emit();
    void this.deliver(line);
  };
  private async deliver(line: ChatLine) {
    const answer = await this.channel.post("/chat", { id: line.id, text: line.text });
    line.status = answer.status === 201 ? "sent" : "failed";
    if (answer.status !== 201 && answer.status !== 0) {
      const error = (answer.data as { error?: string } | null)?.error;
      if (error) this.toast({ kind: "warn", text: error }, 5_000);
    }
    this.emit();
  }
  setChatOpen = (open: boolean) => {
    this.chatOpen = open;
    if (open && this.unread) this.unread = 0;
    this.toasts = this.toasts.filter((t) => !(open && t.kind === "chat"));
    this.emit();
  };
  chooseDevice = async (kind: keyof DeviceChoice, id: string) => {
    await this.media.choose(kind, id);
    if (kind === "audiooutput") for (const r of this.remotes.values()) if (r.audio) this.applySpeaker(r.audio);
  };
  retryLink = (peerId: string) => this.remotes.get(peerId)?.link.retry(true);

  // ————— Host tools —————
  private async host(body: Record<string, unknown>) {
    const answer = await this.channel.post<{ error?: string }>("/host", body);
    if (answer.status !== 200) this.toast({ kind: "warn", text: answer.data?.error ?? "That didn't work. Try again." }, 5_000);
    return answer.status === 200;
  }
  admit = (knockId: string, allow: boolean) => {
    this.dismissKnock(knockId);
    return this.host({ action: allow ? "admit" : "deny", knock: knockId });
  };
  admitAll = () => {
    this.toasts = this.toasts.filter((t) => t.kind !== "knock");
    return this.host({ action: "admit-all" });
  };
  mute = (peerId: string) => this.host({ action: "mute", peer: peerId });
  muteAll = () => this.host({ action: "mute-all" });
  lowerHand = (peerId: string) => this.host({ action: "lower-hand", peer: peerId });
  lowerAll = () => this.host({ action: "lower-all" });
  stopScreenOf = (peerId: string) => this.host({ action: "stop-screen", peer: peerId });
  removePerson = (peerId: string) => this.host({ action: "remove", peer: peerId });
  makeCohost = (peerId: string, on: boolean) => this.host({ action: "cohost", peer: peerId, on });
  lock = (on: boolean) => this.host({ action: "lock", on });
  endForAll = async () => {
    if (await this.host({ action: "end" })) this.finish("ended", "You ended the call for everyone.");
  };

  leave = async () => {
    if (this.phase !== "in") return;
    const seat = this.seat;
    this.finish("left", "You left the call.");
    const answer = await this.channel.post("/leave", { seat });
    if (answer.status === 0) leaveBeacon(seat);
  };

  // ————— Notices —————
  private toast(toast: Omit<Toast, "id">, ms: number) {
    const id = uid();
    this.toasts = [...this.toasts.filter((t) => t.text !== toast.text), { ...toast, id }].slice(-4);
    window.setTimeout(() => this.dismissToast(id), ms);
    this.emit();
  }
  dismissToast = (id: string) => {
    const before = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    if (this.toasts.length !== before) this.emit();
  };
  private dismissKnock(knockId: string) {
    this.toasts = this.toasts.filter((t) => t.knockId !== knockId);
    this.emit();
  }
  private float(emoji: string, name: string) {
    const id = uid();
    this.reactions = [...this.reactions, { id, emoji, name }].slice(-12);
    window.setTimeout(() => {
      this.reactions = this.reactions.filter((r) => r.id !== id);
      this.emit();
    }, 3200);
    this.emit();
  }

  // ————— Page life —————
  private onVisibility = () => {
    if (document.visibilityState !== "visible" || this.phase !== "in") return;
    void this.keepScreenOn();
    // Phones stop the camera in the background: bring it back if it was on.
    if (this.camWanted && !this.media.camTrack) void this.media.setCam(true);
  };
  private onPageHide = () => {
    if (this.phase === "in") leaveBeacon(this.seat);
  };
  private async keepScreenOn() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && document.visibilityState === "visible") this.wakeLock = await nav.wakeLock.request("screen");
    } catch {
      /* Not supported, or the battery saver said no. */
    }
  }

  /** Stop everything (left, ended, removed, or lost). The last view stays for the "you left" page. */
  private finish(phase: CallPhase, message: string) {
    if (this.phase !== "in") return;
    this.phase = phase;
    this.endMessage = message;
    this.channel.stop();
    window.clearInterval(this.levelTimer);
    window.clearTimeout(this.graceTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    for (const [id, remote] of this.remotes) this.dropRemote(id, remote);
    this.unsubscribeMedia();
    this.media.stop();
    this.audioBox.remove();
    void this.audioContext?.close().catch(() => undefined);
    void this.wakeLock?.release().catch(() => undefined);
    this.toasts = [];
    if (phase === "removed" || phase === "ended") session.set(passKey(this.code), null);
    if (phase !== "removed") play("leave");
    this.emit();
    callStore.changed();
  }

  // ————— The view the UI draws —————
  private buildView(): CallView {
    const s = this.snapshot;
    const media = this.media;
    const current = s?.peers ?? [{ id: this.peerId, name: this.myName, role: "member" as PeerRole, guest: false, state: { mic: false, cam: false, screen: false, hand: null }, joinedAt: Date.now() }];
    // People kept through a restart's grace still show (from what we last knew).
    const kept = [...this.remotes.values()].map((r) => r.wire).filter((w) => !current.some((p) => p.id === w.id));
    const wires = [...current, ...kept];
    const order = [...wires].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    const now = performance.now();
    const people: Person[] = order.map((wire, index) => {
      const me = wire.id === this.peerId;
      if (me) {
        const state: PeerState = { mic: media.micOn, cam: media.camOn, screen: !!media.screenTrack, hand: this.hand ? (wire.state.hand ?? Date.now()) : null };
        return {
          ...wire,
          name: wire.name,
          me: true,
          number: index + 1,
          state,
          cam: media.camOn ? media.camStream : null,
          screen: media.screenStream,
          link: "self",
          quality: null,
          speaking: media.micOn && media.level() > SPEAKING_LEVEL,
        };
      }
      const r = this.remotes.get(wire.id);
      const flowing = (stream: MediaStream | null | undefined) => {
        const track = stream?.getVideoTracks()[0];
        return track && track.readyState === "live" && !track.muted ? stream! : null;
      };
      return {
        ...wire,
        me: false,
        number: index + 1,
        cam: wire.state.cam ? flowing(r?.link.streams.cam) : null,
        screen: wire.state.screen ? flowing(r?.link.streams.screen) : null,
        link: r?.link.status ?? "connecting",
        quality: r?.link.quality ?? null,
        speaking: !!r && r.speakingUntil > now,
      };
    });
    const me = people.find((p) => p.me)!;
    const role = s?.you.role ?? "member";
    return {
      phase: this.phase,
      endMessage: this.endMessage,
      code: this.code,
      title: s?.room.title ?? "",
      role,
      canManage: role === "host" || role === "cohost",
      locked: s?.room.locked ?? false,
      guestsAllowed: s?.room.guestsAllowed ?? true,
      startedAt: this.startedAt || this.joinedAt,
      joinedAt: this.joinedAt,
      maxPeople: s?.room.maxPeople ?? 8,
      me,
      people,
      knocks: role === "host" || role === "cohost" ? (s?.knocks ?? []) : [],
      chat: [...this.chat],
      unread: this.unread,
      reactions: this.reactions,
      toasts: this.toasts,
      activeSpeaker: this.activeSpeaker,
      trouble: this.trouble,
      rejoining: this.rejoining,
      audioBlocked: this.audioBlocked,
      relayAvailable: this.relayAvailable,
      relayInUse: [...this.remotes.values()].some((r) => r.link.relayed),
      mic: media.micOn,
      cam: media.camOn,
      screen: !!media.screenTrack,
      hand: this.hand,
      media,
      speaker: media.choice.audiooutput,
    };
  }
}

function problemMessage(media: LocalMedia, kind: "mic" | "cam" | "screen") {
  const problem = media.problems[kind];
  const what = kind === "mic" ? "microphone" : kind === "cam" ? "camera" : "screen sharing";
  return problem ? problemText[problem](what) : "";
}
