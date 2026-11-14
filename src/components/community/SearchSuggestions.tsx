import { useEffect, useRef, useState } from "react";
import { community, horseImageUrl, STATUS_LABELS, type SearchResults } from "./api";
import { Avatar, Icon } from "./ui";

export type Suggestion =
  | { kind: "person"; id: string; to: string; label: string }
  | { kind: "horse"; id: string; to: string; label: string }
  | { kind: "all-members"; id: string; to: string; label: string }
  | { kind: "records"; id: string; to: string; label: string };

/**
 * Live member and horse suggestions for the header search. Waits for a short pause in
 * typing, cancels stale requests, and returns a flat list for keyboard navigation.
 */
export function useQuickSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = query.trim();
  useEffect(() => {
    if (!enabled || text.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    const t = window.setTimeout(() => {
      community
        .search(text, c.signal)
        .then((r) => {
          setResults(r);
          setFailed(false);
        })
        .catch(() => {
          if (!c.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(t);
      c.abort();
    };
  }, [text, enabled]);

  const items: Suggestion[] = [];
  if (text.length >= 2) {
    for (const p of results?.people ?? []) items.push({ kind: "person", id: p.id, to: `/community/people/${p.id}`, label: p.name });
    for (const h of results?.horses ?? []) items.push({ kind: "horse", id: h.id, to: `/community/horses/${h.id}`, label: h.name });
    items.push({ kind: "all-members", id: "all-members", to: `/community?tab=members&q=${encodeURIComponent(text)}`, label: "See all matching members" });
    items.push({ kind: "records", id: "records", to: `/dashboard?q=${encodeURIComponent(text)}`, label: "Search racing records" });
  }
  return { results, items, loading, failed };
}

/** Wraps the matched part of a name in <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function SearchSuggestions({
  id,
  query,
  results,
  items,
  loading,
  failed,
  active,
  onHover,
  onPick,
}: {
  id: string;
  query: string;
  results: SearchResults | null;
  items: Suggestion[];
  loading: boolean;
  failed: boolean;
  active: number;
  onHover: (index: number) => void;
  onPick: (item: Suggestion) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const text = query.trim();
  // Keep the highlighted row in view while using the arrow keys.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  if (text.length < 2) return null;

  const people = results?.people ?? [];
  const horses = results?.horses ?? [];
  const indexOf = (kind: Suggestion["kind"], itemId: string) => items.findIndex((i) => i.kind === kind && i.id === itemId);
  const empty = !loading && !failed && results && !people.length && !horses.length;
  const row = (index: number) => ({
    id: `${id}-opt-${index}`,
    role: "option" as const,
    "aria-selected": active === index,
    "data-index": index,
    className: `gx-suggest-row${active === index ? " is-active" : ""}`,
    onMouseEnter: () => onHover(index),
    // mousedown keeps focus in the search box until the pick is made
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => onPick(items[index]),
  });

  return (
    <div className="gx-suggest gx-glass" id={id} role="listbox" aria-label="Search suggestions" ref={listRef}>
      <div className="gx-suggest-status" aria-live="polite">
        {loading ? (
          <><span className="gx-suggest-spinner" aria-hidden="true" /> Searching members and horses…</>
        ) : failed ? (
          "Suggestions are unavailable. Press Enter to search racing records."
        ) : empty ? (
          <>No members or horses match “{text}”.</>
        ) : (
          <>{people.length + horses.length} match{people.length + horses.length === 1 ? "" : "es"}</>
        )}
      </div>

      {people.length > 0 && (
        <div className="gx-suggest-group" role="group" aria-label="Members">
          <div className="gx-suggest-head"><Icon.Users /> Members</div>
          {people.map((p) => {
            const i = indexOf("person", p.id);
            return (
              <div key={p.id} {...row(i)}>
                <Avatar id={p.id} name={p.name} size={34} />
                <span className="gx-suggest-text">
                  <strong><Highlight text={p.name} query={text} />{p.me && <em> · you</em>}</strong>
                  <small>{p.headline || "Stayblz member"}</small>
                </span>
                <span className="gx-suggest-meta">{p.horses} horse{p.horses === 1 ? "" : "s"}</span>
              </div>
            );
          })}
        </div>
      )}

      {horses.length > 0 && (
        <div className="gx-suggest-group" role="group" aria-label="Horses">
          <div className="gx-suggest-head"><Icon.Horse /> Horses</div>
          {horses.map((h) => {
            const i = indexOf("horse", h.id);
            return (
              <div key={h.id} {...row(i)}>
                {h.coverImageId ? (
                  <img className="gx-suggest-thumb" src={horseImageUrl(h.coverImageId)} alt="" loading="lazy" />
                ) : (
                  <span className="gx-suggest-thumb is-empty" aria-hidden="true"><Icon.Horse /></span>
                )}
                <span className="gx-suggest-text">
                  <strong><Highlight text={h.name} query={text} /></strong>
                  <small>
                    {[h.breed, h.mine ? "Your horse" : `Owned by ${h.owner.name}`].filter(Boolean).join(" · ")}
                  </small>
                </span>
                <span className={`gx-suggest-status-chip is-${h.status}`}>{STATUS_LABELS[h.status]}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="gx-suggest-foot" role="group" aria-label="More results">
        {(["all-members", "records"] as const).map((kind) => {
          const i = indexOf(kind, kind);
          return (
            <div key={kind} {...row(i)}>
              <span className="gx-suggest-icon" aria-hidden="true">{kind === "records" ? <Icon.Flag /> : <Icon.Search />}</span>
              <span className="gx-suggest-text">
                <strong>{items[i]?.label}</strong>
                <small>for “{text}”</small>
              </span>
              <span className="gx-suggest-go" aria-hidden="true"><Icon.Arrow /></span>
            </div>
          );
        })}
      </div>
      <div className="gx-suggest-keys" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
        <span><kbd>Enter</kbd> to open</span>
        <span><kbd>Esc</kbd> to close</span>
      </div>
    </div>
  );
}