/**
 * The call's line to the Stayblz API: one long-poll at a time for news (who's here, their state,
 * setup signals, chat), and a small ordered outbox for this browser's own changes.
 * Network trouble never ends the call: requests retry with growing pauses, and video that is
 * already flowing between browsers keeps going meanwhile.
 */
import { live, type GoneReason, type Snapshot } from "../paddockApi";

export interface OutState {
  mic?: boolean;
  cam?: boolean;
  screen?: boolean;
  hand?: boolean;
}
interface Events {
  snapshot: (snapshot: Snapshot) => void;
  gone: (reason: GoneReason, message: string) => void;
  trouble: (on: boolean) => void;
}

const WAIT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export class LiveChannel {
  private running = false;
  private since = 0;
  private lastSeq = 0;
  private epoch = "";
  private feedSince = 0;
  private first = true;
  private abort: AbortController | null = null;
  private failures = 0;
  private outbox: { to: string; type: string; gen: number; data: unknown }[] = [];
  private pendingState: OutState | null = null;
  private flushing = false;
  private flushTimer = 0;
  private sendFailures = 0;
  private seatReady: (() => void) | null = null;
  private seatLost = false;

  constructor(
    private seat: string,
    private readonly events: Events,
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }
  stop() {
    this.running = false;
    this.abort?.abort();
    this.seatReady?.();
    window.clearTimeout(this.flushTimer);
  }
  get currentSeat() {
    return this.seat;
  }

  /** After a quiet re-join: carry on with the new seat (and send everything again). */
  setSeat(seat: string) {
    this.seat = seat;
    this.since = 0;
    this.first = true;
    this.seatLost = false;
    this.abort?.abort();
    const ready = this.seatReady;
    this.seatReady = null;
    ready?.();
    this.schedule();
  }

  private async loop() {
    while (this.running) {
      if (this.seatLost) {
        await new Promise<void>((resolve) => (this.seatReady = resolve));
        continue;
      }
      const controller = new AbortController();
      this.abort = controller;
      let timedOut = false;
      const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
      let answer;
      try {
        answer = await live<Snapshot>(
          "/sync",
          { since: this.since, ack: this.lastSeq, epoch: this.epoch || undefined, feedSince: this.feedSince, wait: this.first ? 0 : WAIT_MS },
          { seat: this.seat, signal: controller.signal },
        );
      } catch {
        window.clearTimeout(timer);
        if (!this.running) return;
        if (timedOut) await this.failed();
        continue; // aborted for a new seat: go again straight away
      }
      window.clearTimeout(timer);
      if (!this.running) return;
      if (answer.status === 200) {
        if (this.failures) this.events.trouble(false);
        this.failures = 0;
        this.receive(answer.data);
      } else if (answer.status === 410) {
        const data = answer.data as unknown as { code?: GoneReason; error?: string };
        const reason = data.code ?? "expired";
        if (reason === "expired") this.seatLost = true;
        else this.running = false;
        this.events.gone(reason, data.error ?? "");
      } else await this.failed();
    }
  }

  private async failed() {
    this.failures++;
    if (this.failures === 2) this.events.trouble(true);
    await sleep(Math.min(8000, 400 * 2 ** this.failures));
  }

  private receive(snapshot: Snapshot) {
    if (snapshot.you.epoch !== this.epoch) {
      // A new inbox (first answer, or the server restarted): numbering starts again.
      this.epoch = snapshot.you.epoch;
      this.lastSeq = 0;
    }
    const fresh = snapshot.signals.filter((s) => s.seq > this.lastSeq);
    for (const s of snapshot.signals) this.lastSeq = Math.max(this.lastSeq, s.seq);
    this.since = snapshot.version;
    this.feedSince = snapshot.feedSeq;
    this.first = false;
    this.events.snapshot({ ...snapshot, signals: fresh });
  }

  signal(to: string, type: string, gen: number, data: unknown) {
    this.outbox.push({ to, type, gen, data });
    this.schedule();
  }
  state(next: OutState) {
    this.pendingState = { ...this.pendingState, ...next };
    this.schedule();
  }

  /** Gather a burst of changes (ICE candidates come in quick bursts) into one request. */
  private schedule() {
    if (this.flushTimer || !this.running) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = 0;
      void this.flush();
    }, 25);
  }

  private async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.running && !this.seatLost && (this.outbox.length || this.pendingState)) {
        const signals = this.outbox.splice(0, 50);
        const state = this.pendingState;
        this.pendingState = null;
        const answer = await live("/send", { ...(state ? { state } : {}), ...(signals.length ? { signals } : {}) }, { seat: this.seat });
        if (answer.status === 200 || answer.status === 400) {
          // 400: something invalid (it would never succeed); carry on with the rest.
          this.sendFailures = 0;
          continue;
        }
        // Keep it for later, in order.
        this.outbox.unshift(...signals);
        if (state) this.pendingState = { ...state, ...(this.pendingState ?? {}) };
        if (answer.status === 410) break; // the seat is being renewed; setSeat() sends again
        this.sendFailures++;
        await sleep(Math.min(5000, 300 * 2 ** this.sendFailures));
      }
    } finally {
      this.flushing = false;
    }
  }

  /** Chat, reactions, host tools. */
  post<T = unknown>(path: string, body: unknown) {
    return live<T>(path, body, { seat: this.seat });
  }
}
