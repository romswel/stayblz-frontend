import { useState, type ReactNode } from "react";
import { linkify } from "./format";

/**
 * Chat formatting: a small, safe Markdown subset (no HTML is ever interpreted; everything is React text).
 *
 *   **bold** or __bold__   *italic* or _italic_   ~~strike~~   `code`   ```code block```   ||spoiler||
 *   > quote      - bullet / * bullet / • bullet      1. numbered
 *
 * Links, @mentions and search matches inside the text still work (format.tsx linkify). Underscores inside words
 * (snake_case) and inside links are left alone. Two message-level marks are read here too:
 *   "@highlight" anywhere → the message is shown highlighted for everyone (it is not a mention; no alerts)
 *   "/me waves"           → shown as an action line: "Ann waves"
 * A message that is only a GIF link (GIPHY / Tenor) is shown as the moving picture (gifUrl).
 */

const URLS = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
const HOLD = /\u0001(\d+)\u0002/g;

/** Message-level marks: highlighted? an action line? and the text left to show. */
export function chatMarks(body: string) {
  let text = body;
  const highlight = /(^|\s)@highlight\b/i.test(text);
  if (highlight) text = text.replace(/(^|\s)@highlight\b[ \t]*/gi, "$1").replace(/^\s+/, "");
  const me = /^\/me\s+\S/i.test(text);
  if (me) text = text.replace(/^\/me\s+/i, "");
  return { highlight, me, text };
}

/** The GIF picture for a message that is only a GIF link, or null. GIPHY page links become their media link. */
export function gifUrl(body: string): string | null {
  const t = body.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^https:\/\/(?:media\d?\.giphy\.com|i\.giphy\.com)\/[\w./?=&%-]+$/i.test(t)) return t;
  // Only hosts the site's Content-Security-Policy allows (vercel.json img-src).
  if (/^https:\/\/media\.tenor\.com\/[\w./-]+\.(?:gif|webp)$/i.test(t)) return t;
  const page = /^https:\/\/giphy\.com\/gifs\/(?:[\w-]+-)?([A-Za-z0-9]{6,40})\/?$/i.exec(t);
  return page ? `https://media.giphy.com/media/${page[1]}/giphy.gif` : null;
}

/** The message as plain words (chat list, alerts): formatting marks dropped, spoilers kept hidden. */
export function plainText(body: string): string {
  if (gifUrl(body)) return "GIF";
  const { text } = chatMarks(body);
  return text
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1")
    .replace(/\|\|[\s\S]+?\|\|/g, "(spoiler)")
    .replace(/^[ \t]{0,3}(?:>[ \t]?|[-*•][ \t]+|\d{1,3}[.)][ \t]+)/gm, "")
    .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](?=\S)([^*_\n]*?\S)[*_](?![\w*])/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .trim();
}

interface Ctx {
  highlight?: string;
  mentions?: RegExp | null;
  urls: string[];
}

/**
 * Inline marks, earliest match wins (ties: in this order). Group 1 = the character before the mark (kept as text),
 * group 2 = what's inside. No lookbehind (`(?<!…)`): iPhones before iOS 16.4 can't even load a script that has one.
 */
