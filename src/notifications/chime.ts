/** A short, soft two-note chime made in the browser (no sound file). Silent if the browser won't play audio yet. */
let context: AudioContext | null = null;
let last = 0;

export function chime() {
  const now = Date.now();
  if (now - last < 1500) return; // a burst of messages chimes once
  last = now;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const start = context.currentTime + 0.01;
    for (const [frequency, offset] of [
      [784, 0],
      [1175, 0.11],
    ] as const) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.07, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.3);
      osc.connect(gain).connect(context.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.32);
    }
  } catch {
    /* No sound is fine. */
  }
}
