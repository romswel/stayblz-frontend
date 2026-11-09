import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusPage from "../components/status/StatusPage";

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

  if (state === "done")
    return (
      <StatusPage
        standalone
        kind="done"
        title="Sign-up removed"
        message="Thanks for telling us. The account made with your email has been removed and can't be used. You don't need to do anything else."
        actions={
          <Link className="btn btn-primary status-primary" to="/">
            Go to Stayblz
          </Link>
        }
      />
    );

  return (
    <StatusPage
      standalone
      kind={state === "error" ? "error" : "notice"}
      title={state === "error" ? "We couldn't finish this" : "Didn't sign up for Stayblz?"}
      message={
        state === "error"
          ? error
          : "Someone started a Stayblz account with your email address. If it wasn't you, remove it here. The account was never confirmed, so nobody could use it."
      }
      actions={
        state === "error" ? (
          <>
            <Link className="btn btn-primary status-primary" to="/login">
              Go to log in
            </Link>
            <Link className="btn btn-quiet" to="/faq">
              Help & FAQ
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary status-primary"
              onClick={() => void remove()}
              disabled={state === "busy"}
            >
              {state === "busy" ? "Removing…" : "Yes, remove this sign-up"}
            </button>
            <Link className="btn btn-quiet" to="/login">
              It was me, keep it
            </Link>
          </>
        )
      }
    />
  );
}
