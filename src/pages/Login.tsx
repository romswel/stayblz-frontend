import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import LandingAuth from "../components/landing/LandingAuth";
import LandingSections from "../components/landing/LandingSections";
import { allowedDestination } from "../authDestination";
import "./landing.css";
import "./landing-glass.css";

/** The signed-out home page, with the log in / sign up card. Signed-in visitors never see it (App.tsx). */
export default function Login() {
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
  const heroRef = useRef<HTMLElement>(null);
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
    <div
      className={`landing gx-layer gx-public ld-home${open ? " is-auth-open" : ""}`}
      id="top"
      ref={pageRef}
    >
      <a className="ld-skip" href="#home-main">
        Skip to main content
      </a>
      <PublicHeader onAuth={(next) => showAuth(next)} />
      <main className="ld-main lg-main" id="home-main">
        <section
          className={`lg-hero${open ? " is-open" : ""}`}
          aria-label="Welcome to Stayblz"
          ref={heroRef}
          tabIndex={-1}
        >
          <div className="lg-copy gx-glass">
            <span className="lg-eyebrow">
              <span className="lg-pulse" aria-hidden="true" />
              Horse racing, organised
            </span>
            <h1>
              Know the horse.
              <br />
              <span className="lg-grad">Read the race.</span>
            </h1>
            <p className="lg-lede">
              Racecards, results, workouts and standings, with chat, video meetings and an optional
              stable workspace for your team.
            </p>
            <div className="lg-cta">
              <button type="button" className="ld-button ld-button-gold" onClick={() => showAuth("signup")}>
                Create a free account
              </button>
              <button type="button" className="ld-button ld-button-quiet" onClick={() => showAuth("login")}>
                Log in
              </button>
            </div>
            <ul className="lg-chips" aria-label="Part of every account">
              <li>Racecards &amp; results</li>
              <li>Stayblz Chat</li>
              <li>Stayblz Paddock</li>
            </ul>
          </div>
          <div className="lg-stage">
            <figure className="lg-photo">
              <img
                src="/images/racing-editorial.jpg"
                alt="A thoroughbred and jockey on the track in warm afternoon light"
                fetchPriority="high"
              />
              <figcaption>Illustrative racing image</figcaption>
            </figure>
            <div className="lg-photo-veil" aria-hidden="true" />
            <div className="lg-ticket gx-glass" aria-hidden="true">
              <span className="lg-ticket-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h16v14H4z" />
                  <path d="M4 10h16M9 5v14" />
                </svg>
              </span>
              <span>
                <strong>Race days</strong>
                <small>Runners, riders, results</small>
              </span>
            </div>
            <div className="ld-auth-shell lg-auth-shell">
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>
        </section>
        <LandingSections onJoin={() => showAuth("signup")} />
      </main>
      <PublicFooter />
    </div>
  );
}
