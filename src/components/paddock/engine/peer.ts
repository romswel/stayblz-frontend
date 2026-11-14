/**
 * One direct connection to one other person (WebRTC). Video and audio go straight between the two
 * browsers; only short setup messages (signals) pass through the Stayblz API.
 *
 * - The person with the smaller id starts ("initiator") and creates three fixed slots:
 *   audio, camera, screen. The other side fills the same slots when it answers, so turning the
 *   camera or screen on/off later is a track swap, not a new connection.
 * - "Perfect negotiation" settles the rare moment when both sides change something at once.
 * - Every signal carries a generation (gen). A fresh connection (Retry) bumps it, so late
 *   messages for an old connection are ignored.
 * - Lost connections restart ICE (find a new network path) and, if that fails, start over.
 */
export type LinkStatus = "connecting" | "connected" | "reconnecting" | "failed" | "closed";
export type Quality = "good" | "fair" | "poor";
export type Slot = "audio" | "cam" | "screen";
const SLOTS: Slot[] = ["audio", "cam", "screen"];

export interface LocalTracks {
  audio: MediaStreamTrack | null;
  cam: MediaStreamTrack | null;
  screen: MediaStreamTrack | null;
}
export interface LinkOptions {
  selfId: string;
  remoteId: string;
  iceServers: RTCIceServer[];
  send: (type: string, gen: number, data: unknown) => void;
  local: () => LocalTracks;
  onChange: () => void;
  /** Camera bitrate cap for the current room size. */
  camBitrate: () => number;
}

const CONNECT_TIMEOUT_MS = 20_000;
const RECONNECT_AFTER_MS = 3_000;
const MAX_RESETS = 2;
const SCREEN_BITRATE = 1_600_000;

export class PeerLink {
  readonly initiator: boolean;
  gen = 1;
  status: LinkStatus = "connecting";
  quality: Quality | null = null;
  relayed = false;
  streams: Record<Slot, MediaStream | null> = { audio: null, cam: null, screen: null };
  private pc!: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private settingAnswer = false;
  private queue: Promise<void> = Promise.resolve();
  private connectTimer = 0;
  private reconnectTimer = 0;
  private statsTimer = 0;
  private resets = 0;
  private lastStats = new Map<string, { lost: number; received: number }>();
  private closed = false;

  constructor(private readonly o: LinkOptions) {
    this.initiator = o.selfId < o.remoteId;
    this.build();
  }

