import { Link } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import "./landing.css";
export default function InvitationEntry({
  kind,
}: {
  kind: "stable" | "conversation";
}) {
  return (
    <div className="landing">
      <PublicHeader />
      <main className="invitation-entry">
        <span className="ov-kicker">YOUR STAYBLZ ACCOUNT</span>
        <h1>
          {kind === "stable"
            ? "Join your stable"
            : "Join a private conversation"}
        </h1>
        <p>
          Sign in with the email addressed by your invitation. Keep this
          invitation tab open, then return here after signing in.
        </p>
        <Link className="ws-button" to="/login" target="_blank" rel="noopener">
          Sign in in a new tab ↗
        </Link>
        <button className="ws-button" onClick={() => window.location.reload()}>
          I’m signed in — continue
        </button>
      </main>
      <PublicFooter />
    </div>
  );
}
