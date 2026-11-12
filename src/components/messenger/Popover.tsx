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
  align?: "start" | "end";
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pad = 8;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
    let top = r.top - h - 6;
    if (top < pad) top = Math.max(pad, Math.min(r.bottom + 6, window.innerHeight - h - pad));
    setPos({ top, left });
  }, [anchor, align, children]);
  return createPortal(
    <div ref={box} className="mx-popover" style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}>
      {children}
    </div>,
    document.body,
  );
}