const INLINE: { kind: "code" | "spoiler" | "bold" | "strike" | "italic"; re: RegExp }[] = [
  { kind: "code", re: /()`([^`\n]+)`/ },
  { kind: "spoiler", re: /()\|\|(?=\S)([\s\S]*?\S)\|\|/ },
  { kind: "bold", re: /()\*\*(?=\S)([\s\S]*?\S)\*\*/ },
  { kind: "bold", re: /(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/ },
  { kind: "strike", re: /()~~(?=\S)([\s\S]*?\S)~~/ },
  { kind: "italic", re: /(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/ },
  { kind: "italic", re: /(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/ },
];

const restore = (s: string, ctx: Ctx) => s.replace(HOLD, (_, i) => ctx.urls[Number(i)] ?? "");

function leaf(text: string, ctx: Ctx, key: string): ReactNode[] {
  if (!text) return [];
  return linkify(restore(text, ctx), ctx.highlight, ctx.mentions).map((node, i) =>
    typeof node === "string" ? node : <span key={`${key}-${i}`}>{node}</span>,
  );
}

function inline(text: string, ctx: Ctx, key: string, depth = 0): ReactNode[] {
  if (depth > 6) return leaf(text, ctx, key);
  let best: { kind: (typeof INLINE)[number]["kind"]; index: number; length: number; inner: string } | null = null;
  for (const rule of INLINE) {
    const found = rule.re.exec(text);
    if (!found) continue;
    const index = found.index + found[1].length;
    if (best === null || index < best.index) best = { kind: rule.kind, index, length: found[0].length - found[1].length, inner: found[2] };
  }
  if (!best) return leaf(text, ctx, key);
  const out: ReactNode[] = [...leaf(text.slice(0, best.index), ctx, `${key}a`)];
  const k = `${key}-${best.index}`;
  const inner = () => inline(best!.inner, ctx, `${k}i`, depth + 1);
  if (best.kind === "code") out.push(<code key={k} className="mx-md-code">{restore(best.inner, ctx)}</code>);
  else if (best.kind === "spoiler") out.push(<Spoiler key={k}>{inner()}</Spoiler>);
  else if (best.kind === "bold") out.push(<strong key={k}>{inner()}</strong>);
  else if (best.kind === "strike") out.push(<s key={k}>{inner()}</s>);
  else out.push(<em key={k}>{inner()}</em>);
  out.push(...inline(text.slice(best.index + best.length), ctx, `${key}b`, depth));
  return out;
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

type Block =
  | { type: "text"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "list"; ordered: boolean; start: number; items: string[] };

const BULLET = /^[ \t]{0,3}[-*•][ \t]+(.*)$/;
const NUMBER = /^[ \t]{0,3}(\d{1,3})[.)][ \t]+(.*)$/;
const QUOTE = /^[ \t]{0,3}>[ \t]?(.*)$/;

function blocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  const push = (b: Block) => out.push(b);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^[ \t]*```([\w+-]*)[ \t]*(.*)$/.exec(line);
    if (fence) {
      // ```code``` on one line, or a fenced block up to the closing ``` (or the end).
      const sameLine = /^[ \t]*```([\s\S]*?)```[ \t]*$/.exec(line);
      if (sameLine && line.trim().length > 6) {
        push({ type: "code", text: sameLine[1] });
        continue;
      }
      const body: string[] = fence[2] ? [fence[2]] : [];
      let j = i + 1;
      while (j < lines.length && !/^[ \t]*```[ \t]*$/.test(lines[j])) body.push(lines[j++]);
      push({ type: "code", text: body.join("\n") });
      i = j;
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      const last = out[out.length - 1];
      if (last?.type === "quote") last.lines.push(quote[1]);
      else push({ type: "quote", lines: [quote[1]] });
      continue;
    }
    const bullet = BULLET.exec(line);
    const number = bullet ? null : NUMBER.exec(line);
    if (bullet || number) {
      const ordered = !!number;
      const item = bullet ? bullet[1] : number![2];
      const last = out[out.length - 1];
      if (last?.type === "list" && last.ordered === ordered) last.items.push(item);
      else push({ type: "list", ordered, start: number ? Number(number[1]) : 1, items: [item] });
      continue;
    }
    const last = out[out.length - 1];
    if (last?.type === "text") last.lines.push(line);
    else push({ type: "text", lines: [line] });
  }
  return out;
}

/**
 * A message body as formatted React nodes. Lines keep their breaks (the bubble uses pre-wrap); quotes, lists and
 * code blocks become their own blocks. `options.highlight` marks search matches; `options.mentions` shows @Names.
 */
export function renderChat(body: string, options: { highlight?: string; mentions?: RegExp | null } = {}): ReactNode {
  const urls: string[] = [];
  const held = body.replace(URLS, (url) => `\u0001${urls.push(url) - 1}\u0002`);
  const ctx: Ctx = { ...options, urls };
  const list = blocks(held);
  // Plain text only (the usual case): no wrappers at all.
  if (list.length === 1 && list[0].type === "text") return inline(list[0].lines.join("\n"), ctx, "t");
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
          {inline(lines.join("\n"), ctx, key)}
        </span>
      );
    }
    if (b.type === "code")
      return (
        <pre key={key} className="mx-md-pre">
          <code>{restore(b.text, ctx)}</code>
        </pre>
      );
    if (b.type === "quote")
      return (
        <blockquote key={key} className="mx-md-quote">
          {inline(b.lines.join("\n"), ctx, key)}
        </blockquote>
      );
    const items = b.items.map((item, n) => <li key={n}>{inline(item, ctx, `${key}-${n}`)}</li>);
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
