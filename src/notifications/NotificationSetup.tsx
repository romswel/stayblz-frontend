import { useState, type ReactNode } from "react";
import Modal from "../components/Modal";
import DialogHead from "../components/ui/DialogHead";
import InstallGuide, { ShareGlyph } from "../install/InstallGuide";
import { useInstall, type InstallPlatform } from "../install/installState";
import { useNotifications } from "./NotificationsContext";
import "./notifications.css";

const Key = ({ children }: { children: ReactNode }) => <span className="ig-key">{children}</span>;

/** Where to switch notifications back on after saying "Block". */
function unblockSteps(platform: InstallPlatform, installed: boolean): ReactNode {
  if (platform.startsWith("ios"))
    return (
      <>
        Open your iPhone's <Key>Settings</Key> → <Key>Notifications</Key> → <Key>Stayblz</Key> and turn on <Key>Allow Notifications</Key>.
      </>
    );
  if (platform === "android")
    return installed ? (
      <>
        Press and hold the Stayblz icon → <Key>App info</Key> → <Key>Notifications</Key> → turn them on.
      </>
    ) : (
      <>
        Tap the icon left of the address → <Key>Permissions</Key> → <Key>Notifications</Key> → <Key>Allow</Key>, then reload.
      </>
    );
  if (platform === "mac-safari")
    return (
      <>
        <Key>Safari</Key> → <Key>Settings</Key> → <Key>Websites</Key> → <Key>Notifications</Key> → set stayblz-app.com to <Key>Allow</Key>.
      </>
    );
  if (platform === "firefox-desktop")
    return (
      <>
        Click the lock left of the address, remove the <Key>Notifications blocked</Key> entry, then reload and turn them on again.
      </>
    );
  return (
    <>
      Click the icon left of the address (a lock or sliders) → <Key>Notifications</Key> → <Key>Allow</Key>, then reload the page.
    </>
  );
}

const SYSTEM_TIPS: [string, ReactNode][] = [
  [
    "Computer",
    <>
      Notifications arrive while your browser is running, even with no Stayblz tab open. In Chrome or Edge, keep{" "}
      <strong>Continue running background apps when closed</strong> on (Settings → System).
    </>,
  ],
  ["Windows", <>Settings → System → Notifications: turn on your browser (or Stayblz), and turn off Do not disturb.</>],
  ["Mac", <>System Settings → Notifications → your browser (or Stayblz) → Allow notifications. Turn off Focus.</>],
  ["Android", <>Settings → Apps → Chrome (or Stayblz) → Notifications on. Under Battery, choose Unrestricted.</>],
  ["iPhone", <>Settings → Notifications → Stayblz → Allow. Turn off Focus, and open Stayblz from the Home Screen icon.</>],
];

/**
 * "Set up notifications": a short guide that gets this device ready. iPhone/iPad first need the Home Screen app;
 * everywhere else: Turn on → the browser asks → a test. Blocked? Where to unblock. Still quiet? System switches.
 */
