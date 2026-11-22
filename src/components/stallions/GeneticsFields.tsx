import { useState } from "react";
import { GENETIC_TESTS, geneticResult } from "./options";
import type { Genetics } from "./types";

/**
 * Genetic test results as the lab writes them (N/N, N/x, x/x). Tests usual for the breed show first; the rest are
 * one click away. "Not tested" leaves a test out.
 */
export default function GeneticsFields({
  breed,
  value,
  onChange,
  disabled,
  who = "he",
}: {
  breed: string;
  value: Genetics;
  onChange: (next: Genetics) => void;
  disabled?: boolean;
  who?: "he" | "she";
}) {
  const [all, setAll] = useState(false);
  const usual = GENETIC_TESTS.filter((t) => t.breeds.includes(breed));
  const shown = all || !usual.length ? GENETIC_TESTS : GENETIC_TESTS.filter((t) => t.breeds.includes(breed) || value[t.key] !== undefined);
  const set = (key: string, raw: string) => {
    const next = { ...value };
    if (raw === "") delete next[key];
    else next[key] = Number(raw) as 0 | 1 | 2;
    onChange(next);
  };
  return (
    <div className="st-genetics">
      <div className="st-genetics-grid">
        {shown.map((t) => (
          <label key={t.key} className="st-field" title={t.name}>
            <span>
              {t.label} <em>{t.name}</em>
            </span>
            <select value={value[t.key] === undefined ? "" : String(value[t.key])} onChange={(e) => set(t.key, e.target.value)} disabled={disabled}>
              <option value="">Not tested</option>
              <option value="0">{geneticResult(t.key, 0)} (clear)</option>
              <option value="1">{geneticResult(t.key, 1)} (one copy)</option>
              <option value="2">{geneticResult(t.key, 2)} (two copies)</option>
            </select>
          </label>
        ))}
      </div>
      {usual.length > 0 && usual.length < GENETIC_TESTS.length && (
        <button type="button" className="st-link" onClick={() => setAll((v) => !v)}>
          {all ? "Show only the usual tests for this breed" : "Show every test"}
        </button>
      )}
      <p className="st-muted">Enter the results from {who === "he" ? "his" : "her"} lab report. They're shown as given; Stayblz doesn't check them.</p>
    </div>
  );
}
