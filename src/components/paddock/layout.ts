import type { CallView, Person } from "./engine/call";

export type LayoutMode = "auto" | "grid" | "spotlight" | "sidebar";
export const LAYOUTS: { value: LayoutMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Picks the best view for who's here and what's shared" },
  { value: "grid", label: "Grid", hint: "Everyone the same size" },
  { value: "spotlight", label: "Spotlight", hint: "Only the person talking (or pinned)" },
  { value: "sidebar", label: "Sidebar", hint: "One large, everyone else beside it" },
];

export interface TileItem {
  key: string;
  person: Person;
  kind: "cam" | "screen";
}
export type Arrangement =
  | { kind: "solo"; main: TileItem }
  | { kind: "duo"; main: TileItem; float: TileItem }
  | { kind: "grid"; tiles: TileItem[] }
  | { kind: "focus"; main: TileItem; rest: TileItem[]; float?: TileItem };

const camTile = (person: Person): TileItem => ({ key: person.id, person, kind: "cam" });

export function arrange(view: CallView, mode: LayoutMode, pinned: string | null): Arrangement {
  const people = view.people;
  const cams = people.map(camTile);
  const screens: TileItem[] = people.filter((p) => p.state.screen).map((p) => ({ key: `${p.id}:screen`, person: p, kind: "screen" }));
  const all = [...screens, ...cams];
  const me = cams.find((t) => t.person.me)!;
  const others = cams.filter((t) => !t.person.me);
  const pin = pinned ? all.find((t) => t.key === pinned) : undefined;
  const speaking = view.activeSpeaker ? cams.find((t) => t.key === view.activeSpeaker) : undefined;
  // Someone else's screen first; your own is shown as "You're presenting".
  const screen = screens.find((t) => !t.person.me) ?? screens[0];

  if (people.length === 1 && !screens.length) return { kind: "solo", main: me };
  if (mode === "spotlight") {
    const main = pin ?? screen ?? speaking ?? others[0] ?? me;
    return main === me ? { kind: "solo", main } : { kind: "focus", main, rest: [], float: me };
  }
  if (pin || screen || mode === "sidebar") {
    const main = pin ?? screen ?? speaking ?? others[0] ?? me;
    if (mode === "grid" && !pin) return { kind: "grid", tiles: all };
    return { kind: "focus", main, rest: all.filter((t) => t !== main) };
  }
  if (mode === "auto" && people.length === 2) return { kind: "duo", main: others[0], float: me };
  return { kind: "grid", tiles: all };
}

/** The tile size that fills the space best for `count` tiles. */
export function fitGrid(count: number, width: number, height: number, gap = 10) {
  if (count <= 0 || width <= 0 || height <= 0) return { cols: 1, w: 0, h: 0 };
  // Phones held upright get taller tiles.
  const aspect = width / height < 0.8 && count > 1 ? 3 / 4 : 16 / 9;
  let best = { cols: 1, w: 0, h: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    let w = (width - gap * (cols - 1)) / cols;
    let h = w / aspect;
    const maxH = (height - gap * (rows - 1)) / rows;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    if (w > best.w) best = { cols, w: Math.floor(w), h: Math.floor(h) };
  }
  return best;
}
