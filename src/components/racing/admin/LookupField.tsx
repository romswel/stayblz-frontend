import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../../api";

export type LookupKind = "horse" | "jockey" | "driver" | "trainer" | "owner";
export type Picked = { id: string; name: string } | null;

/**
 * Search-or-create picker for horses and people in the publishing tool. Type a few letters,
 * pick a match, or create a new record with the typed name.
 */
export default function LookupField({
  kind,
  label,
  value,
  onChange,
  required = false,
}: {
  kind: LookupKind;
  label: string;
  value: Picked;
  onChange: (value: Picked) => void;
  required?: boolean;
}) {
  const listId = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [results, setResults] = useState<{ id: string; name: string; country?: string; sire?: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  // Show the chosen record's name when a new one is picked (never wipe what someone is typing).
  useEffect(() => {
    if (value) setText(value.name);
  }, [value?.id]);
  useEffect(() => {
    if (!open || text.trim().length < 1 || text === value?.name) return;
    const id = ++request.current;
    const timer = window.setTimeout(() => {
      api
        .get<{ results: typeof results }>(`/api/admin/racing/lookup?kind=${kind}&q=${encodeURIComponent(text.trim())}`)
        .then((body) => id === request.current && setResults(body.results ?? []))
        .catch(() => id === request.current && setResults([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [text, open, kind]);

  const exact = results.some((r) => r.name.toLowerCase() === text.trim().toLowerCase());
  const options = [...results.map((r) => ({ ...r, create: false })), ...(text.trim().length >= 2 && !exact ? [{ id: "", name: text.trim(), create: true }] : [])];

  async function choose(option: (typeof options)[number]) {
    setOpen(false);
    setError("");
    if (!option.create) {
      onChange({ id: option.id, name: option.name });
      setText(option.name);
      return;
    }
    setBusy(true);
    try {
      const body = await api.post<{ record: { id: string; name: string } }>(
        kind === "horse" ? "/api/admin/racing/horses" : "/api/admin/racing/people",
        kind === "horse" ? { name: option.name } : { name: option.name, kind },
      );
      onChange({ id: body.record.id, name: body.record.name });
      setText(body.record.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rca-lookup">
      <label>
        <span>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </span>
        <input
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={text}
          disabled={busy}
          placeholder={kind === "horse" ? "Type a horse name" : "Type a name"}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (value && e.target.value !== value.name) onChange(null);
          }}
          onFocus={() => text && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !options.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((n) => Math.min(options.length - 1, n + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((n) => Math.max(0, n - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              void choose(options[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {value && <span className="rca-picked" aria-label={`${label} selected`}>✓</span>}
      {open && options.length > 0 && (
        <ul className="rca-options" role="listbox" id={listId}>
          {options.map((option, index) => (
            <li
              key={option.create ? "create" : option.id}
              role="option"
              aria-selected={index === active}
              className={index === active ? "is-active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(option);
              }}
            >
              {option.create ? (
                <>
                  Create <strong>“{option.name}”</strong>
                </>
              ) : (
                <>
                  {option.name}
                  {"country" in option && option.country ? <small> ({option.country})</small> : null}
                  {"sire" in option && option.sire ? <small> · by {option.sire}</small> : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
