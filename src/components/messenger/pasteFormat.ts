/**
 * Pasting formatted text from another website, Word or Google Docs: the copied HTML becomes Stayblz Chat's own
 * formatting (chatMarkdown.tsx) — bold, italic, strike, code, quotes, lists, links — with paragraph breaks kept.
 * The HTML is only read (DOMParser never runs scripts or loads images); nothing of it is inserted as HTML.
 * When the copy has no formatting worth keeping, the browser's plain text is used as it is.
 */

const SKIP = new Set(["SCRIPT", "STYLE", "HEAD", "META", "TITLE", "LINK", "NOSCRIPT", "TEMPLATE", "SVG", "IFRAME", "OBJECT", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
const PARAGRAPH = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "BLOCKQUOTE", "PRE", "TABLE", "FIGURE", "HR"]);
const LINE = new Set(["DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "ASIDE", "NAV", "LI", "TR", "DT", "DD", "FIGCAPTION", "ADDRESS"]);

function styleOf(el: Element) {
  const s = (el as HTMLElement).style;
  const weight = s?.fontWeight ?? "";
  return {
    bold: weight === "bold" || weight === "bolder" || (/^\d+$/.test(weight) && Number(weight) >= 600),
    notBold: weight === "normal" || weight === "lighter" || (/^\d+$/.test(weight) && Number(weight) < 600),
    italic: s?.fontStyle === "italic",
    strike: /line-through/.test(s?.textDecoration ?? "") || /line-through/.test(s?.textDecorationLine ?? ""),
    pre: /^pre/.test(s?.whiteSpace ?? ""),
  };
}

/** Wraps text in a mark, keeping spaces outside it ("**bold** " not "**bold **"), and skipping empty runs. */
function wrap(mark: string, text: string) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (!m[2]) return text;
  // Marks can't span paragraphs in chat formatting: wrap each line on its own.
  const inner = m[2]
    .split("\n")
    .map((line) => (line.trim() ? line.replace(/^(\s*)(.*?)(\s*)$/, `$1${mark}$2${mark}$3`) : line))
    .join("\n");
  return m[1] + inner + m[3];
}

interface State {
  pre: boolean;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  list: { ordered: boolean; n: number; depth: number } | null;
}

function walk(node: Node, state: State): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/ /g, " ");
    return state.pre ? text : text.replace(/[ \t\r\n\f]+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (SKIP.has(tag)) return "";
  if (tag === "BR") return "\n";
  if (tag === "HR") return "\n\n";
  if (tag === "IMG") return "";
  const css = styleOf(el);
  const pre = state.pre || tag === "PRE" || css.pre;
  const next: State = { ...state, pre };

  // Lists: each item on its own line with "- " or "1. " (nested lists indent).
  if (tag === "UL" || tag === "OL") {
    const depth = state.list ? state.list.depth + 1 : 0;
    const start = Number(el.getAttribute("start")) || 1;
    let n = start - 1;
    const items = Array.from(el.children)
      .filter((c) => c.tagName.toUpperCase() === "LI")
      .map((li) => {
        n++;
        const inner = walk(li, { ...next, list: { ordered: tag === "OL", n, depth } }).trim();
        return inner ? `${"  ".repeat(depth)}${tag === "OL" ? `${n}.` : "-"} ${inner.replace(/\n+/g, "\n" + "  ".repeat(depth + 1))}` : "";
      })
      .filter(Boolean);
    return `\n\n${items.join("\n")}\n\n`;
  }

  const bold = !state.bold && ((tag === "B" || tag === "STRONG") ? !css.notBold : css.bold || /^H[1-6]$/.test(tag));
  const italic = !state.italic && (tag === "I" || tag === "EM" || tag === "CITE" || css.italic);
  const strike = !state.strike && (tag === "S" || tag === "STRIKE" || tag === "DEL" || css.strike);
  const inner = Array.from(el.childNodes)
    .map((c) =>
      walk(c, {
        ...next,
        bold: state.bold || bold,
        italic: state.italic || italic,
        strike: state.strike || strike,
        list: tag === "LI" ? state.list : state.list && LINE.has(tag) ? state.list : state.list,
      }),
    )
    .join("");

  if (tag === "PRE") return `\n\n\`\`\`\n${inner.replace(/^\n+|\n+$/g, "")}\n\`\`\`\n\n`;
  if (tag === "CODE" && !state.pre) return inner.trim() ? `\`${inner.replace(/`/g, "'")}\`` : inner;
  if (tag === "A") {
    const href = el.getAttribute("href") ?? "";
    const label = inner.trim();
    if (/^https?:\/\//i.test(href)) return !label || label === href || label.replace(/\/$/, "") === href.replace(/\/$/, "") ? href : `${inner} (${href})`;
    return inner;
  }
  if (tag === "BLOCKQUOTE") {
    const text = inner.replace(/^\n+|\n+$/g, "");
    return `\n\n${text.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`;
  }
  if (tag === "TD" || tag === "TH") return `${inner.trim()} | `;
  if (tag === "TR") return `\n${inner.replace(/ \| $/, "")}`;

  let text = inner;
  if (strike) text = wrap("~~", text);
  if (italic) text = wrap("_", text);
  if (bold) text = wrap("**", text);
  if (PARAGRAPH.has(tag)) return `\n\n${text}\n\n`;
  if (LINE.has(tag)) return `\n${text}\n`;
  return text;
}

/** Tidies line breaks: no trailing spaces, at most one blank line in a row, nothing at the ends. */
function tidy(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+(?=[^-\d >\s])/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

// (No lookbehind: older iPhones can't load a script that has one.)
const MARKS = /\*\*|~~|`|^> |^\s*- |^\s*\d+\. |(?:^|[^\w])_(?=\S)/m;

/**
 * What to insert for a paste: chat formatting made from the HTML when it carries any (bold, lists, quotes…),
 * else the plain text (with non-breaking spaces and runs of blank lines cleaned up).
 */
export function pastedText(html: string, plain: string): string {
  const cleanPlain = tidy(plain.replace(/ /g, " ").replace(/\r\n?/g, "\n"));
  if (!html || typeof DOMParser === "undefined") return cleanPlain;
  let converted = "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    converted = tidy(walk(doc.body, { pre: false, bold: false, italic: false, strike: false, list: null }));
  } catch {
    return cleanPlain;
  }
  if (!converted) return cleanPlain;
  // Use the converted text only when it kept some formatting (bold, lists, quotes, code…).
  return MARKS.test(converted) ? converted : cleanPlain || converted;
}
