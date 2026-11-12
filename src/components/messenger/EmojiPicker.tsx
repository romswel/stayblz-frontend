import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_EMOJI, EMOJI_CATEGORIES, type EmojiEntry } from "./emojiData";

const RECENT_KEY = "stayblz.chat.recentEmoji";
const readRecent = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((e) => typeof e === "string").slice(0, 16) : [];
  } catch {
    return [];
  }
};

/**
 * Emoji panel: search, recently used, and categories. Used by the message box (inserts at the
 * cursor) and by reactions ("+" for any emoji). Escape closes it; focus starts in the search box.
 */
export default function EmojiPicker({
  onPick,
  onClose,
  label = "Emoji",
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(readRecent);
  const [tab, setTab] = useState(EMOJI_CATEGORIES[0].name);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    search.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as Element).closest?.("[data-emoji-toggle]")) close.current();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_EMOJI.filter((e) => e.words.includes(q)).slice(0, 80);
  }, [query]);
  const category = EMOJI_CATEGORIES.find((c) => c.name === tab) ?? EMOJI_CATEGORIES[0];

  function pick(emoji: string) {
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 16);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* Storage blocked: recent list just isn't kept. */
    }
    onPick(emoji);
  }
  const grid = (list: EmojiEntry[]) => (
    <div className="mx-emoji-grid">
      {list.map((e) => (
        <button key={e.emoji} type="button" title={e.label} aria-label={e.label} onClick={() => pick(e.emoji)}>
          {e.emoji}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-emoji" ref={box} role="dialog" aria-label={label}>
      <input
        ref={search}
        type="search"
        className="mx-emoji-search"
        placeholder="Search emoji"
        aria-label="Search emoji"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mx-emoji-body">
        {results ? (
          results.length ? grid(results) : <p className="mx-hint">No emoji match “{query}”.</p>
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <p className="mx-emoji-label">Recent</p>
                {grid(recent.map((emoji) => ALL_EMOJI.find((x) => x.emoji === emoji) ?? { emoji, words: "emoji", label: emoji }))}
              </>
            )}
            <p className="mx-emoji-label">{category.name}</p>
            {grid(category.items)}
          </>
        )}
      </div>
      {!results && (
        <div className="mx-emoji-tabs" role="tablist" aria-label="Emoji groups">
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.name}
              type="button"
              role="tab"
              aria-selected={c.name === tab}
              aria-label={c.name}
              title={c.name}
              onClick={() => setTab(c.name)}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
