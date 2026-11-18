import { useEffect, useState, type RefObject } from "react";

/** A thin bar at the top of the window that fills as the post is read. */
export function ReadingProgress({ target }: { target: RefObject<HTMLElement | null> }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = target.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const total = box.height - window.innerHeight * 0.6;
      setProgress(total > 0 ? Math.min(1, Math.max(0, -box.top / total)) : 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    // The signed-in layout scrolls the window; listen on capture so inner scrollers count too.
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [target]);
  return (
    <div
      className="up-progress"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}

/** "In this post": links to the post's headings; the one being read is marked. */
export function PostOutline({ headings }: { headings: { id: string; text: string; level: 1 | 2 }[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);
  if (headings.length < 2) return null;
  return (
    <nav className="up-outline" aria-label="In this post">
      <span className="up-outline-title">In this post</span>
      <ol>
        {headings.map((h) => (
          <li key={h.id} className={h.level === 2 ? "is-sub" : undefined}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? "location" : undefined}
              onClick={(event) => {
                const el = document.getElementById(h.id);
                if (!el) return;
                event.preventDefault();
                el.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                  block: "start",
                });
                setActive(h.id);
                history.replaceState(history.state, "", `#${h.id}`);
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
