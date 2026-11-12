import { useEffect, useState } from "react";
import { peopleApi } from "./chatApi";
import { Avatar, CloseIcon } from "./icons";
import type { Person } from "./types";

/**
 * Pick people: your friends are listed first; typing 2+ letters searches members by name.
 * `pool` replaces both (team chats pick from the stable roster instead).
 */
export default function PersonPicker({
  picked,
  onChange,
  exclude = [],
  pool,
  max = 29,
  autoFocus = true,
}: {
  picked: Person[];
  onChange: (people: Person[]) => void;
  exclude?: string[];
  pool?: Person[] | null;
  max?: number;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const team = pool !== undefined;
  const [friends, setFriends] = useState<Person[] | null>(team ? [] : null);
  const [found, setFound] = useState<Person[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (team) return;
    const c = new AbortController();
    peopleApi
      .friends(c.signal)
      .then((d) => !c.signal.aborted && setFriends(d?.friends ?? []))
      .catch(() => !c.signal.aborted && setFriends([]));
    return () => c.abort();
  }, [team]);
  useEffect(() => {
    const text = q.trim();
    if (team || text.length < 2) {
      setFound(null);
      return;
    }
    const c = new AbortController();
    const timer = window.setTimeout(() => {
      peopleApi
        .search(text, c.signal)
        .then((d) => !c.signal.aborted && (setFound(d?.people ?? []), setError("")))
        .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Search isn't working right now."));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      c.abort();
    };
  }, [q, team]);

  // People already in the chat are hidden; people you picked stay listed (ticked) so you can untick them.
  const taken = new Set(exclude);
  const text = q.trim().toLowerCase();
  const list = (team ? (pool ?? []).filter((p) => !text || p.name.toLowerCase().includes(text)) : found ?? friends ?? []).filter(
    (p) => !taken.has(p.id),
  );
  const toggle = (p: Person) =>
    onChange(picked.some((x) => x.id === p.id) ? picked.filter((x) => x.id !== p.id) : picked.length < max ? [...picked, p] : picked);

  return (
    <div className="mx-picker-people">
      {picked.length > 0 && (
        <ul className="mx-chips" aria-label="Chosen">
          {picked.map((p) => (
            <li key={p.id}>
              <Avatar name={p.name} size="xs" />
              {p.name}
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => toggle(p)}>
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="mx-field">
        <span className="ld-label">To</span>
        <input
          type="search"
          placeholder={team ? "Search teammates" : "Type a name"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          {...(autoFocus ? { "data-autofocus": true } : {})}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <p className="mx-list-label">{team ? "Teammates" : found ? "Results" : "Friends"}</p>
      {((team && pool === null) || (!team && friends === null && !found)) && (
        <p className="mx-hint" role="status">
          Loading…
        </p>
      )}
      {list.length === 0 && (team ? pool !== null : friends !== null || found) && (
        <p className="mx-hint">
          {team ? "No other teammates." : found ? "No one found by that name." : "No friends yet — type a name to search members."}
        </p>
      )}
      <ul className="mx-pick" aria-label="People">
        {list.slice(0, 30).map((p) => (
          <li key={p.id}>
            <label>
              <input type="checkbox" checked={picked.some((x) => x.id === p.id)} onChange={() => toggle(p)} aria-label={p.name} />
              <Avatar name={p.name} size="sm" active={!!p.active} />
              <span>{p.name}</span>
              {p.status === "friends" && !team && <span className="mx-tag">Friend</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
