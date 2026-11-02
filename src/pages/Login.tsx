import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Brand from "../components/Brand";
import usePublicMotion from "../components/usePublicMotion";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import LandingAuth from "../components/landing/LandingAuth";
import RacingPreview from "../components/landing/RacingPreview";
import "./landing.css";
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
]);

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
  const [destination, setDestination] = useState(
    typeof routeState?.destination === "string" &&
      destinations.has(routeState.destination)
      ? routeState.destination
      : "/dashboard",
  );
  const [intent, setIntent] = useState(
    typeof routeState?.intent === "string"
      ? routeState.intent.slice(0, 150)
      : "",
  );
  const authRef = useRef<HTMLElement>(null);
  const pageRef = usePublicMotion();
  useEffect(() => {
    setMode(location.pathname === "/signup" ? "signup" : "login");
    const state = location.state as {
      destination?: unknown;
      intent?: unknown;
      focusAccount?: boolean;
    } | null;
    if (
      typeof state?.destination === "string" &&
      destinations.has(state.destination)
    )
      setDestination(state.destination);
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

  const date = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());

  return (
    <div className="landing" id="top" ref={pageRef}>
      <a className="ld-skip" href="#racing-overview">
        Skip to racing overview
      </a>
      <PublicHeader onAuth={(next) => showAuth(next)} />
      <main className="ld-main" id="racing-overview">
        <div className="ld-edition">
          <span>
            <i aria-hidden="true" /> RACING OVERVIEW
          </span>
          <span>
            {date}
            <span className="ld-edition-note">
              <b> / </b> STAYBLZ
            </span>
          </span>
        </div>
        <section className="ld-intro" aria-label="Welcome to Stayblz">
          <div className="ld-hero">
            <img
              src="/images/racing-editorial.jpg"
              alt="A thoroughbred and jockey on the track in warm afternoon light"
              fetchPriority="high"
            />
            <div className="ld-hero-shade" />
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
              <a className="ld-hero-link" href="#race-desk">
                View racing <span aria-hidden="true">↓</span>
              </a>
            </div>
            <span className="ld-photo-credit">Illustrative racing image</span>
          </div>
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
        </section>
        <div className="ld-overview-strip">
          <span>
            <strong>RACING DATA</strong>
            <small>Published by Stayblz</small>
          </span>
          <a href="#race-desk">
            Racecards <span>01</span>
          </a>
          <a href="#leaderboard">
            Leaderboard <span>02</span>
          </a>
          <a href="#field-notes">
            News <span>04</span>
          </a>
          <a href="#stakes-diary">
            Stakes <span>03</span>
          </a>
        </div>
        <RacingPreview
          onOpen={(path, label) => showAuth("login", path, label)}
          onSignup={() => showAuth("signup")}
        />
        <section className="ld-closing ld-reveal">
          <Brand />
          <div>
            <span className="ld-kicker">YOUR ACCOUNT</span>
            <h2>Your horses. Your stable.</h2>
          </div>
          <button
            className="ld-button ld-button-gold"
            onClick={() => showAuth(user ? "login" : "signup")}
          >
            {user ? "Continue to dashboard" : "Create an account"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
