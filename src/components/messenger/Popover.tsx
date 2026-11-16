import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Floats its content next to an anchor (above it when there's room, else below), kept inside the
 * window and drawn above everything, so a scrolling message list can't clip it.
 */
export default function Popover({
  anchor,
  align = "start",
  children,
}: {
  anchor: HTMLElement | null;
  align?: "start" | "end" | "center";
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pad = 8;
    let left = align === "end" ? r.right - w : align === "center" ? r.left + r.width / 2 - w / 2 : r.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
    let top = r.top - h - 6;
    let below = false;
    if (top < pad) {
      top = Math.max(pad, Math.min(r.bottom + 6, window.innerHeight - h - pad));
      below = true;
    }
    setPos({ top, left, below });
  }, [anchor, align, children]);
  return createPortal(
    <div
      ref={box}
      className={`mx-popover mx-layer gx-layer${pos?.below ? " is-below" : ""}`}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}
