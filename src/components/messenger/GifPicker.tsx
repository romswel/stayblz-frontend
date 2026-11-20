import { useEffect, useRef, useState } from "react";
import { gifApi, type Gif } from "./chatApi";
import { CloseIcon, SearchIcon } from "./icons";

/** Is GIF search switched on? Asked once per visit (the server says no until it has a GIPHY key). */
let available: Promise<boolean> | null = null;
export function gifSearchAvailable(): Promise<boolean> {
  if (!available)
    available = gifApi
      .find("", 0)
      .then((d) => !!d?.enabled)
      .catch(() => {
        available = null; // try again next time
        return false;
      });
  return available;
}

/**
 * GIF panel above the message box: trending GIFs, or search (GIPHY through our server). Tap one to send it.
 * Escape or a tap outside closes it. GIPHY asks for "Powered by GIPHY" next to its results.
 */
export default function GifPicker({ initialQuery = "", onPick, onClose }: { initialQuery?: string; onPick: (gif: Gif) => void; onClose: () => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Gif[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "off">("loading");
  const [more, setMore] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    // Phones: don't pop the keyboard over the GIFs straight away (unless a search came with /gif).
    if (!matchMedia("(pointer: coarse)").matches || initialQuery) input.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as Element).closest?.("[data-gif-toggle]")) close.current();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(
      () => {
        gifApi
          .find(query.trim(), 0, c.signal)
          .then((d) => {
            if (c.signal.aborted) return;
            if (!d?.enabled) return setStatus("off");
            setResults(d.results ?? []);
            setNext(d.next ?? null);
            setStatus("ready");
          })
          .catch(() => !c.signal.aborted && setStatus("error"));
      },
      query.trim() ? 320 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      c.abort();
    };
  }, [query]);

  async function loadMore() {
    if (next === null || more) return;
    setMore(true);
    try {
      const d = await gifApi.find(query.trim(), next);
      setResults((old) => [...old, ...(d?.results ?? []).filter((g) => !old.some((o) => o.id === g.id))]);
      setNext(d?.next ?? null);
    } catch {
      /* the button stays for another try */
    } finally {
      setMore(false);
    }
  }

  return (
    <div className="mx-gifs" ref={box} role="dialog" aria-label="GIFs">
      <div className="mx-gifs-head">
        <label className="mx-search">
          <SearchIcon />
          <input
            ref={input}
            type="search"
            placeholder="Search GIFs"
            aria-label="Search GIFs"
            value={query}
            maxLength={50}
            enterKeyHint="search"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button type="button" className="mx-icon-btn" aria-label="Close GIFs" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="mx-gifs-body" onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) void loadMore();
      }}>
        {status === "loading" && <p className="mx-hint mx-pad" role="status">Loading GIFs…</p>}
        {status === "error" && (
          <p className="mx-hint mx-pad" role="alert">
            GIFs aren't loading right now.{" "}
            <button type="button" className="mx-link" onClick={() => setQuery((q) => q + " ")}>
              Try again
            </button>
          </p>
        )}
        {status === "off" && <p className="mx-hint mx-pad">GIF search isn't switched on yet. You can still send a GIF file with Attach.</p>}
        {status === "ready" && !results.length && <p className="mx-hint mx-pad">No GIFs found. Try other words.</p>}
        {status === "ready" && results.length > 0 && (
          <ul className="mx-gifs-grid">
            {results.map((g) => (
              <li key={g.id}>
                <button type="button" title={g.title} aria-label={`Send GIF: ${g.title || "GIF"}`} onClick={() => onPick(g)}>
                  <img src={g.preview} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {status === "ready" && next !== null && (
          <button type="button" className="mx-pill mx-gifs-more" disabled={more} onClick={() => void loadMore()}>
            {more ? "Loading…" : "More GIFs"}
          </button>
        )}
      </div>
      <p className="mx-gifs-credit">Powered by GIPHY</p>
    </div>
  );
}
