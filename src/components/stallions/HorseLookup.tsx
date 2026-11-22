import { useEffect, useId, useRef, useState } from "react";
import { stallionsApi } from "./api";
import type { RacingHorse } from "./types";

/**
 * Type a name, pick a horse from Stayblz racing data (horses on public racing pages only). Arrow keys move through
 * the list, Enter picks, Escape closes. Typing freely is always allowed: picking is optional.
 */
export default function HorseLookup({
  value,
  onChange,
  onPick,
  sex = "",
  label,
  placeholder,
  disabled,
  id,
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (horse: RacingHorse) => void;
  sex?: "female" | "male" | "";
  label: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RacingHorse[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const picked = useRef("");

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || q === picked.current) {
      setResults([]);
      setLoading(false);
      return;
    }
    const c = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      stallionsApi
        .lookup(q, sex, c.signal)
        .then((r) => {
          if (c.signal.aborted) return;
          setResults(r);
          setActive(-1);
        })
        .catch(() => !c.signal.aborted && setResults([]))
        .finally(() => !c.signal.aborted && setLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(t);
      c.abort();
      setLoading(false);
    };
  }, [value, sex]);

  const pick = (h: RacingHorse) => {
    picked.current = h.name;
    onPick(h);
    setOpen(false);
    setResults([]);
  };
  const showList = open && results.length > 0;
  return (
    <span className="st-lookup">
      <input
        id={id}
        value={value}
        maxLength={60}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={id ? undefined : label}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          picked.current = "";
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {loading && <span className="st-lookup-spin" aria-hidden="true" />}
      {showList && (
        <ul id={listId} role="listbox" className="st-lookup-list gx-glass" aria-label={`${label}: horses in Stayblz racing data`}>
          {results.map((h, i) => (
            <li
              key={h.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(h);
              }}
            >
              <strong>
                {h.name}
                {h.country ? ` (${h.country})` : ""}
              </strong>
              <small>{[h.foaled, h.sire && `by ${h.sire}`, h.dam && `out of ${h.dam}`].filter(Boolean).join(" · ")}</small>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
