import { useId } from "react";
import { allRoles, MAX_EXTRA_ROLES, roleGroups } from "./communityRoles";
import "./community-roles.css";

interface Props {
  primary: string;
  extras: string[];
  onPrimary: (value: string) => void;
  onExtras: (values: string[]) => void;
  /** "landing" matches the dark sign-up panel; "app" matches the workspace pages. */
  variant: "landing" | "app";
  disabled?: boolean;
}

/** Main role (required) plus up to three other roles, grouped the way racing is organised. */
export default function CommunityRoleFields({ primary, extras, onPrimary, onExtras, variant, disabled }: Props) {
  const hintId = useId();
  const hint = allRoles.find((role) => role.value === primary)?.hint;
  const full = extras.length >= MAX_EXTRA_ROLES;

  function choosePrimary(value: string) {
    onPrimary(value);
    if (extras.includes(value)) onExtras(extras.filter((role) => role !== value));
  }
  function toggle(value: string, on: boolean) {
    onExtras(on ? [...extras, value].slice(0, MAX_EXTRA_ROLES) : extras.filter((role) => role !== value));
  }

  return (
    <div className={`roles roles-${variant}`}>
      <label className={variant === "landing" ? "ld-field" : "roles-field"}>
        Your main role in racing
        <select
          name="racingRole"
          value={primary}
          onChange={(e) => choosePrimary(e.target.value)}
          aria-describedby={hint ? hintId : undefined}
          required
          disabled={disabled}
        >
          <option value="">Select your role</option>
          {roleGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {hint && (
        <p className="roles-hint" id={hintId}>
          {hint}
        </p>
      )}
      <details className="roles-more" open={extras.length > 0 || undefined}>
        <summary>
          Also involved in other ways? <span>(optional, up to {MAX_EXTRA_ROLES})</span>
        </summary>
        <fieldset disabled={disabled}>
          <legend className="roles-sr">Other roles in racing</legend>
          {roleGroups.map((group) => (
            <div key={group.label} className="roles-group">
              <span className="roles-group-label">{group.label}</span>
              {group.roles.map((role) => {
                const checked = extras.includes(role.value);
                return (
                  <label key={role.value} className="roles-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={role.value === primary || (!checked && full)}
                      onChange={(e) => toggle(role.value, e.target.checked)}
                    />
                    {role.label}
                  </label>
                );
              })}
            </div>
          ))}
          <p className="roles-count" role="status">
            {extras.length} of {MAX_EXTRA_ROLES} chosen
          </p>
        </fieldset>
      </details>
    </div>
  );
}