export default function NotificationSetup({ onClose, auto = false }: { onClose: (later?: boolean) => void; auto?: boolean }) {
  const n = useNotifications();
  const { platform, installed } = useInstall();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const needsInstall = n.pushState === "needs-install";
  const blocked = n.permission === "denied";
  const ready = !!n.settings?.enabled && (n.deviceReady || n.pushState === "unsupported");
  const stage = needsInstall ? "install" : blocked ? "blocked" : ready ? "done" : "ask";

  async function turnOn() {
    setBusy(true);
    setMessage("");
    try {
      await n.enable();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    try {
      setMessage(await n.test());
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The test couldn't be sent.");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    install: "Get notifications on your iPhone",
    blocked: "Notifications are blocked",
    done: "You're all set",
    ask: "Turn on notifications",
  }[stage];

  const checklist = [
    { label: "Stayblz app on this device", ok: installed, show: platform.startsWith("ios") || installed },
    { label: "Notifications allowed", ok: n.permission === "granted" },
    {
      label: n.pushState === "unavailable" ? "Alerts while Stayblz is open" : "Alerts even when Stayblz is closed",
      ok: n.pushState === "on" || (n.pushState === "unavailable" && n.permission === "granted"),
    },
  ].filter((item) => item.show !== false);

  if (installOpen) return <InstallGuide onClose={() => setInstallOpen(false)} />;
  return (
    <Modal label="Set up notifications" onClose={() => onClose(auto && stage !== "done")} className="modal-sm ns-dialog gx-layer">
      <DialogHead kicker="Notifications" title={title} onClose={() => onClose(auto && stage !== "done")} />
      <div className="dlg">
        <ul className="ns-check" aria-label="This device">
          {checklist.map((item) => (
            <li key={item.label} className={item.ok ? "is-ok" : undefined}>
              <span aria-hidden="true">{item.ok ? "✓" : ""}</span>
              {item.label}
              <span className="ns-sr">{item.ok ? " — done" : " — not yet"}</span>
            </li>
          ))}
        </ul>

        {stage === "install" && (
          <>
            <p className="dlg-text">On iPhone and iPad, Stayblz can only send notifications from the Stayblz app on your Home Screen. It takes ten seconds:</p>
            <ol className="ig-steps">
              <li>
                <span className="ig-num" aria-hidden="true">1</span>
                <span>
                  Tap Share <Key><ShareGlyph /></Key> {platform === "ios-safari" ? "at the bottom of Safari" : "next to the address bar"}.
                </span>
              </li>
              <li>
                <span className="ig-num" aria-hidden="true">2</span>
                <span>
                  Tap <Key>Add to Home Screen</Key>, then <Key>Add</Key>.
                </span>
              </li>
              <li>
                <span className="ig-num" aria-hidden="true">3</span>
                <span>Open Stayblz from your Home Screen, log in, and tap <Key>Turn on</Key> when it asks.</span>
              </li>
            </ol>
          </>
        )}

        {stage === "ask" && (
          <>
            <p className="dlg-text">Know the moment something happens in Stayblz Chat and Paddock — even when Stayblz is closed:</p>
            <ul className="ns-list">
              <li>💬 New messages and message requests</li>
              <li>@ Mentions and replies to you</li>
              <li>🎉 Reactions to your messages</li>
              <li>👥 Friend requests and new groups</li>
              <li>📞 Calls and meetings</li>
            </ul>
            <p className="ns-small">
              Your browser will ask next — choose <strong>Allow</strong>. You can mute any chat, or change what you get, in Notification settings.
            </p>
          </>
        )}

        {stage === "blocked" && (
          <>
            <p className="dlg-text">This browser was told to block Stayblz. To get notifications here:</p>
            <p className="ns-steps">{unblockSteps(platform, installed)}</p>
          </>
        )}

        {stage === "done" && (
          <>
            <p className="dlg-text">
              {n.pushState === "on"
                ? "This device will get Stayblz notifications, even when Stayblz is closed. Send yourself a test to see one."
                : n.pushState === "unavailable"
                  ? "You'll get notifications while Stayblz is open in a tab or window."
                  : "This browser can't show system notifications, so alerts show inside Stayblz while it's open."}
            </p>
            {!installed && !platform.startsWith("ios") && platform !== "firefox-desktop" && (
              <p className="ns-small">
                Tip: <button type="button" className="ns-link" onClick={() => setInstallOpen(true)}>install the Stayblz app</button> so it opens in one tap from
                your {platform === "android" ? "home screen" : "taskbar or dock"}.
              </p>
            )}
            <details className="ns-tips">
              <summary>Still not seeing them?</summary>
              <ul>
                {SYSTEM_TIPS.map(([name, tip]) => (
                  <li key={name}>
                    <strong>{name}:</strong> {tip}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}

        {message && (
          <p className="ns-message" role="status">
            {message}
          </p>
        )}

        <div className="dlg-actions">
          {stage === "ask" && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => onClose(auto)} disabled={busy}>
                Not now
              </button>
              <button type="button" className="btn btn-primary" onClick={turnOn} disabled={busy}>
                {busy ? "Turning on…" : "Turn on"}
              </button>
            </>
          )}
          {stage === "install" && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => onClose(auto)}>
                Later
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void n.save({ enabled: true, prompted: true }).catch(() => undefined);
                  onClose(false);
                }}
              >
                Got it
              </button>
            </>
          )}
          {stage === "blocked" && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => onClose(auto)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                I've allowed it — reload
              </button>
            </>
          )}
          {stage === "done" && (
            <>
              <button type="button" className="btn btn-quiet" onClick={test} disabled={busy}>
                {busy ? "Sending…" : "Send a test"}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onClose(false)}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