  private build() {
    const pc = new RTCPeerConnection({ iceServers: this.o.iceServers, bundlePolicy: "max-bundle" });
    this.pc = pc;
    this.makingOffer = this.ignoreOffer = this.settingAnswer = false;
    this.streams = { audio: null, cam: null, screen: null };
    this.quality = null;
    const gen = this.gen;
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && pc === this.pc) this.o.send("candidate", gen, candidate.toJSON());
    };
    pc.onnegotiationneeded = async () => {
      if (pc !== this.pc) return;
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (pc === this.pc && pc.localDescription) this.o.send("description", gen, pc.localDescription.toJSON());
      } catch {
        /* A newer change will negotiate again. */
      } finally {
        this.makingOffer = false;
      }
    };
    pc.ontrack = (event) => {
      if (pc !== this.pc) return;
      const index = pc.getTransceivers().indexOf(event.transceiver);
      const slot = SLOTS[index];
      if (!slot) return;
      this.streams[slot] = new MediaStream([event.track]);
      // A track goes quiet when the other side turns its camera off; the UI follows "muted".
      event.track.onmute = event.track.onunmute = () => pc === this.pc && this.o.onChange();
      this.o.onChange();
    };
    pc.onconnectionstatechange = () => pc === this.pc && this.onConnectionState();
    if (this.initiator) {
      // The three slots, always in this order on both sides.
      const local = this.o.local();
      for (const slot of SLOTS) pc.addTransceiver(local[slot] ?? (slot === "audio" ? "audio" : "video"), { direction: "sendrecv" });
    }
    window.clearTimeout(this.connectTimer);
    this.connectTimer = window.setTimeout(() => this.connectTimedOut(), CONNECT_TIMEOUT_MS);
    this.setStatus(this.status === "failed" ? "connecting" : this.status === "connected" ? "reconnecting" : "connecting");
  }

  private setStatus(status: LinkStatus) {
    if (this.status === status) return;
    this.status = status;
    this.o.onChange();
  }

  private onConnectionState() {
    const state = this.pc.connectionState;
    if (state === "connected") {
      window.clearTimeout(this.connectTimer);
      window.clearTimeout(this.reconnectTimer);
      this.resets = 0;
      this.setStatus("connected");
      void this.applyBitrates();
      this.startStats();
    } else if (state === "disconnected") {
      this.setStatus("reconnecting");
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => this.pc.connectionState !== "connected" && this.restart(), RECONNECT_AFTER_MS);
    } else if (state === "failed") {
      this.setStatus("reconnecting");
      this.restart();
    }
  }

  private connectTimedOut() {
    if (this.closed || this.pc.connectionState === "connected") return;
    if (this.resets < MAX_RESETS) this.retry();
    else this.setStatus("failed");
  }

  /** Find a new network path on the same connection. */
  private restart() {
    if (this.closed) return;
    if (this.initiator) this.pc.restartIce();
    else this.o.send("restart", this.gen, null);
    window.clearTimeout(this.connectTimer);
    this.connectTimer = window.setTimeout(() => this.connectTimedOut(), CONNECT_TIMEOUT_MS);
  }

  /** Start this connection over (the Retry button, or a stuck connection). */
  retry(manual = false) {
    if (this.closed) return;
    this.resets = manual ? 0 : this.resets + 1;
    if (this.initiator) {
      this.pc.close();
      this.gen++;
      this.o.send("reset", this.gen, null);
      this.build();
    } else {
      // Ask the initiator to start over, and keep counting in case it never answers.
      this.o.send("reset", this.gen, null);
      window.clearTimeout(this.connectTimer);
      this.connectTimer = window.setTimeout(() => this.connectTimedOut(), CONNECT_TIMEOUT_MS);
    }
    this.setStatus("connecting");
  }

  /** Signals from the other person, handled strictly one after another. */
  handle(type: string, gen: number, data: unknown) {
    this.queue = this.queue.then(() => this.process(type, gen, data)).catch(() => undefined);
  }

  private async process(type: string, gen: number, data: unknown) {
    if (this.closed) return;
    if (this.initiator) {
      // Requests for an older connection are stale.
      if (gen !== this.gen) return;
      if (type === "reset") return this.retry();
      if (type === "restart") return this.restart();
    } else {
      if (gen < this.gen) return;
      if (gen > this.gen) {
        // The initiator started over: follow it with a fresh connection.
        this.pc.close();
        this.gen = gen;
        this.build();
      }
      if (type === "reset" || type === "restart") return;
    }
    const pc = this.pc;
    if (type === "description") {
      const description = data as RTCSessionDescriptionInit;
      const readyForOffer = !this.makingOffer && (pc.signalingState === "stable" || this.settingAnswer);
      const collision = description.type === "offer" && !readyForOffer;
      // The initiator is the "impolite" side: it keeps its own offer when both offer at once.
      this.ignoreOffer = this.initiator && collision;
      if (this.ignoreOffer) return;
      this.settingAnswer = description.type === "answer";
      await pc.setRemoteDescription(description);
      this.settingAnswer = false;
      if (description.type === "offer") {
        if (!this.initiator) await this.fillSlots();
        await pc.setLocalDescription();
        if (pc === this.pc && pc.localDescription) this.o.send("description", this.gen, pc.localDescription.toJSON());
      }
    } else if (type === "candidate") {
      try {
        await pc.addIceCandidate(data as RTCIceCandidateInit);
      } catch {
        /* A candidate for an offer we ignored, or a duplicate: harmless. */
      }
    }
  }

  /** The answering side sends its own audio/camera/screen in the initiator's slots. */
  private async fillSlots() {
    const local = this.o.local();
    await Promise.all(
      this.pc.getTransceivers().map((t, i) => {
        const slot = SLOTS[i];
        if (!slot || t.direction === "stopped") return undefined;
        if (t.direction !== "sendrecv") t.direction = "sendrecv";
        return t.sender.track !== local[slot] ? t.sender.replaceTrack(local[slot]).catch(() => undefined) : undefined;
      }),
    );
  }

  /** Camera/mic/screen changed: swap tracks in place (no reconnect needed). */
  updateTracks() {
    if (this.closed) return;
    const local = this.o.local();
    this.pc.getTransceivers().forEach((t, i) => {
      const slot = SLOTS[i];
      if (!slot || t.direction === "stopped" || t.direction === "inactive") return;
      if (!this.initiator && !t.currentDirection) return; // not answered yet; fillSlots will do it
      if (t.sender.track !== local[slot]) void t.sender.replaceTrack(local[slot]).catch(() => undefined);
    });
    void this.applyBitrates();
  }

  /** Smaller rooms get sharper video; every extra person shares the same upload. */
  async applyBitrates() {
    if (this.closed) return;
    const transceivers = this.pc.getTransceivers();
    const targets: [RTCRtpSender | undefined, number, RTCDegradationPreference][] = [
      [transceivers[1]?.sender, this.o.camBitrate(), "balanced"],
      [transceivers[2]?.sender, SCREEN_BITRATE, "maintain-resolution"],
    ];
    for (const [sender, maxBitrate, preference] of targets) {
      if (!sender?.track) continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        if (params.encodings[0].maxBitrate === maxBitrate) continue;
        params.encodings[0].maxBitrate = maxBitrate;
        if (sender === transceivers[2]?.sender) params.encodings[0].maxFramerate = 15;
        (params as RTCRtpSendParameters & { degradationPreference?: RTCDegradationPreference }).degradationPreference = preference;
        await sender.setParameters(params);
      } catch {
        /* Not every browser accepts every setting; the defaults still work. */
      }
    }
  }

  /** Connection quality from packet loss and round-trip time, every few seconds. */
  private startStats() {
    if (this.statsTimer) return;
    this.statsTimer = window.setInterval(async () => {
      if (this.closed || this.pc.connectionState !== "connected") return;
      try {
        const report = await this.pc.getStats();
        let rtt = 0;
        let lossRatio = 0;
        let relayed = false;
        const pairs: RTCStats[] = [];
        report.forEach((s) => {
          if (s.type === "candidate-pair" && (s as RTCIceCandidatePairStats).nominated && (s as RTCIceCandidatePairStats).state === "succeeded")
            pairs.push(s);
          if (s.type === "inbound-rtp") {
            const r = s as RTCInboundRtpStreamStats;
            const before = this.lastStats.get(r.id) ?? { lost: 0, received: 0 };
            const lost = (r.packetsLost ?? 0) - before.lost;
            const received = (r.packetsReceived ?? 0) - before.received;
            this.lastStats.set(r.id, { lost: r.packetsLost ?? 0, received: r.packetsReceived ?? 0 });
            if (lost + received > 20) lossRatio = Math.max(lossRatio, Math.max(0, lost) / (lost + received));
          }
        });
        for (const pair of pairs) {
          const p = pair as RTCIceCandidatePairStats;
          rtt = Math.max(rtt, p.currentRoundTripTime ?? 0);
          const local = report.get(p.localCandidateId) as { candidateType?: string } | undefined;
          if (local?.candidateType === "relay") relayed = true;
        }
        const quality: Quality = rtt < 0.3 && lossRatio < 0.03 ? "good" : rtt < 0.7 && lossRatio < 0.1 ? "fair" : "poor";
        if (quality !== this.quality || relayed !== this.relayed) {
          this.quality = quality;
          this.relayed = relayed;
          this.o.onChange();
        }
      } catch {
        /* Stats are a nice-to-have. */
      }
    }, 3000);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.connectTimer);
    window.clearTimeout(this.reconnectTimer);
    window.clearInterval(this.statsTimer);
    try {
      this.pc.close();
    } catch {
      /* Already closed. */
    }
    this.status = "closed";
  }
}
