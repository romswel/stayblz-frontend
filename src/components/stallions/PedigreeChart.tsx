import { Link } from "react-router-dom";
import { nameKey, positionLabel } from "./options";
import type { Pedigree } from "./types";

/**
 * A pedigree as a bracket: parents in the first column, then grandparents, and so on. Each horse sits across the
 * rows of its own ancestors. Repeated horses (shared ancestors) get the same colour mark. Scrolls sideways inside its
 * box on narrow screens.
 */
export default function PedigreeChart({
  pedigree,
  depth = 4,
  subject,
  highlight,
  linkFor,
  label = "Pedigree",
}: {
  pedigree: Pedigree;
  depth?: number;
  /** The horse himself, shown before the parents. */
  subject?: string;
  /** nameKey → colour number (1–6) for repeated ancestors. */
  highlight?: Map<string, number>;
  /** A link for a name (e.g. his page here), or null. */
  linkFor?: (name: string) => string | null;
  label?: string;
}) {
  const rows = 2 ** depth;
  const cells: { path: string; name: string; row: number; span: number; col: number }[] = [];
  for (let g = 1; g <= depth; g++) {
    for (let i = 0; i < 2 ** g; i++) {
      const path = [...i.toString(2).padStart(g, "0")].map((b) => (b === "0" ? "s" : "d")).join("");
      const span = 2 ** (depth - g);
      cells.push({ path, name: pedigree[path] ?? "", row: i * span + 1, span, col: g + (subject ? 1 : 0) });
    }
  }
  const named = cells.filter((c) => c.name).length;
  return (
    <figure className="st-ped" aria-label={label}>
      <div className="st-ped-scroll" tabIndex={0} aria-label={`${label}, ${named} of ${cells.length} ancestors named`}>
        <ol
          className="st-ped-grid"
          style={{ gridTemplateRows: `repeat(${rows}, minmax(${depth >= 5 ? 22 : 28}px, auto))`, gridTemplateColumns: `${subject ? "minmax(120px, 0.9fr) " : ""}repeat(${depth}, minmax(132px, 1fr))` }}
        >
          {subject && (
            <li className="st-ped-cell is-subject" style={{ gridRow: `1 / span ${rows}`, gridColumn: 1 }}>
              <span className="st-ped-name">{subject}</span>
            </li>
          )}
          {cells.map((c) => {
            const mark = c.name ? highlight?.get(nameKey(c.name)) : undefined;
            const href = c.name && linkFor ? linkFor(c.name) : null;
            return (
              <li
                key={c.path}
                className={`st-ped-cell is-${c.path.at(-1) === "s" ? "sire" : "dam"}${c.name ? "" : " is-empty"}${mark ? ` is-mark is-mark-${mark}` : ""}`}
                style={{ gridRow: `${c.row} / span ${c.span}`, gridColumn: c.col }}
                title={positionLabel(c.path)}
              >
                <span className="st-ped-pos">{positionLabel(c.path)}</span>
                <span className="st-ped-name">{c.name ? href ? <Link to={href}>{c.name}</Link> : c.name : "Not given"}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}

/** Colour marks for repeated ancestors (closest first), for PedigreeChart's `highlight`. */
export function marksFor(names: string[]) {
  const map = new Map<string, number>();
  names.slice(0, 6).forEach((n, i) => map.set(nameKey(n), i + 1));
  return map;
}
