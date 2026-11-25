import { useState, type ReactNode } from "react";
import { blocksPlain, holdUrls, parseBlocks, parseInline, restoreUrls, type InlineNode } from "./chatFormat";
import { linkify } from "./format";

/**
 * Chat formatting drawn as React (no HTML is ever interpreted; everything is React text). The rules live in
 * chatFormat.ts (shared word for word with the backend's push notifications):
 *
 *   **bold** or __bold__   *italic* or _italic_   ***bold italic***   ~~strike~~   `code`   ```code block```
 *   ||spoiler||   > quote      - bullet / * bullet / • bullet      1. numbered
 *
 * Links, @mentions and search matches inside the text still work (format.tsx linkify). "@highlight" and "/me" are
 * read by chatMarks (MessageRow shows them). A message that is only a GIF link is shown as the moving picture.
 */
export { chatMarks, gifUrl, hasFormatting, plainText } from "./chatFormat";

interface Ctx {
  highlight?: string;
  mentions?: RegExp | null;
  urls: string[];
}

function leaf(text: string, ctx: Ctx, key: string): ReactNode[] {
  if (!text) return [];
  return linkify(restoreUrls(text, ctx.urls), ctx.highlight, ctx.mentions).map((node, i) =>
    typeof node === "string" ? node : <span key={`${key}-${i}`}>{node}</span>,
  );
}

function inline(nodes: InlineNode[], ctx: Ctx, key: string): ReactNode[] {
  return nodes.flatMap((n, i): ReactNode[] => {
    const k = `${key}-${i}`;
    if (typeof n === "string") return leaf(n, ctx, k);
    if (n.kind === "code")
      return [
        <code key={k} className="mx-md-code">
          {restoreUrls(n.text, ctx.urls)}
        </code>,
      ];
    const inside = inline(n.children, ctx, k);
    if (n.kind === "spoiler") return [<Spoiler key={k}>{inside}</Spoiler>];
    if (n.kind === "bold") return [<strong key={k}>{inside}</strong>];
    if (n.kind === "bolditalic")
      return [
        <strong key={k}>
          <em>{inside}</em>
        </strong>,
      ];
    if (n.kind === "strike") return [<s key={k}>{inside}</s>];
    return [<em key={k}>{inside}</em>];
  });
}

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={`mx-spoiler${shown ? " is-shown" : ""}`}
      role={shown ? undefined : "button"}
      tabIndex={shown ? undefined : 0}
      aria-label={shown ? undefined : "Spoiler: tap to show"}
      onClick={(e) => {
        if (shown) return;
        e.stopPropagation();
        setShown(true);
      }}
      onKeyDown={(e) => {
        if (!shown && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setShown(true);
        }
      }}
    >
      <span aria-hidden={!shown}>{children}</span>
    </span>
  );
}

/**
 * A message body as formatted React nodes. Lines keep their breaks (the bubble uses pre-wrap); quotes, lists and
 * code blocks become their own blocks. `options.highlight` marks search matches; `options.mentions` shows @Names.
 */
export function renderChat(body: string, options: { highlight?: string; mentions?: RegExp | null } = {}): ReactNode {
  const urls: string[] = [];
  const held = holdUrls(body, urls);
  const ctx: Ctx = { ...options, urls };
  const list = parseBlocks(held);
  // Never a blank bubble: if the formatting would leave nothing to read, show what was typed.
  if (!blocksPlain(list).trim()) return leaf(held, ctx, "raw");
  // Plain text only (the usual case): no wrappers at all.
  if (list.length === 1 && list[0].type === "text") return inline(parseInline(list[0].lines.join("\n")), ctx, "t");
  return list.map((b, i) => {
    const key = `b${i}`;
    // Text between blocks drops the blank line that separated it from them (blocks have their own spacing).
    if (b.type === "text") {
      const lines = [...b.lines];
      if (i > 0 && lines[0] === "") lines.shift();
      if (i < list.length - 1 && lines[lines.length - 1] === "") lines.pop();
      if (!lines.length) return null;
      return (
        <span key={key} className="mx-md-p">
          {inline(parseInline(lines.join("\n")), ctx, key)}
        </span>
      );
    }
    if (b.type === "code")
      return (
        <pre key={key} className="mx-md-pre">
          <code>{restoreUrls(b.text, urls)}</code>
        </pre>
      );
    if (b.type === "quote")
      return (
        <blockquote key={key} className="mx-md-quote">
          {inline(parseInline(b.lines.join("\n")), ctx, key)}
        </blockquote>
      );
    const items = b.items.map((item, n) => <li key={n}>{inline(parseInline(item), ctx, `${key}-${n}`)}</li>);
    return b.ordered ? (
      <ol key={key} className="mx-md-list" start={b.start}>
        {items}
      </ol>
    ) : (
      <ul key={key} className="mx-md-list">
        {items}
      </ul>
    );
  });
}
