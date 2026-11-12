import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MenuEntry =
  | { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; checked?: boolean; disabled?: boolean }
  | { section: string };

/**
 * Small dropdown menu anchored to a button. Rendered above everything (so scrolling lists don't
 * clip it), kept inside the window, arrow keys move, Escape closes and returns focus.
 */
export default function Menu({
  anchor,
  items,
  onClose,
  label,
  align = "end",
}: {
  anchor: HTMLElement | null;
  items: MenuEntry[];
  onClose: () => void;
  label: string;
  align?: "start" | "end";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // The parent passes a new onClose on every render; keep the latest without re-running the setup below.
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const el = box.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pad = 8;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - pad) top = Math.max(pad, r.top - h - 4);
    setPos({ top, left });
  }, [anchor, align, items.length]);

  useEffect(() => {
    const el = box.current;
    const buttons = () => Array.from(el?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    buttons()[0]?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        anchor?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = buttons();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
      } else if (e.key === "Tab") close.current();
    };
    const onDown = (e: PointerEvent) => {
      if (el && !el.contains(e.target as Node) && !anchor?.contains(e.target as Node)) close.current();
    };
    const onScroll = (e: Event) => {
      if (el && !el.contains(e.target as Node)) close.current();
    };
    const onResize = () => close.current();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={box}
      className="mx-menu"
      role="menu"
      aria-label={label}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
    >
      {items.map((item, i) =>
        "section" in item ? (
          <div key={`s${i}`} className="mx-menu-section" role="presentation">
            {item.section}
          </div>
        ) : (
          <button
            key={`${item.label}${i}`}
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.checked}
            className={item.danger ? "is-danger" : undefined}
            disabled={item.disabled}
            onClick={() => {
              close.current();
              item.onSelect();
            }}
          >
            <span className="mx-menu-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.checked && <span className="mx-menu-check" aria-hidden="true">✓</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
