import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import AvatarFace from "../components/account/AvatarFace";
import { removeAvatar, uploadAvatar, useAvatar } from "../components/account/avatars";
import { useConfirm } from "../components/ui/Confirm";
import { countries } from "../components/landing/countries";
import type { User } from "../types";
import CommunityRoleFields from "../components/account/CommunityRoleFields";
import AccountHeader from "./account/AccountNav";
import "../components/account/account.css";
import "../components/account/profile-glass.css";

const I = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
const UserIcon = () => (<svg {...I}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
const FlagIcon = () => (<svg {...I}><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg>);
const PenIcon = () => (<svg {...I}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>);
const PinIcon = () => (<svg {...I} width={14} height={14}><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>);
const BuildingIcon = () => (<svg {...I} width={14} height={14}><path d="M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01" /></svg>);
const LockIcon = () => (<svg {...I}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
const CheckIcon = () => (<svg {...I} width={14} height={14}><path d="m5 12 5 5 9-10" /></svg>);
const Arrow = () => (<svg {...I} width={14} height={14}><path d="M7 17 17 7M8 7h9v9" /></svg>);

/** "part_owner" → "Part owner" for the preview card. */
const pretty = (v: string) => (v ? v.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

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

  /* ---------- Profile picture (saved straight away, separate from the form) ---------- */
  const confirm = useConfirm();
  const photo = useAvatar(user?.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState<"" | "upload" | "remove">("");
  const [photoNote, setPhotoNote] = useState("");
  const [photoError, setPhotoError] = useState("");
  // Development profiles have no account row, and the shared superadmin profile stays locked.
  const canHavePhoto = !!user && !locked && /^[0-9a-f-]{36}$/i.test(user.id);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || photoBusy) return;
    setPhotoBusy("upload");
    setPhotoNote("");
    setPhotoError("");
    try {
      await uploadAvatar(user.id, file);
      setPhotoNote("Profile picture saved.");
    } catch (reason) {
      setPhotoError(reason instanceof Error ? reason.message : "The picture couldn't be saved. Try again.");
    } finally {
      setPhotoBusy("");
    }
  }

  async function deletePhoto() {
    if (!user || photoBusy) return;
    const sure = await confirm({
      title: "Remove your profile picture?",
      message: "Members will see your initials instead. You can add a new picture at any time.",
      confirmLabel: "Remove picture",
      cancelLabel: "Keep picture",
      tone: "danger",
    });
    if (!sure) return;
    setPhotoBusy("remove");
    setPhotoNote("");
    setPhotoError("");
    try {
      await removeAvatar(user.id);
      setPhotoNote("Profile picture removed.");
    } catch (reason) {
      setPhotoError(reason instanceof Error ? reason.message : "The picture couldn't be removed. Try again.");
    } finally {
      setPhotoBusy("");
    }
  }

  /* ---------- Derived: unsaved changes, completeness, preview ---------- */
  const saved = {
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    country: p?.country ?? "",
    city: p?.city ?? "",
    racingRole: p?.racingRole ?? "",
    communityRoles: p?.communityRoles ?? [],
    organisation: p?.organisation ?? "",
    bio: p?.bio ?? "",
  };
  const dirty =
    firstName !== saved.firstName ||
    lastName !== saved.lastName ||
    country !== saved.country ||
    city !== saved.city ||
    racingRole !== saved.racingRole ||
    organisation !== saved.organisation ||
    bio !== saved.bio ||
    communityRoles.length !== saved.communityRoles.length ||
    communityRoles.some((r, i) => r !== saved.communityRoles[i]);

  const checks = [
    { label: "Name", done: !!firstName.trim() && !!lastName.trim() },
    { label: "Country", done: !!country },
    { label: "Town or city", done: !!city.trim() },
    { label: "Racing role", done: !!racingRole },
    { label: "Organisation", done: !!organisation.trim() },
    { label: "Short bio", done: !!bio.trim() },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);

  const fullName = `${firstName} ${lastName}`.trim() || user?.displayName || "Your name";
  const initials =
    [firstName, lastName]
      .map((s) => s.trim().charAt(0))
      .join("")
      .toUpperCase() || (user?.displayName ?? "?").charAt(0).toUpperCase();
  const countryName = countries.find((c) => c.code === country)?.name ?? "";
  const place = [city.trim(), countryName].filter(Boolean).join(", ");
  const bioLeft = 280 - bio.length;

  function discard() {
    setFirstName(saved.firstName);
    setLastName(saved.lastName);
    setCountry(saved.country);
    setCity(saved.city);
    setRacingRole(saved.racingRole);
    setCommunityRoles(saved.communityRoles);
    setOrganisation(saved.organisation);
    setBio(saved.bio);
    setError("");
    setNotice("");
  }

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
    <div className="pf">
      <div className="pf-account-head">
        <AccountHeader title="Profile" intro="How you appear to other members, and your place in racing." />
      </div>

      <div className="pf-layout">
        {/* ---------- Form ---------- */}
        <form className="pf-form" onSubmit={save}>
          {locked && (
            <p className="pf-alert pf-alert-lock" role="note">
              <LockIcon />
              <span>
                The superadmin profile is locked and can't be edited here. Your password and 2-step login can still be
                changed on the <Link to="/account/security">Security page</Link>.
              </span>
            </p>
          )}

          <fieldset className="pf-card gx-glass" disabled={locked}>
            <legend className="pf-card-head">
              <span className="pf-num" aria-hidden="true"><UserIcon /></span>
              <span>
                <strong>About you</strong>
                <small>Your name and where you're based.</small>
              </span>
            </legend>
            <div className="pf-grid">
              <label className="pf-field">
                <span className="pf-label">First name <em aria-hidden="true">*</em></span>
                <input autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required />
              </label>
              <label className="pf-field">
                <span className="pf-label">Last name <em aria-hidden="true">*</em></span>
                <input autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required />
              </label>
              <label className="pf-field">
                <span className="pf-label">Country <em aria-hidden="true">*</em></span>
                <select autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span className="pf-label">Town or city <small>Optional</small></span>
                <input autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
              </label>
            </div>
          </fieldset>

          <fieldset className="pf-card gx-glass" disabled={locked}>
            <legend className="pf-card-head">
              <span className="pf-num" aria-hidden="true"><FlagIcon /></span>
              <span>
                <strong>Your place in racing</strong>
                <small>Your roles help other members know who you are. They never change what you can access.</small>
              </span>
            </legend>
            <div className="pf-roles">
              <CommunityRoleFields
                variant="app"
                primary={racingRole}
                extras={communityRoles}
                onPrimary={setRacingRole}
                onExtras={setCommunityRoles}
                disabled={locked}
              />
            </div>
            <label className="pf-field">
              <span className="pf-label">Stable, farm or organisation <small>Optional</small></span>
              <input autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} maxLength={100} />
            </label>
          </fieldset>

          <fieldset className="pf-card gx-glass" disabled={locked}>
            <legend className="pf-card-head">
              <span className="pf-num" aria-hidden="true"><PenIcon /></span>
              <span>
                <strong>Short bio</strong>
                <small>A line or two other members see on your profile.</small>
              </span>
            </legend>
            <label className="pf-field">
              <span className="pf-label">
                Bio <small>Optional</small>
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="For example: Part-owner of two sprinters, at the track most Sundays."
              />
            </label>
            <div className="pf-count" aria-live="polite">
              <span
                className={`pf-ring${bioLeft <= 20 ? " is-low" : ""}`}
                style={{ ["--pf-fill" as string]: `${(bio.length / 280) * 100}%` }}
                aria-hidden="true"
              />
              <span>
                {bio.length} / 280
              </span>
            </div>
          </fieldset>

          {error && (
            <p className="pf-alert pf-alert-error" role="alert">
              {error}
            </p>
          )}
          {notice && !dirty && (
            <p className="pf-alert pf-alert-ok" role="status">
              <CheckIcon /> {notice}
            </p>
          )}

          {!locked && (
            <div className={`pf-savebar gx-glass${dirty ? " is-dirty" : ""}`}>
              <span className="pf-save-state" aria-live="polite">
                <span className="pf-save-dot" aria-hidden="true" />
                {busy ? "Saving your profile…" : dirty ? "You have unsaved changes" : "All changes saved"}
              </span>
              <span className="pf-save-actions">
                {dirty && !busy && (
                  <button type="button" className="pf-btn pf-btn-ghost" onClick={discard}>
                    Discard
                  </button>
                )}
                <button type="submit" className="pf-btn pf-btn-primary" disabled={busy || !dirty}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </span>
            </div>
          )}
        </form>

        {/* ---------- Preview & completeness ---------- */}
        <aside className="pf-side" aria-label="Profile preview">
          <section className="pf-preview gx-glass">
            <span className="pf-kicker">How members see you</span>
            <div className="pf-id">
              <span className="pf-avatar" aria-hidden="true">
                <AvatarFace id={user?.id}>{initials}</AvatarFace>
              </span>
              <div>
                <h2>{fullName}</h2>
                {racingRole && <span className="pf-role">{pretty(racingRole)}</span>}
              </div>
            </div>
            {canHavePhoto && (
              <div className="pf-photo" role="group" aria-label="Profile picture">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="pf-sr"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={choosePhoto}
                />
                <button type="button" className="pf-btn pf-btn-sm" onClick={() => fileInput.current?.click()} disabled={!!photoBusy}>
                  {photoBusy === "upload" ? "Uploading…" : photo ? "Change picture" : "Add a profile picture"}
                </button>
                {photo && (
                  <button type="button" className="pf-btn pf-btn-sm" onClick={deletePhoto} disabled={!!photoBusy}>
                    {photoBusy === "remove" ? "Removing…" : "Remove"}
                  </button>
                )}
                {photoNote && <p className="pf-photo-note" role="status">{photoNote}</p>}
                {photoError && <p className="pf-photo-note is-error" role="alert">{photoError}</p>}
              </div>
            )}
            {communityRoles.length > 0 && (
              <ul className="pf-tags" aria-label="Other roles">
                {communityRoles.map((r) => (
                  <li key={r}>{pretty(r)}</li>
                ))}
              </ul>
            )}
            <ul className="pf-meta">
              {place && (
                <li>
                  <PinIcon /> {place}
                </li>
              )}
              {organisation.trim() && (
                <li>
                  <BuildingIcon /> {organisation.trim()}
                </li>
              )}
            </ul>
            <p className={`pf-bio${bio.trim() ? "" : " is-empty"}`}>
              {bio.trim() || "Add a short bio so other members know who you are."}
            </p>
          </section>

          <section className="pf-progress gx-glass" aria-labelledby="pf-progress-title">
            <div className="pf-progress-head">
              <h2 id="pf-progress-title">Profile strength</h2>
              <strong>{percent}%</strong>
            </div>
            <span
              className="pf-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-labelledby="pf-progress-title"
            >
              <span style={{ width: `${percent}%` }} />
            </span>
            <ul className="pf-checks">
              {checks.map((c) => (
                <li key={c.label} className={c.done ? "is-done" : undefined}>
                  <span className="pf-check" aria-hidden="true">{c.done && <CheckIcon />}</span>
                  {c.label}
                  <span className="pf-sr">{c.done ? " (done)" : " (missing)"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pf-next pf-horses gx-glass">
            <h2>My horses</h2>
            <p>Give each of your horses a profile with photos, pedigree and race history, then share updates in Feeds.</p>
            <div className="pf-next-actions">
              <Link className="pf-btn pf-btn-primary" to="/account/horses">
                Manage my horses <Arrow />
              </Link>
              {user && (
                <Link className="pf-btn" to={`/community/people/${user.id}`}>
                  Public profile <Arrow />
                </Link>
              )}
            </div>
          </section>

          <section className="pf-next gx-glass">
            <h2>Racing records</h2>
            <p>View racing records, save notes, follow horses, and send private messages. You can also create a stable or join a team.</p>
            <div className="pf-next-actions">
              <Link className="pf-btn pf-btn-primary" to="/entries">
                View racecards <Arrow />
              </Link>
              <Link className="pf-btn" to="/updates">
                See what's new <Arrow />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
