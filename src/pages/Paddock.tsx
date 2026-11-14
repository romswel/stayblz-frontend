import { useParams } from "react-router-dom";
import StatusPage from "../components/status/StatusPage";
import PaddockHome from "../components/paddock/PaddockHome";
import PaddockMeeting from "../components/paddock/PaddockMeeting";
import "../components/messenger/messenger.css";
import "../components/messenger/panels.css";
import "../components/paddock/paddock.css";
import "../components/paddock/room.css";

/** Stayblz Paddock: /paddock (home) and /paddock/:code (green room → call). Its own download. */
export default function Paddock() {
  const { code } = useParams();
  if (!code) return <PaddockHome />;
  if (!/^[a-z]{4}-[a-z]{4}$/.test(code)) return <StatusPage kind="not-found" />;
  return <PaddockMeeting code={code} />;
}

/** Signed out: a meeting link works for guests (no menu around it). */
export function GuestPaddock() {
  const { code = "" } = useParams();
  if (!/^[a-z]{4}-[a-z]{4}$/.test(code)) return <StatusPage kind="not-found" standalone />;
  return (
    <div className="pd-guest-page">
      <PaddockMeeting code={code} />
    </div>
  );
}
