import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import CallRoom from "./CallRoom";
import type { PaddockCall } from "./engine/call";
import { callStore, useActiveCall } from "./engine/store";
import GreenRoom from "./GreenRoom";
import LeftScreen from "./LeftScreen";
import { useCallView } from "./useCall";

/** /paddock/:code — the green room until you join, then the call, then "you left". */
export default function PaddockMeeting({ code }: { code: string }) {
  const active = useActiveCall();
  const call = active && active.code === code ? (active as PaddockCall) : null;
  // A fresh green room after a call (Rejoin) gets fresh state.
  return call ? <InCall key="call" call={call} /> : <GreenRoom key="green" code={code} />;
}

function InCall({ call }: { call: PaddockCall }) {
  const view = useCallView(call);
  const { user } = useAuth();
  const navigate = useNavigate();
  if (view.phase !== "in")
    return (
      <LeftScreen
        view={view}
        guest={!user}
        onRejoin={() => callStore.set(null)}
        onDone={() => {
          callStore.set(null);
          navigate(user ? "/paddock" : "/", { replace: true });
        }}
      />
    );
  return <CallRoom call={call} view={view} canMinimize={!!user} />;
}
