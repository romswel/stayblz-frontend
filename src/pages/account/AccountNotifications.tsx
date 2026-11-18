import { useState } from "react";
import { Link } from "react-router-dom";
import { isInstalledApp } from "../../pwa";
import { InstallButton } from "../../install/InstallGuide";
import { useNotifications } from "../../notifications/NotificationsContext";
import type { SettingsChange } from "../../notifications/notifyApi";
import "../../notifications/notifications.css";
import AccountHeader from "./AccountNav";

const message = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback);

/** Notification settings: the account switch, this device (browser permission + alerts when closed), and what Stayblz Chat sends. */
export default function AccountNotifications() {
  const n = useNotifications();
  const { settings, permission, pushState } = n;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      if (done) setNotice(done);
    } catch (reason) {
      setError(message(reason, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }
  const save = (changes: SettingsChange) => run(() => n.save(changes), "Saved.");

  const permissionText =
    permission === "granted"
      ? "Allowed in this browser."
      : permission === "denied"
        ? "Blocked in this browser. To allow: open the site settings (lock or tune icon by the address) → Notifications → Allow, then come back."
        : permission === "unsupported"
          ? pushState === "needs-install"
            ? "On iPhone and iPad, notifications only work in the Stayblz app from your Home Screen. Use “Set up this device” below."
            : isInstalledApp()
              ? "This device can't show system notifications. Alerts show inside Stayblz while it's open."
              : "This browser can't show system notifications here. Alerts still show inside Stayblz while it's open."
          : "Not asked yet.";
  const pushText =
    pushState === "on"
      ? "On for this device. You'll get alerts even when Stayblz is closed."
      : pushState === "unavailable"
        ? "Not switched on for Stayblz yet. Until then you get alerts while Stayblz is open in a tab."
        : pushState === "needs-install"
          ? "Add Stayblz to your Home Screen, open it from there, and turn this on."
          : pushState === "unsupported"
            ? "This browser or device can't get alerts while Stayblz is closed."
            : "Off for this device.";

  return (
    <>
      <AccountHeader title="Notifications" intro="What Stayblz tells you about, and how: Stayblz Chat and Stayblz Paddock today; more will join here." />
      <div className="acct-sections nt-settings">
        {n.loadError && (
          <p className="form-error" role="alert">
            {n.loadError}{" "}
            <button type="button" className="btn btn-quiet" onClick={n.reload}>
              Try again
            </button>
          </p>
        )}
        {!settings && !n.loadError && <p role="status">Loading your settings…</p>}
        {settings && (
          <>
            <section className="panel account-profile acct-section" aria-labelledby="nt-main">
              <h2 id="nt-main">Notifications</h2>
              <label className="acct-toggle">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  disabled={busy}
                  onChange={(e) =>
                    void (e.target.checked
                      ? run(async () => {
                          const answer = await n.enable();
                          if (answer === "denied") setNotice("On for your account. Your browser blocked system notifications, so alerts only show while Stayblz is in front.");
                          else setNotice("Notifications are on.");
                        })
                      : save({ enabled: false }))
                  }
                />
                <span>
                  Notify me
                  <small>Your account's main switch. Off: no alerts anywhere, only the unread counts in the menu.</small>
                </span>
              </label>
            </section>

            <section className="panel account-profile acct-section" aria-labelledby="nt-device">
              <h2 id="nt-device">This device</h2>
              <div className="nt-device-row">
                <span className={`nt-state is-${permission}`} aria-hidden="true" />
                <p>
                  <strong>Browser notifications:</strong> {permissionText}
                </p>
                {permission === "default" && (
                  <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void run(n.enable, "Done.")}>
                    Allow
                  </button>
                )}
              </div>
              <label className="acct-toggle">
                <input
                  type="checkbox"
                  checked={pushState === "on"}
                  disabled={busy || pushState === "unsupported" || pushState === "unavailable" || !settings.enabled}
                  onChange={(e) => void run(() => n.setPush(e.target.checked), e.target.checked ? "Alerts when closed are on for this device." : "Off for this device.")}
                />
                <span>
                  Alerts when Stayblz is closed
                  <small>{pushText}</small>
                </span>
              </label>
              <div className="nt-actions">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={n.openSetup}>
                  {n.deviceReady ? "Check this device" : "Set up this device"}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={busy || !settings.enabled}
                  onClick={() => void run(async () => setNotice(await n.test()))}
                >
                  Send a test notification
                </button>
                {settings.devices > 0 && (
                  <small>
                    {settings.devices} {settings.devices === 1 ? "device gets" : "devices get"} alerts when Stayblz is closed.
                  </small>
                )}
              </div>
            </section>

            <section className="panel account-profile acct-section" aria-labelledby="nt-chat">
              <h2 id="nt-chat">Stayblz Chat</h2>
              <fieldset className="nt-fieldset" disabled={!settings.enabled || busy}>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.chatMessages} onChange={(e) => void save({ chatMessages: e.target.checked })} />
                  <span>
                    New messages
                    <small>From your chats and groups, and when someone adds you to a group. Muted chats stay quiet.</small>
                  </span>
                </label>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.chatMentions !== false} onChange={(e) => void save({ chatMentions: e.target.checked })} />
                  <span>
                    Mentions and replies
                    <small>When someone writes @your name in a group, or replies to your message. These reach you even in muted chats.</small>
                  </span>
                </label>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.chatReactions !== false} onChange={(e) => void save({ chatReactions: e.target.checked })} />
                  <span>
                    Reactions
                    <small>When someone reacts to one of your messages.</small>
                  </span>
                </label>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.chatRequests} onChange={(e) => void save({ chatRequests: e.target.checked })} />
                  <span>
                    Requests and friends
                    <small>Message requests from people you aren't friends with, friend requests, and when someone accepts yours.</small>
                  </span>
                </label>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.previews} onChange={(e) => void save({ previews: e.target.checked })} />
                  <span>
                    Show message text
                    <small>Off: alerts just say "New message", handy on a shared screen or a locked phone.</small>
                  </span>
                </label>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.sound} onChange={(e) => void save({ sound: e.target.checked })} />
                  <span>
                    Play a sound
                    <small>Your device's notification sound (a soft chime inside Stayblz where the browser can't show notifications).</small>
                  </span>
                </label>
              </fieldset>
              <p className="nt-small">
                To mute one chat, use its ⋯ menu in <Link to="/messages">Stayblz Chat</Link> (for 15 minutes up to "until I turn it back on").
              </p>
            </section>

            <section className="panel account-profile acct-section" aria-labelledby="nt-paddock">
              <h2 id="nt-paddock">Stayblz Paddock</h2>
              <fieldset className="nt-fieldset" disabled={busy}>
                <label className="acct-toggle">
                  <input type="checkbox" checked={settings.paddockCalls} onChange={(e) => void save({ paddockCalls: e.target.checked })} />
                  <span>
                    Calls and meetings
                    <small>
                      Ring me when someone calls me, and tell me when I'm invited to a meeting or one I'm invited to starts. While
                      Stayblz is open, calls ring on screen even with notifications off; in the background they need notifications on.
                    </small>
                  </span>
                </label>
              </fieldset>
            </section>

            {!isInstalledApp() && (
              <section className="panel account-profile acct-section" aria-labelledby="nt-app">
                <h2 id="nt-app">Stayblz app</h2>
                <p className="nt-small">
                  Install Stayblz on this phone or computer: it opens in one tap, in its own window, and on iPhone it's the only
                  way to get notifications.
                </p>
                <div className="nt-actions">
                  <InstallButton label="Install the app" />
                </div>
              </section>
            )}

            <section className="panel account-profile acct-section" aria-labelledby="nt-later">
              <h2 id="nt-later">Coming later</h2>
              <p className="nt-small">
                Alerts for new Updates posts, and for horses and races you follow, aren't sent yet. When they arrive, their
                switches will appear here.
              </p>
            </section>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="nt-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </>
  );
}
