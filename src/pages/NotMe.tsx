import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AuthLayout from "../components/auth/AuthLayout";

// Read the one-time token once, then remove it from the address bar and history.
const initialToken =
  typeof window !== "undefined" && window.location.pathname === "/auth/not-me"
    ? new URLSearchParams(window.location.search).get("token_hash")
    : null;
if (initialToken) window.history.replaceState({}, "", "/auth/not-me");

/**
 * "This wasn't me" from a sign-up email. Nothing happens until the person confirms,
 * so email scanners that open links can't remove anything.
 */
export default function NotMe() {
  const [token] = useState(initialToken);
  const [state, setState] = useState<"ask" | "busy" | "done" | "error">(token ? "ask" : "error");
  const [error, setError] = useState(
    token ? "" : "This link is incomplete. Open the latest Stayblz email and use its “This wasn't me” link.",
  );

  async function remove() {
    setState("busy");
    setError("");
    try {
      await api.post("/api/auth/not-me", { tokenHash: token });
      setState("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This could not be completed.");
      setState("error");
    }
  }

  const title =
    state === "done" ? "Sign-up removed" : state === "error" ? "We couldn't finish this" : "Didn't sign up for Stayblz?";
  const message =
    state === "done"
      ? "Thanks for telling us. The account made with your email has been removed and can't be used. You don't need to do anything else."
      : state === "error"
        ? error
        : "Someone started a Stayblz account with your email address. If it wasn't you, remove it here. The account was never confirmed, so nobody could use it.";
  return (
    <AuthLayout>
      <section className="au-solo gx-glass" aria-labelledby="not-me-title">
        <div className={`au-emblem${state === "error" ? " is-error" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {state === "done" ? (
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            ) : state === "error" ? (
              <>
                <circle cx="12" cy="12" r="9.5" />
                <path d="M12 7v6M12 17h.01" />
              </>
            ) : (
              <>
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                <path d="m4.5 7 7.5 6 7.5-6" />
              </>
            )}
          </svg>
        </div>
        <div role="status" aria-live="polite">
          <h1 id="not-me-title">{title}</h1>
          <p className="au-lede">{message}</p>
        </div>
        <div className="au-actions">
          {state === "done" ? (
            <Link className="au-submit" to="/">
              Go to Stayblz
            </Link>
          ) : state === "error" ? (
            <>
              <Link className="au-submit" to="/login">
                Go to log in
              </Link>
              <Link className="au-quiet" to="/faq">
                Help &amp; FAQ
              </Link>
            </>
          ) : (
            <>
              <button type="button" className="au-submit" onClick={() => void remove()} disabled={state === "busy"}>
                {state === "busy" ? "Removing…" : "Yes, remove this sign-up"}
              </button>
              <Link className="au-quiet" to="/login">
                It was me, keep it
              </Link>
            </>
          )}
        </div>
      </section>
    </AuthLayout>
  );
}
