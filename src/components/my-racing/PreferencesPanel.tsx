import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
type Preferences = {
  entry_alerts: boolean;
  workout_alerts: boolean;
  result_alerts: boolean;
  email_enabled: boolean;
};
const options: [keyof Preferences, string, string][] = [
  [
    "entry_alerts",
    "Race entries",
    "When a horse, family or person you follow is entered or scratched.",
  ],
  [
    "workout_alerts",
    "Morning workouts",
    "New published workouts for horses and families you follow.",
  ],
  ["result_alerts", "Race results", "When a race they ran in is made official."],
  [
    "email_enabled",
    "Email delivery",
    "Not sent yet. We'll save your choice for when email alerts start.",
  ],
];
export default function PreferencesPanel() {
  const [values, setValues] = useState<Preferences | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api
      .get<{ preferences: Preferences }>("/api/my-racing/preferences", {
        signal: c.signal,
      })
      .then((d) => {
        if (!c.signal.aborted) {
          if (
            !d.preferences ||
            !options.every(([key]) => typeof d.preferences[key] === "boolean")
          )
            throw Error("Alert settings could not be loaded.");
          setValues(d.preferences);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [version]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!values || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.patch("/api/my-racing/preferences", values);
      setNotice("Preferences saved.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Preferences could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="mr-intro">
        <span className="ov-kicker">NOTIFICATION SETTINGS</span>
        <h2>Alert settings</h2>
        <p>Choose the racing updates you would like to receive.</p>
      </div>
      <div className="ov-paper mr-preferences">
        <div className="mr-service-status">
          <span>HOW ALERTS ARRIVE</span>
          <p>
            Racing alerts go to the bell, and to this device when{" "}
            <Link to="/account/notifications">notifications</Link> are on.
            Email alerts aren't sent yet.
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}{" "}
            <button
              className="ws-button"
              onClick={() => {
                setError("");
                setVersion((v) => v + 1);
              }}
            >
              Retry preferences
            </button>
          </p>
        )}
        {notice && (
          <p className="ws-notice" role="status">
            {notice}
          </p>
        )}
        {values ? (
          <form onSubmit={save}>
            {options.map(([key, label, description]) => (
              <label className="mr-preference" key={key}>
                <input
                  type="checkbox"
                  checked={values[key]}
                  onChange={(e) =>
                    setValues((v) =>
                      v ? { ...v, [key]: e.target.checked } : v,
                    )
                  }
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
            <button className="ws-button" disabled={busy}>
              {busy ? "Saving…" : "Save preferences"}
            </button>
          </form>
        ) : (
          !error && <p className="ov-empty">Loading your preferences…</p>
        )}
      </div>
    </section>
  );
}
