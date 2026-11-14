import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Corner = "tl" | "tr" | "bl" | "br";
const read = (key: string): Corner => {
  try {
    const saved = localStorage.getItem(key);
    return saved === "tl" || saved === "tr" || saved === "bl" ? saved : "br";
  } catch {
    return "br";
  }
};

/**
 * A small window you can drag; it settles in the nearest corner of its area (the stage, or the
 * whole window) and remembers it. Buttons inside still work normally.
 */
export default function CornerFloat({
  storageKey,
  scope,
  className,
  label,
  children,
}: {
  storageKey: string;
  scope: "parent" | "window";
  className: string;
  label?: string;
  children: ReactNode;
}) {
  const [corner, setCorner] = useState<Corner>(() => read(storageKey));
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, corner);
    } catch {
      /* A convenience. */
    }
  }, [corner, storageKey]);
  const bounds = () => {
    const parent = box.current?.parentElement;
    return scope === "window" || !parent ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : parent.getBoundingClientRect();
  };
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a, input, select")) return;
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const b = bounds();
    start.current = { px: e.clientX, py: e.clientY, x: r.left - b.left, y: r.top - b.top, moved: false };
    el.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!s.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    s.moved = true;
    setDrag({ x: s.x + dx, y: s.y + dy });
  }
  function up() {
    const el = box.current;
    if (start.current?.moved && drag && el) {
      const b = bounds();
      const cx = drag.x + el.offsetWidth / 2;
      const cy = drag.y + el.offsetHeight / 2;
      setCorner(`${cy < b.height / 2 ? "t" : "b"}${cx < b.width / 2 ? "l" : "r"}` as Corner);
    }
    start.current = null;
    setDrag(null);
  }
  return (
    <div
      ref={box}
      className={`${className} is-${corner}${drag ? " is-dragging" : ""}`}
      style={drag ? { left: drag.x, top: drag.y, right: "auto", bottom: "auto" } : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-label={label}
      role={label ? "region" : undefined}
    >
      {children}
    </div>
  );
}
