import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Safe formatter for Update posts. It understands a small Markdown subset:
 * headings (#, ##, ###), paragraphs, "- " / "1. " lists, "> " quotes, "---" rules,
 * simple | tables |, **bold**, *italic*, `code` and [links](https://…).
 * Everything becomes React elements, never raw HTML, and only http(s) or site links work.
 */

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(href: string): { internal?: string; external?: string } | null {
  if (/^\/(?!\/)/.test(href)) return { internal: href };
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.origin === window.location.origin) return { internal: url.pathname + url.search + url.hash };
    return { external: url.href };
  } catch {
    return null;
  }
}

export function inline(text: string, keyBase = "i"): ReactNode[] {
  const parts = text.split(inlinePattern).filter((part) => part !== "");
  return parts.map((part, index) => {
    const key = `${keyBase}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={key}>{inline(part.slice(2, -2), key)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
      return href.internal ? (
        <Link key={key} to={href.internal}>
          {link[1]}
        </Link>
      ) : (
        <a key={key} href={href.external} target="_blank" rel="noopener noreferrer nofollow">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

export default function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], key);
      blocks.push(
        level === 1 ? <h2 key={key}>{content}</h2> : level === 2 ? <h3 key={key}>{content}</h3> : <h4 key={key}>{content}</h4>,
      );
      i++;
      continue;
    }
    if (/^\s*(-{3,}|={3,}[>]*|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key} />);
      i++;
      continue;
    }
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div className="rt-table" key={key}>
          <table>
            {head && (
              <thead>
                <tr>
                  {head.map((cell, c) => (
                    <th key={c}>{inline(cell, `${key}h${c}`)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inline(cell, `${key}r${r}c${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const pattern = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i].replace(pattern, ""));
        i++;
      }
      const list = items.map((item, n) => <li key={n}>{inline(item, `${key}l${n}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{list}</ol> : <ul key={key}>{list}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(<blockquote key={key}>{inline(quote.join(" "), key)}</blockquote>);
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !isTableRow(lines[i]) &&
      !bullet.test(lines[i]) &&
      !numbered.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*(-{3,}|={3,}[>]*|\*{3,})\s*$/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key}>
        {paragraph.map((part, n) => (
          <Fragment key={n}>
            {n > 0 && <br />}
            {inline(part, `${key}p${n}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="rt">{blocks}</div>;
}
