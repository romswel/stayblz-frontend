import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import AuthLayout from "../components/auth/AuthLayout";
import CommunityRoleFields from "../components/account/CommunityRoleFields";
import { countries } from "../components/landing/countries";
import InstallGuide, { AppGlyph } from "../install/InstallGuide";
import { useInstall } from "../install/installState";
import { NotificationsProvider, useNotifications } from "../notifications/NotificationsContext";
import NotificationSetup from "../notifications/NotificationSetup";
import type { User } from "../types";
import "../install/install.css";

/** Sign-up asks only for a name; country and racing role come here, after the email is verified. */
export const profileComplete = (user: User) => !!user.profile?.country && !!user.profile?.racingRole;

/**
 * "Finish your profile" (/welcome), opened from the "You're verified" page: 1) racing details, 2) get Stayblz on
 * this device (install the app, turn on notifications). Both can be skipped; the profile page edits it all later.
 */
export default function Welcome() {
  return (
    <NotificationsProvider>
      <WelcomeSteps />
    </NotificationsProvider>
  );
}

function WelcomeSteps() {
  const { user, acceptUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(user && profileComplete(user) ? 2 : 1);
  const profile = user?.profile;
  const [country, setCountry] = useState(profile?.country ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [racingRole, setRacingRole] = useState(profile?.racingRole ?? "");
  const [communityRoles, setCommunityRoles] = useState<string[]>(profile?.communityRoles ?? []);
  const [organisation, setOrganisation] = useState(profile?.organisation ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = profile?.firstName?.trim();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.patch<{ user: User }>("/api/auth/profile", {
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        country,
        city: city.trim(),
        racingRole,
        communityRoles,
        organisation: organisation.trim(),
        bio: profile?.bio ?? "",
      });
      acceptUser(result.user);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your details couldn't be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <section className="au-solo is-wide gx-glass" aria-labelledby="welcome-title">
        <span className="au-step">Step {step} of 2</span>
        {step === 1 ? (
          <>
            <h1 id="welcome-title">Finish your profile{first ? `, ${first}` : ""}</h1>
            <p className="au-lede">Tell people where you are and your part in racing. It shows on your profile and in Stayblz Chat.</p>
            <form className="au-form" onSubmit={save} aria-label="Your racing details">
              {error && (
                <p className="au-msg is-error" role="alert">
                  {error}
                </p>
              )}
              <div className="au-pair">
                <label className="au-field">
                  <span>Country</span>
                  <select name="country" autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
                    <option value="">Select country</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="au-field">
                  <span>
                    Town or city <span className="au-optional">(optional)</span>
                  </span>
                  <input name="city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
                </label>
              </div>
              <CommunityRoleFields variant="app" primary={racingRole} extras={communityRoles} onPrimary={setRacingRole} onExtras={setCommunityRoles} disabled={busy} />
              <label className="au-field">
                <span>
                  Stable, farm or organisation <span className="au-optional">(optional)</span>
                </span>
                <input name="organisation" autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} maxLength={100} />
              </label>
              <button className="au-submit" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save and continue"}
              </button>
              <button type="button" className="au-back" onClick={() => setStep(2)}>
                Skip for now
              </button>
            </form>
          </>
        ) : (
          <DeviceStep onDone={() => navigate("/dashboard", { replace: true })} />
        )}
      </section>
    </AuthLayout>
  );
}

/** Step 2: the app and notifications on this device. Each card says when it's done. */
function DeviceStep({ onDone }: { onDone: () => void }) {
  const { installed, platform } = useInstall();
  const n = useNotifications();
  const [installOpen, setInstallOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const notifyDone = !!n.settings?.enabled && (n.deviceReady || n.pushState === "unsupported");
  const ios = platform.startsWith("ios");
  return (
    <>
      <h1 id="welcome-title">Get Stayblz on this device</h1>
      <p className="au-lede">
        {ios
          ? "On iPhone, add Stayblz to your Home Screen first — that's where notifications work."
          : "Open Stayblz in one tap and hear about messages, mentions and calls straight away."}
      </p>
      <div className="wl-cards">
        <button type="button" className={`wl-card${installed ? " is-done" : ""}`} onClick={() => setInstallOpen(true)}>
          <span className="wl-card-icon" aria-hidden="true">
            {installed ? "✓" : <AppGlyph size={22} />}
          </span>
          <span>
            <strong>{installed ? "The app is installed" : "Install the Stayblz app"}</strong>
            <small>{installed ? "Stayblz opens like any other app here." : ios ? "Share → Add to Home Screen. We'll show you." : "One click, no app store."}</small>
          </span>
        </button>
        <button type="button" className={`wl-card${notifyDone ? " is-done" : ""}`} onClick={() => setNotifyOpen(true)}>
          <span className="wl-card-icon" aria-hidden="true">
            {notifyDone ? "✓" : "🔔"}
          </span>
          <span>
            <strong>{notifyDone ? "Notifications are on" : "Turn on notifications"}</strong>
            <small>{notifyDone ? "Send a test any time from Notification settings." : "Messages, mentions, reactions, requests and calls."}</small>
          </span>
        </button>
      </div>
      <div className="au-actions">
        <button type="button" className="au-submit" onClick={onDone}>
          Go to Stayblz
        </button>
        <Link className="au-back" to="/account">
          Edit your full profile
        </Link>
      </div>
      {installOpen && <InstallGuide onClose={() => setInstallOpen(false)} />}
      {notifyOpen && <NotificationSetup onClose={() => setNotifyOpen(false)} />}
    </>
  );
}
