import { useRef, useState } from "react";
import GeneticsFields from "./GeneticsFields";
import HorseLookup from "./HorseLookup";
import { stallionsApi } from "./api";
import { BREEDS, pedigreePaths, positionLabel } from "./options";
import type { MareDraft } from "./types";

export const emptyMare = (): MareDraft => ({ name: "", breed: "thoroughbred", foaled: null, registration: "", pedigree: {}, genetics: {}, racingHorseId: null });
const thisYear = new Date().getFullYear();
const MORE = pedigreePaths(3).filter((p) => !["s", "d", "ds"].includes(p));

/**
 * A mare: pick her from Stayblz racing data (fills her pedigree) or type her in. Sire, dam and dam's sire first;
 * the rest of three generations and her genetic tests are optional.
 */
export default function MareFields({
  value,
  onChange,
  disabled,
  idPrefix = "mare",
  showGenetics = true,
}: {
  value: MareDraft;
  onChange: (next: MareDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
  showGenetics?: boolean;
}) {
  const [more, setMore] = useState(() => MORE.some((p) => value.pedigree[p]));
  const [genes, setGenes] = useState(() => Object.keys(value.genetics).length > 0);
  const [filling, setFilling] = useState(false);
  const [note, setNote] = useState("");
  // The mare as she is now: whatever was typed while "Fill in" was looking is kept.
  const latest = useRef(value);
  latest.current = value;
  const ped = (path: string, name: string) => {
    const next = { ...value.pedigree };
    if (name.trim()) next[path] = name;
    else delete next[path];
    onChange({ ...value, pedigree: next });
  };

  async function fill(from: MareDraft = value) {
    if (!from.name.trim() && !from.pedigree.s && !from.pedigree.d) {
      setNote("Type her name, sire or dam first.");
      return;
    }
    setFilling(true);
    setNote("");
    try {
      const r = await stallionsApi.fillPedigree({ name: from.name.trim(), pedigree: from.pedigree, depth: 3 });
      const now = latest.current;
      if (now.name.trim() !== from.name.trim() || (now.pedigree.s ?? "") !== (from.pedigree.s ?? "") || (now.pedigree.d ?? "") !== (from.pedigree.d ?? "")) {
        setNote("She changed while we looked. Try Fill in again.");
        return;
      }
      const add = Object.fromEntries(r.filled.filter((p) => !now.pedigree[p]).map((p) => [p, r.pedigree[p]]));
      const count = Object.keys(add).length;
      onChange({ ...now, pedigree: { ...now.pedigree, ...add } });
      if (count && MORE.some((p) => add[p])) setMore(true);
      setNote(count ? `Filled in ${count} ${count === 1 ? "name" : "names"} from Stayblz. Check them.` : "Stayblz doesn't know more of her pedigree yet.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Her pedigree couldn't be filled in right now.");
    } finally {
      setFilling(false);
    }
  }

  return (
    <div className="st-mare">
      <div className="st-grid-2">
        <div className="st-field">
          <label htmlFor={`${idPrefix}-name`}>Mare's name</label>
          <HorseLookup
            id={`${idPrefix}-name`}
            label="Mare's name"
            sex="female"
            value={value.name}
            disabled={disabled}
            placeholder="Start typing to find her"
            onChange={(name) => onChange({ ...value, name, racingHorseId: null })}
            onPick={(h) => {
              const picked: MareDraft = {
                ...value,
                name: h.name,
                foaled: h.foaled ?? value.foaled,
                breed: BREEDS.some((b) => b.value === h.breed) ? h.breed : value.breed,
                racingHorseId: h.id,
                pedigree: { ...value.pedigree, ...(h.sire ? { s: h.sire } : {}), ...(h.dam ? { d: h.dam } : {}), ...(h.damSire ? { ds: h.damSire } : {}) },
              };
              onChange(picked);
              void fill(picked);
            }}
          />
        </div>
        <div className="st-grid-2 is-tight">
          <label className="st-field">
            <span>Breed</span>
            <select value={value.breed} disabled={disabled} onChange={(e) => onChange({ ...value, breed: e.target.value })}>
              {BREEDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="st-field">
            <span>
              Foaled <em>Optional</em>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1980}
              max={thisYear}
              value={value.foaled ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, foaled: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
        </div>
      </div>
      <div className="st-grid-3">
        {(["s", "d", "ds"] as const).map((p) => (
          <label key={p} className="st-field">
            <span>Her {positionLabel(p).toLowerCase()}</span>
            <input value={value.pedigree[p] ?? ""} maxLength={40} disabled={disabled} onChange={(e) => ped(p, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="st-row-actions">
        <button type="button" className="st-link" onClick={() => setMore((v) => !v)} aria-expanded={more}>
          {more ? "Hide the rest of her pedigree" : "Add more of her pedigree"}
        </button>
        <button type="button" className="st-link" onClick={() => void fill()} disabled={disabled || filling}>
          {filling ? "Looking…" : "Fill in from Stayblz"}
        </button>
        {showGenetics && (
          <button type="button" className="st-link" onClick={() => setGenes((v) => !v)} aria-expanded={genes}>
            {genes ? "Hide genetic tests" : "Add genetic tests"}
          </button>
        )}
      </div>
      {note && (
        <p className="st-muted" role="status">
          {note}
        </p>
      )}
      {more && (
        <div className="st-grid-3">
          {MORE.map((p) => (
            <label key={p} className="st-field">
              <span>{positionLabel(p)}</span>
              <input value={value.pedigree[p] ?? ""} maxLength={40} disabled={disabled} onChange={(e) => ped(p, e.target.value)} />
            </label>
          ))}
        </div>
      )}
      {showGenetics && genes && <GeneticsFields breed={value.breed} who="she" value={value.genetics} disabled={disabled} onChange={(genetics) => onChange({ ...value, genetics })} />}
    </div>
  );
}
