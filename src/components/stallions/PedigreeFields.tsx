import { useRef, useState } from "react";
import { stallionsApi } from "./api";
import { pedigreePaths, positionLabel } from "./options";
import type { Pedigree } from "./types";

const GENERATIONS = [
  { n: 1, title: "Parents" },
  { n: 2, title: "Grandparents" },
  { n: 3, title: "Great-grandparents" },
  { n: 4, title: "Fourth generation" },
];

/**
 * A stallion's pedigree, four generations (30 names). Sire and dam are needed to publish; the rest helps breeders
 * and the mating check. "Fill in from Stayblz" adds names Stayblz already knows (never replaces a typed one).
 */
export default function PedigreeFields({ name, value, onChange, disabled }: { name: string; value: Pedigree; onChange: (next: Pedigree) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(() => Math.max(2, ...Object.keys(value).map((p) => p.length)));
  const [filling, setFilling] = useState(false);
  const [note, setNote] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  // The value as it is now (names typed while "Fill in" was looking must not be lost).
  const latest = useRef(value);
  latest.current = value;
  const set = (path: string, text: string) => {
    const next = { ...value };
    if (text.trim()) next[path] = text;
    else delete next[path];
    setFresh((f) => {
      const n = new Set(f);
      n.delete(path);
      return n;
    });
    onChange(next);
  };

  async function fill() {
    if (!name.trim() && !value.s && !value.d) {
      setNote("Type his name, sire or dam first.");
      return;
    }
    setFilling(true);
    setNote("");
    try {
      const r = await stallionsApi.fillPedigree({ name: name.trim(), pedigree: value, depth: 4 });
      const now = latest.current;
      const added = r.filled.filter((p) => !now[p]);
      onChange({ ...now, ...Object.fromEntries(added.map((p) => [p, r.pedigree[p]])) });
      setFresh(new Set(added));
      if (added.length) setOpen(Math.max(open, ...added.map((p) => p.length)));
      setNote(
        added.length
          ? `Filled in ${added.length} ${added.length === 1 ? "name" : "names"} from ${r.sources.includes("stallion") ? "Stayblz stallion pages" : "Stayblz racing data"}${r.sources.length > 1 ? " and racing data" : ""}. They're marked; check them.`
          : "Stayblz doesn't know more of his pedigree yet. Type the rest in.",
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "The pedigree couldn't be filled in right now.");
    } finally {
      setFilling(false);
    }
  }

  return (
    <div className="st-ped-fields">
      <div className="st-row-actions">
        <button type="button" className="btn btn-quiet" onClick={() => void fill()} disabled={disabled || filling}>
          {filling ? "Looking…" : "Fill in from Stayblz"}
        </button>
        {note && (
          <span className="st-muted" role="status">
            {note}
          </span>
        )}
      </div>
      {GENERATIONS.filter((g) => g.n <= open).map((g) => {
        const paths = pedigreePaths(g.n).filter((p) => p.length === g.n);
        return (
          <fieldset key={g.n} className="st-ped-gen">
            <legend>
              {g.title}
              {g.n === 1 && <em> needed to publish</em>}
            </legend>
            <div className="st-ped-gen-grid" style={{ ["--cols" as string]: Math.min(4, paths.length) }}>
              {(["s", "d"] as const).map((side) => (
                <div key={side} className={`st-ped-side is-${side === "s" ? "sire" : "dam"}`}>
                  <span className="st-ped-side-label">{side === "s" ? "Sire's side" : "Dam's side"}</span>
                  {paths
                    .filter((p) => p[0] === side)
                    .map((p) => (
                      <label key={p} className={`st-field${fresh.has(p) ? " is-filled" : ""}`}>
                        <span>{positionLabel(p)}</span>
                        <input value={value[p] ?? ""} maxLength={40} disabled={disabled} onChange={(e) => set(p, e.target.value)} />
                      </label>
                    ))}
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
      {open < 4 && (
        <button type="button" className="st-link" onClick={() => setOpen((n) => n + 1)}>
          Add the {GENERATIONS[open].title.toLowerCase()}
        </button>
      )}
    </div>
  );
}
