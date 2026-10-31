import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { countries } from "../components/landing/countries";
import type { User } from "../types";

export default function Profile() {
  const { user, acceptUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? "");
  const [country, setCountry] = useState(user?.profile?.country ?? "");
  const [racingRole, setRacingRole] = useState(user?.profile?.racingRole ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await api.patch<{ user: User }>("/api/auth/profile", {
        firstName,
        lastName,
        country,
        racingRole,
      });
      acceptUser(result.user);
      setNotice("Profile saved.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Profile could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Your account</div>
        <h1>Profile</h1>
        <p className="sub">
          {user?.email} {user?.emailVerified ? "· Email verified" : ""}
        </p>
      </header>
      <section className="panel account-profile">
        <form onSubmit={save}>
          <div className="profile-fields">
            <label>
              First name
              <input
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={60}
                required
              />
            </label>
            <label>
              Last name
              <input
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={60}
                required
              />
            </label>
            <label>
              Country
              <select
                autoComplete="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Racing role
              <select
                value={racingRole}
                onChange={(e) => setRacingRole(e.target.value)}
                required
              >
                <option value="">Select role</option>
                <option value="owner">Owner</option>
                <option value="trainer">Trainer</option>
                <option value="jockey">Jockey</option>
                <option value="staff">Stable staff</option>
                <option value="fan">Racing fan</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>
      <section className="panel account-profile">
        <h2>Racing records</h2>
        <p>
          Your account can view published racing records. Stable operations
          require admin access.
        </p>
        <Link className="btn btn-primary" to="/entries">
          View racecards
        </Link>
        <Link className="btn" to="/">
          Back to overview
        </Link>
      </section>
    </>
  );
}
