/**
 * Stayblz Chat commands: type "/" in the message box to see them. Some change what's sent (/shrug, /me, /spoiler…),
 * some do something in the chat instead of sending (/paddock, /mute, /search…). "//text" sends "/text" as written.
 */
export interface ChatCommand {
  name: string;
  /** What to type after the name, shown as a hint. */
  args?: string;
  help: string;
  /** Group chats only. */
  group?: boolean;
  /** Needs something after the name. */
  needsText?: boolean;
}

export const COMMANDS: ChatCommand[] = [
  { name: "gif", args: "search words", help: "Find a GIF to send" },
  { name: "paddock", help: "Start a Paddock video meeting for this chat" },
  { name: "me", args: "what you're doing", help: "Say it as an action: /me is saddling up", needsText: true },
  { name: "shrug", args: "message", help: "Add ¯\\_(ツ)_/¯" },
  { name: "highlight", args: "message", help: "Make your message stand out for everyone (sends no alerts)", needsText: true },
  { name: "everyone", args: "message", help: "Mention everyone in the group", group: true, needsText: true },
  { name: "spoiler", args: "message", help: "Hide the text until someone taps it", needsText: true },
  { name: "quote", args: "text", help: "Send it as a quote", needsText: true },
  { name: "code", args: "text", help: "Send it as code (keeps spacing)", needsText: true },
  { name: "tableflip", args: "message", help: "Add (╯°□°)╯︵ ┻━┻" },
  { name: "unflip", args: "message", help: "Add ┬─┬ノ( º _ ºノ)" },
  { name: "lenny", args: "message", help: "Add ( ͡° ͜ʖ ͡°)" },
  { name: "search", args: "words", help: "Search this chat" },
  { name: "pins", help: "Show pinned messages" },
  { name: "mute", args: "1h, 8h, 1d, 1w", help: "Mute this chat (until you unmute, or for a while)" },
  { name: "unmute", help: "Turn this chat's alerts back on" },
  { name: "info", help: "Open chat details" },
  { name: "rename", args: "new name", help: "Rename the group", group: true, needsText: true },
  { name: "leave", help: "Leave the group", group: true },
  { name: "help", help: "Show commands, formatting and shortcuts" },
];

export type CommandResult =
  | { kind: "send"; text: string }
  | { kind: "gif"; query: string }
  | { kind: "paddock" }
  | { kind: "search"; query: string }
  | { kind: "pins" }
  | { kind: "mute"; minutes: number | null }
  | { kind: "unmute" }
  | { kind: "info" }
  | { kind: "rename"; title: string }
  | { kind: "leave" }
  | { kind: "help" }
  | { kind: "error"; text: string };

const DURATION = /^(\d{1,3})\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|weeks?)$/i;
/** "45m", "1h", "8 hours", "1d", "1w" → minutes (15 min … 7 days); "" → null (until you unmute). */
export function muteMinutes(text: string): number | null | "bad" {
  const t = text.trim();
  if (!t || /^(forever|always|on)$/i.test(t)) return null;
  const m = DURATION.exec(t);
  if (!m) return "bad";
  const n = Number(m[1]);
  const unit = m[2][0].toLowerCase();
  const minutes = unit === "m" ? n : unit === "h" ? n * 60 : unit === "d" ? n * 1440 : n * 10080;
  return minutes >= 15 && minutes <= 10080 ? minutes : "bad";
}

/** Commands whose name starts with what you typed after "/" (none once you've typed a space). */
export function matchCommands(value: string, group: boolean): ChatCommand[] {
  const m = /^\/([a-z]*)$/i.exec(value);
  if (!m) return [];
  const typed = m[1].toLowerCase();
  return COMMANDS.filter((c) => (group || !c.group) && c.name.startsWith(typed));
}

/** What a typed message means. null = not a command (send as it is). */
export function runCommand(text: string, group: boolean): CommandResult | null {
  if (text.startsWith("//")) return { kind: "send", text: text.slice(1) };
  const m = /^\/([a-z]+)(?:[ \t]+([\s\S]*))?$/i.exec(text);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const rest = (m[2] ?? "").trim();
  const command = COMMANDS.find((c) => c.name === name);
  if (!command) return { kind: "error", text: `There's no /${name} command. Type / to see them all, or start with // to send it as written.` };
  if (command.group && !group) return { kind: "error", text: `/${name} only works in group chats.` };
  if (command.needsText && !rest) return { kind: "error", text: `Write something after /${name}${command.args ? ` (${command.args})` : ""}.` };
  const add = (face: string) => ({ kind: "send" as const, text: rest ? `${rest} ${face}` : face });
  switch (name) {
    case "gif":
      return { kind: "gif", query: rest };
    case "paddock":
      return { kind: "paddock" };
    case "me":
      return { kind: "send", text: `/me ${rest}` };
    case "shrug":
      return add("¯\\_(ツ)_/¯");
    case "tableflip":
      return add("(╯°□°)╯︵ ┻━┻");
    case "unflip":
      return add("┬─┬ノ( º _ ºノ)");
    case "lenny":
      return add("( ͡° ͜ʖ ͡°)");
    case "highlight":
      return { kind: "send", text: `@highlight ${rest}` };
    case "everyone":
      return { kind: "send", text: `@everyone ${rest}` };
    case "spoiler":
      return { kind: "send", text: `||${rest}||` };
    case "quote":
      return { kind: "send", text: rest.split("\n").map((l) => `> ${l}`).join("\n") };
    case "code":
      return { kind: "send", text: rest.includes("\n") ? `\`\`\`\n${rest}\n\`\`\`` : `\`${rest.replace(/`/g, "'")}\`` };
    case "search":
      return { kind: "search", query: rest };
    case "pins":
      return { kind: "pins" };
    case "mute": {
      const minutes = muteMinutes(rest);
      return minutes === "bad" ? { kind: "error", text: "Try /mute, /mute 1h, /mute 8h, /mute 1d or /mute 1w (15 minutes to 7 days)." } : { kind: "mute", minutes };
    }
    case "unmute":
      return { kind: "unmute" };
    case "info":
      return { kind: "info" };
    case "rename":
      return rest.length > 120 ? { kind: "error", text: "Group names can be up to 120 characters." } : { kind: "rename", title: rest };
    case "leave":
      return { kind: "leave" };
    default:
      return { kind: "help" };
  }
}

/** Keyboard shortcuts in the message box (shown in /help). */
export const SHORTCUTS: [string, string][] = [
  ["Enter", "Send (Shift+Enter for a new line)"],
  ["Ctrl/⌘ + B", "Bold"],
  ["Ctrl/⌘ + I", "Italic"],
  ["Ctrl/⌘ + Shift + X", "Strikethrough"],
  ["Ctrl/⌘ + E", "Code"],
  ["↑ (empty box)", "Edit your last message"],
  ["Esc", "Cancel a reply or edit"],
  ["@", "Mention someone, @everyone or @highlight"],
];

/** Formatting you can type (shown in /help). */
export const FORMATTING: [string, string][] = [
  ["**bold**", "bold"],
  ["_italic_", "italic"],
  ["~~strike~~", "strikethrough"],
  ["`code`", "code"],
  ["||spoiler||", "hidden until tapped"],
  ["> quote", "quote"],
  ["- item", "bullet list"],
  ["1. item", "numbered list"],
];
