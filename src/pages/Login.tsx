import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import LandingAuth from "../components/landing/LandingAuth";
import { isPPDestination } from "../components/pps/catalog";
import "./landing.css";
import "./landing-theme.css";
const destinations = new Set([
  "/dashboard",
  "/account",
  "/entries",
  "/results",
  "/workouts",
  "/speed-figures",
  "/statistics",
  "/stakes",
  "/virtual-stable",
  "/tracker",
  "/stables",
  "/messages",
  "/inventory",
  "/my-racing",
  "/workspace",
  "/team-messages",
  "/paddock",
]);
/** Pages we may send people back to after they sign in. */
const allowedDestination = (value: unknown): value is string =>
  typeof value === "string" &&
  (destinations.has(value) ||
    /^\/updates(\/[a-z0-9-]{1,80})?$/.test(value) ||
    /^\/racing\/(days|races|horses|people)\/[0-9a-f-]{36}$/.test(value) ||
    /^\/paddock\/[a-z]{4}-[a-z]{4}$/.test(value) ||
    isPPDestination(value));

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as {
    destination?: unknown;
    intent?: unknown;
    focusAccount?: boolean;
  } | null;
  const [mode, setMode] = useState<"login" | "signup">(
    location.pathname === "/signup" ? "signup" : "login",
  );
  const wanted = routeState?.destination;
  const [destination, setDestination] = useState(allowedDestination(wanted) ? wanted : "/dashboard");
  const [intent, setIntent] = useState(
    typeof routeState?.intent === "string"
      ? routeState.intent.slice(0, 150)
      : "",
  );
  const authRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  // The account card only shows on /login and /signup; the plain index shows the hero alone.
  const open = location.pathname !== "/";
  function closeAuth() {
    navigate("/");
    heroRef.current?.focus({ preventScroll: true });
  }
  // Escape closes the card wherever focus is (just after opening it, focus is still on the header
  // button), but not while a dialog opened from it (e.g. Terms) is on top.
  const closeRef = useRef(closeAuth);
  closeRef.current = closeAuth;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector(".modal, [role='dialog'][aria-modal='true']")) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  // The hero fills the screen below the header (and the development notice), so the footer
  // only comes into view on scroll. Measured, because the notice and a wrapped header vary.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const measure = () =>
      hero.style.setProperty(
        "--ld-above-hero",
        `${Math.max(0, hero.getBoundingClientRect().top + window.scrollY)}px`,
      );
    measure();
    window.addEventListener("resize", measure);
    const header = document.querySelector(".ld-header");
    const observer =
      typeof ResizeObserver === "undefined" || !header
        ? null
        : new ResizeObserver(measure);
    if (header) observer?.observe(header);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);
  const pageRef = usePublicMotion();
  useEffect(() => {
    setMode(location.pathname === "/signup" ? "signup" : "login");
    const state = location.state as {
      destination?: unknown;
      intent?: unknown;
      focusAccount?: boolean;
    } | null;
    const next = state?.destination;
    if (allowedDestination(next)) setDestination(next);
    if (typeof state?.intent === "string")
      setIntent(state.intent.slice(0, 150));
    const frame = requestAnimationFrame(() => {
      if (state?.focusAccount) {
        authRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "center",
        });
        authRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key]);

  function showAuth(
    nextMode: "login" | "signup",
    path = "/dashboard",
    label = "",
  ) {
    if (user) {
      navigate(path);
      return;
    }
    setMode(nextMode);
    setDestination(path);
    setIntent(label);
    const nextPath = nextMode === "signup" ? "/signup" : "/login";
    navigate(nextPath, {
      replace: location.pathname === nextPath,
      state: { destination: path, intent: label, focusAccount: true },
    });
    authRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    authRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="landing ld-home" id="top" ref={pageRef}>
      <a className="ld-skip" href="#racing-overview">
        Skip to racing overview
      </a>
      <PublicHeader onAuth={(next) => showAuth(next)} themeButton />
      <main className="ld-main" id="racing-overview">
        <section
          className={`ld-intro${open ? " ld-intro-open" : ""}`}
          aria-label="Welcome to Stayblz"
        >
          <div className="ld-hero" ref={heroRef} tabIndex={-1}>
            <img
              src="/images/racing-editorial.jpg"
              alt="A thoroughbred and jockey on the track in warm afternoon light"
              fetchPriority="high"
            />
            <div className="ld-hero-blur" aria-hidden="true" />
            <div className="ld-hero-shade" />
            <div className="ld-hero-shade-open" aria-hidden="true" />
            <div className="ld-hero-top">
              <span className="ld-photo-label">STAYBLZ RACING</span>
              <span className="ld-hero-index">RACES / RESULTS / FORM</span>
            </div>
            <div className="ld-hero-copy">
              <span className="ld-kicker">HORSE RACING</span>
              <h1>
                Know the horse.
                <br />
                <em>Read the race.</em>
              </h1>
              <p>Racecards, results, workouts, and standings.</p>
            </div>
            <span className="ld-photo-credit">Illustrative racing image</span>
            <div className="ld-auth-shell">
              <LandingAuth
                ref={authRef}
                mode={mode}
                onModeChange={(next) => {
                  setMode(next);
                  navigate(next === "signup" ? "/signup" : "/login", {
                    replace: true,
                    state: { destination, intent },
                  });
                }}
                destination={destination}
                intent={intent}
              />
              <button
                type="button"
                className="ld-auth-close"
                aria-label="Close account panel"
                onClick={closeAuth}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
