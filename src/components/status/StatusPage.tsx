import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Brand from "../Brand";
import "./status.css";

export type StatusKind =
  | "not-found"
  | "error"
  | "offline"
  | "server"
  | "unavailable"
  | "restricted"
  | "notice"
  | "done";

const copy: Record<StatusKind, { code: string; title: string; message: string }> = {
  "not-found": {
    code: "404",
    title: "This page isn't on the card",
    message: "The link may be old, mistyped, or the page has moved. Try one of the links below.",
  },
  error: {
    code: "Error",
    title: "Something went wrong",
    message: "This page hit a problem on our side. Reloading usually fixes it. Your account and saved work are safe.",
  },
  offline: {
    code: "Offline",
    title: "You're offline",
    message: "Stayblz needs an internet connection. Check your Wi-Fi or mobile data, then try again.",
  },
  server: {
    code: "503",
    title: "Stayblz is taking a breather",
    message:
      "Our server is starting up, busy, or being updated. This usually clears within a minute. Please try again shortly.",
  },
  unavailable: {
    code: "Soon",
    title: "Not available yet",
    message: "This feature isn't switched on yet. It may need a plan or service that isn't connected during the preview.",
  },
  notice: { code: "Note", title: "Please check", message: "" },
  done: { code: "Done", title: "All done", message: "" },
  restricted: {
    code: "403",
    title: "You don't have access to this",
    message: "This page belongs to a different role, stable or plan. If you think you should have access, ask its owner.",
  },
};

interface Props {
  kind: StatusKind;
  title?: string;
  message?: string;
  /** Inside the signed-in layout the page sits in the content area; otherwise it is a full page. */
  standalone?: boolean;
  actions?: ReactNode;
}

/** One friendly page for every "this can't be shown" situation. Never shows technical details. */
export default function StatusPage({ kind, title, message, standalone, actions }: Props) {
  const text = copy[kind];
  const body = (
    <section className={`status-card status-${kind}`} aria-labelledby="status-title">
      <span className="status-code" aria-hidden="true">
        {text.code}
      </span>
      <h1 id="status-title">{title ?? text.title}</h1>
      <p>{message ?? text.message}</p>
      <div className="status-actions">
        {actions ?? (
          <>
            {kind === "not-found" || kind === "restricted" || kind === "unavailable" ? (
              <Link className="btn btn-primary status-primary" to="/">
                Go to the home page
              </Link>
            ) : (
              <button type="button" className="btn btn-primary status-primary" onClick={() => window.location.reload()}>
                Try again
              </button>
            )}
            <Link className="btn btn-quiet" to="/updates">
              Check Updates
            </Link>
            <Link className="btn btn-quiet" to="/faq">
              Help & FAQ
            </Link>
          </>
        )}
      </div>
    </section>
  );
  if (!standalone) return <div className="status-inline">{body}</div>;
  return (
    <div className="status-shell">
      <header className="status-head">
        <Link to="/" className="status-brand" aria-label="Stayblz home">
          <Brand />
          <strong>
            STAYBLZ<span>.</span>
          </strong>
        </Link>
      </header>
      <main className="status-main">{body}</main>
    </div>
  );
}
