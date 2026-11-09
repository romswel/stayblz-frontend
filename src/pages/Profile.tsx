import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { countries } from "../components/landing/countries";
import type { User } from "../types";
import CommunityRoleFields from "../components/account/CommunityRoleFields";
import AccountHeader from "./account/AccountNav";
import "../components/account/account.css";

export default function Profile() {
  const { user, acceptUser } = useAuth();
  const p = user?.profile;
  const [firstName, setFirstName] = useState(p?.firstName ?? "");
  const [lastName, setLastName] = useState(p?.lastName ?? "");
  const [country, setCountry] = useState(p?.country ?? "");
  const [city, setCity] = useState(p?.city ?? "");
  const [racingRole, setRacingRole] = useState(p?.racingRole ?? "");
  const [communityRoles, setCommunityRoles] = useState<string[]>(p?.communityRoles ?? []);
  const [organisation, setOrganisation] = useState(p?.organisation ?? "");
  const [bio, setBio] = useState(p?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // The superadmin identity is fixed on the server; the form is shown read-only.
  const locked = user?.platformRole === "superadmin";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || locked) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await api.patch<{ user: User }>("/api/auth/profile", {
        firstName,
        lastName,
        country,
        city,
        racingRole,
        communityRoles,
        organisation,
        bio,
      });
      acceptUser(result.user);
      setNotice("Profile saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AccountHeader title="Profile" intro="How you appear to other members, and your place in racing." />
      <section className="panel account-profile">
        <form onSubmit={save}>
          {locked && (
            <p role="note">
              The superadmin profile is locked and can't be edited here. Your password and 2-step login can still be
              changed on the Security page.
            </p>
          )}
          <h2>About you</h2>
          <div className="profile-fields">
            <label>
              First name
              <input autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required disabled={locked} />
            </label>
            <label>
              Last name
              <input autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required disabled={locked} />
            </label>
            <label>
              Country
              <select autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)} required disabled={locked}>
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Town or city (optional)
              <input autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} disabled={locked} />
            </label>
          </div>
          <h2>Your place in racing</h2>
          <p>Your roles help other members know who you are. They never change what you can access.</p>
          <CommunityRoleFields
            variant="app"
            primary={racingRole}
            extras={communityRoles}
            onPrimary={setRacingRole}
            onExtras={setCommunityRoles}
            disabled={locked}
          />
          <div className="profile-fields">
            <label>
              Stable, farm or organisation (optional)
              <input autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} maxLength={100} disabled={locked} />
            </label>
          </div>
          <label className="roles-field">
            Short bio (optional)
            <textarea
              className="acct-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="For example: Part-owner of two sprinters, at the track most Sundays."
              disabled={locked}
            />
          </label>
          <p className="acct-count" aria-live="polite">
            {bio.length} / 280
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {!locked && (
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          )}
        </form>
      </section>
      <section className="panel account-profile">
        <h2>Racing records</h2>
        <p>View racing records, save notes, follow horses, and send private messages. You can also create a stable or join a team.</p>
        <Link className="btn btn-primary" to="/entries">
          View racecards
        </Link>
        <Link className="btn" to="/updates">
          See what's new in Updates
        </Link>
      </section>
    </>
  );
}
