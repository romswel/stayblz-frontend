import type { CallView, Person } from "./engine/call";

export type LayoutMode = "auto" | "grid" | "spotlight" | "sidebar";
export const LAYOUTS: { value: LayoutMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Picks the best view for who's here and what's shared" },
  { value: "grid", label: "Tiled", hint: "Everyone the same size" },
  { value: "spotlight", label: "Spotlight", hint: "Only the person talking, presenting or pinned" },
  { value: "sidebar", label: "Sidebar", hint: "One large, everyone else beside it" },
];

/** How you like to see the call (kept on this device). */
export interface ViewPrefs {
  mode: LayoutMode;
  /** Leave out people whose camera is off (they still show in People). */
  hideNoVideo: boolean;
  /** Hide your own tile (others still see you). */
  hideSelf: boolean;
}
const PREFS_KEY = "stayblz.paddock.view";
export function readPrefs(): ViewPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") ?? {};
    const old = localStorage.getItem("stayblz.paddock.layout");
    const mode = raw.mode ?? old;
    return {
      mode: mode === "grid" || mode === "spotlight" || mode === "sidebar" ? mode : "auto",
      hideNoVideo: raw.hideNoVideo === true,
      hideSelf: raw.hideSelf === true,
    };
  } catch {
    return { mode: "auto", hideNoVideo: false, hideSelf: false };
  }
}
export function savePrefs(prefs: ViewPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* A convenience. */
  }
}

export interface TileItem {
  key: string;
  person: Person;
  kind: "cam" | "screen";
}
export type Arrangement =
  | { kind: "solo"; main: TileItem }
  | { kind: "duo"; main: TileItem; float: TileItem | null }
  | { kind: "grid"; tiles: TileItem[] }
  | { kind: "focus"; main: TileItem; rest: TileItem[]; float?: TileItem | null };

const camTile = (person: Person): TileItem => ({ key: person.id, person, kind: "cam" });

/**
 * Who goes where. Your own pin wins, then a host's spotlight, then someone presenting, then whoever
 * is talking. Your own screen shows as "You're presenting" (never a mirror of itself).
 */
export function arrange(view: CallView, prefs: ViewPrefs, pinned: string | null): Arrangement {
  const { mode } = prefs;
  const people = view.people;
  const cams = people.map(camTile);
  const screens: TileItem[] = people.filter((p) => p.state.screen).map((p) => ({ key: `${p.id}:screen`, person: p, kind: "screen" }));
  const me = cams.find((t) => t.person.me)!;
  const visible = (t: TileItem) => (!prefs.hideSelf || !t.person.me) && (!prefs.hideNoVideo || t.person.me || !!t.person.cam || t.person.speaking);
  const others = cams.filter((t) => !t.person.me);
  const all = [...screens, ...cams];
  const pin = pinned ? all.find((t) => t.key === pinned) : undefined;
  const spot = view.spotlight ? cams.find((t) => t.key === view.spotlight) : undefined;
  const speaking = view.activeSpeaker ? cams.find((t) => t.key === view.activeSpeaker) : undefined;
  const screen = screens.find((t) => !t.person.me) ?? screens[0];
  const selfFloat = prefs.hideSelf ? null : me;

  if (people.length === 1 && !screens.length) return { kind: "solo", main: me };
  const chosen = pin ?? spot;
  if (mode === "spotlight") {
    const main = chosen ?? screen ?? speaking ?? others[0] ?? me;
    return main === me ? { kind: "solo", main } : { kind: "focus", main, rest: [], float: selfFloat };
  }
  if (chosen || screen || mode === "sidebar") {
    const main = chosen ?? screen ?? speaking ?? others[0] ?? me;
    if (mode === "grid" && !chosen) return { kind: "grid", tiles: all.filter((t) => t.kind === "screen" || visible(t)) };
    return { kind: "focus", main, rest: all.filter((t) => t !== main && (t.kind === "screen" || visible(t))) };
  }
  if (mode === "auto" && people.length === 2) return { kind: "duo", main: others[0], float: selfFloat };
  const tiles = all.filter((t) => t.kind === "screen" || visible(t));
  return { kind: "grid", tiles: tiles.length ? tiles : [others[0] ?? me] };
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
