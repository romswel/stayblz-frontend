import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import "./public-motion.css";

// Animate existing DOM so navigation never remounts a form or drops its draft.
export default function usePublicMotion() {
  const root = useRef<HTMLDivElement>(null);
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef<string | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const accountPaths = ["/", "/login", "/signup"];
    const switchingAccountMode =
      previousPath.current !== null &&
      accountPaths.includes(previousPath.current) &&
      accountPaths.includes(pathname);
    previousPath.current = pathname;
    if (
      navigationType !== "POP" &&
      !window.location.hash &&
      !switchingAccountMode
    )
      window.scrollTo({ top: 0, behavior: "instant" });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let entrance: Animation | undefined;
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const targets = element.querySelectorAll<HTMLElement>(".ld-reveal");
    function updateProgress() {
      frame = 0;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      element!.style.setProperty(
        "--public-scroll",
        String(
          range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0,
        ),
      );
    }
    function scroll() {
      if (!frame) frame = requestAnimationFrame(updateProgress);
    }
    function configure() {
      entrance?.cancel();
      observer?.disconnect();
      targets.forEach((target) =>
        target.classList.remove("ld-await-reveal", "ld-visible"),
      );
      if (reduced.matches) return;
      const main = element!.querySelector("main");
      if (main && typeof main.animate === "function")
        entrance = main.animate(
          [
            { opacity: 0.55, transform: "translateY(7px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 220, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
      if (!("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("ld-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.06 },
      );
      targets.forEach((target) => {
        target.classList.add("ld-await-reveal");
        observer!.observe(target);
      });
    }
    configure();
    updateProgress();
    reduced.addEventListener("change", configure);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      entrance?.cancel();
      observer?.disconnect();
      cancelAnimationFrame(frame);
      targets.forEach((target) =>
        target.classList.remove("ld-await-reveal", "ld-visible"),
      );
      reduced.removeEventListener("change", configure);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, [pathname]);
  // The browser may process a fragment while session restore still shows the
  // loader. Resolve it again once this page's actual content is mounted.
  useLayoutEffect(() => {
    if (!hash) return;
    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (target && root.current?.contains(target))
      target.scrollIntoView({ block: "start", behavior: "instant" });
  }, [pathname, hash]);
  return root;
}

export function useQuickTransition(state: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !ref.current?.animate
    )
      return;
    const animation = ref.current.animate(
      [
        { opacity: 0.6, transform: "translateX(6px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 180, easing: "ease-out" },
    );
    return () => animation.cancel();
  }, [state]);
  return ref;
}
