/** Short, quiet tones made in the browser (no sound files to download). Off when the person says so. */
type Cue = "join" | "leave" | "knock" | "hand" | "message";

const NOTES: Record<Cue, [number, number][]> = {
  join: [[660, 0], [880, 0.09]],
  leave: [[660, 0], [494, 0.09]],
  knock: [[784, 0], [988, 0.12], [784, 0.24]],
  hand: [[1046, 0]],
  message: [[880, 0]],
};
const SOUND_KEY = "stayblz.paddock.sounds";
let context: AudioContext | null = null;

export function soundsOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* A convenience only. */
  }
}

export function play(cue: Cue, sinkId?: string, force = false) {
  if (!force && !soundsOn()) return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const ctx = context as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (sinkId && ctx.setSinkId) void ctx.setSinkId(sinkId).catch(() => undefined);
    const start = ctx.currentTime + 0.01;
    for (const [frequency, offset] of NOTES[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.06, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.25);
    }
  } catch {
    /* No sound is fine. */
  }
}
