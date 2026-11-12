import { useEffect, useRef, useState } from "react";
import { dayLabel, clock } from "./format";
import { CloseIcon, SearchIcon } from "./icons";
import type { ChatMessage } from "./types";

/** "Search in chat": searches every message on the server, lists matches, and jumps to one. */
export default function ThreadSearch({
  search,
  onPick,
  onHighlight,
  onClose,
}: {
  search: (q: string, signal: AbortSignal) => Promise<ChatMessage[]>;
  onPick: (id: string) => void;
  onHighlight: (q: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const text = q.trim();
    onHighlight(text.length >= 2 ? text : "");
    if (text.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const c = new AbortController();
    const timer = window.setTimeout(() => {
      search(text, c.signal)
        .then((list) => {
          if (!c.signal.aborted) {
            setResults(list);
            setError("");
          }
        })
        .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Search isn't working right now."))
        .finally(() => !c.signal.aborted && setLoading(false));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      c.abort();
    };
  }, [q]); // `search` and `onHighlight` change every render; only the text matters.

  return (
    <div className="mx-tsearch">
      <div className="mx-tsearch-bar">
        <label className="mx-search">
          <SearchIcon />
          <input
            ref={input}
            type="search"
            placeholder="Search in this chat"
            aria-label="Search in this chat"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
        </label>
        <span className="mx-tsearch-count" aria-live="polite">
          {loading ? "Searching…" : results ? `${results.length}${results.length === 30 ? "+" : ""} found` : ""}
        </span>
        <button type="button" className="mx-icon-btn" aria-label="Close search" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      {error && <p className="form-error mx-pad">{error}</p>}
      {results && results.length > 0 && (
        <ul className="mx-tsearch-list">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)}>
                <span className="mx-tsearch-meta">
                  <strong>{m.mine ? "You" : m.from}</strong> · {dayLabel(m.sentAt)} {clock(m.sentAt)}
                </span>
                <span className="mx-tsearch-text">{m.body || (m.attachment ? `📎 ${m.attachment.name}` : "")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
