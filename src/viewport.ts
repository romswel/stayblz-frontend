/**
 * Keeps the layout in step with what a phone really shows, mainly for the on-screen keyboard on iPhone.
 *
 * iOS (and Android Chrome by default) doesn't shrink the page for the keyboard: it slides a smaller "visual
 * viewport" over the page. Anything pinned with position:fixed (the chat window, bottom sheets, the tab bar) stays
 * sized to the full screen, so the keyboard — and the ^ ˅ ✓ bar iOS puts on top of it — covers the box you're
 * typing in. This sets CSS variables on <html> from window.visualViewport so those parts can follow the visible area:
 *
 *   --vvh        visible height (px)              --vv-offset  how far the visible area is panned down (px)
 *   --vv-bottom  bottom edge of the visible area, measured from the top of the layout viewport (px)
 *   html.kb-open    the keyboard is up (a text field has focus and the visible area shrank)
 *   html.vv-drift   the keyboard is down but iOS left the page out of line (fixed bars would float mid-screen)
 *
 * When the keyboard closes, iOS sometimes leaves the layout viewport offset, which drags fixed bars up into the
 * page (the "tab bar in the middle of the screen" bug). A one-pixel scroll nudge makes it line everything up again.
 *
 * Size things from --vvh only under html.kb-open / html.vv-drift. With the keyboard down, full-screen parts fill the
 * screen with plain CSS (inset: 0): iPhone Home Screen apps report a visible area that stops short of the bottom, so
 * a measured height left a band under the chat (v0.24 fix).
 */
const KEYBOARD_PX = 120;

const editable = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color", "image"].includes(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable) ||
    el instanceof HTMLSelectElement);

let started = false;

export function startViewportWatch() {
  if (started || typeof window === "undefined") return;
  started = true;
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv) return;
  let frame = 0;
  let wasOpen = false;
  // The tallest visible height seen in this orientation = the height with no keyboard.
  let full = 0;
  let orientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";

  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  function nudge() {
    // Re-anchors fixed and sticky parts after iOS left the page offset (no visible jump: scroll back at once).
    const y = window.scrollY;
    window.scrollTo(window.scrollX, y + 1);
    window.scrollTo(window.scrollX, y);
  }
  function update() {
    frame = 0;
    const turned = window.innerWidth > window.innerHeight ? "landscape" : "portrait";
    if (turned !== orientation) {
      orientation = turned;
      full = 0;
    }
    const zoomed = Math.abs(vv!.scale - 1) > 0.01;
    const height = zoomed ? window.innerHeight : vv!.height;
    const offset = zoomed ? 0 : Math.max(0, vv!.offsetTop);
    full = Math.max(full, height, zoomed ? 0 : window.innerHeight);
    const open = !zoomed && editable(document.activeElement) && full - height > KEYBOARD_PX;
    root.style.setProperty("--vvh", px(height));
    root.style.setProperty("--vv-offset", px(offset));
    root.style.setProperty("--vv-bottom", px(offset + height));
    root.classList.toggle("kb-open", open);
    // Keyboard down, not zoomed, but the visible area doesn't start at the top of the layout viewport.
    const drift = !open && !zoomed && offset > 1;
    root.classList.toggle("vv-drift", drift);
    // Only right after the keyboard closes (never while someone is scrolling): CSS covers any drift left over.
    if (wasOpen && !open) {
      requestAnimationFrame(nudge);
      window.setTimeout(() => {
        nudge();
        schedule();
      }, 350);
    }
    wasOpen = open;
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  // The window itself changing size (browser bars showing or hiding, split screen, a desktop window).
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("focusin", schedule);
  // Leaving a field: the keyboard is about to close.
  document.addEventListener("focusout", () => window.setTimeout(schedule, 60));
  document.addEventListener("visibilitychange", () => !document.hidden && schedule());
  update();
}
