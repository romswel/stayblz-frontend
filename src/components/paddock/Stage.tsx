import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MAX_PEOPLE } from "./brand";
import CornerFloat from "./CornerFloat";
import type { CallView, PaddockCall } from "./engine/call";
import { CopyLink } from "./InfoTab";
import { arrange, fitGrid, type LayoutMode, type TileItem } from "./layout";
import Tile from "./Tile";

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

const GAP = 10;
const SelfFloat = ({ children }: { children: ReactNode }) => (
  <CornerFloat storageKey="stayblz.paddock.selfCorner" scope="parent" className="pd-float">
    {children}
  </CornerFloat>
);

export default function Stage({
  view,
  call,
  mode,
  pinned,
  onPin,
}: {
  view: CallView;
  call: PaddockCall;
  mode: LayoutMode;
  pinned: string | null;
  onPin: (key: string | null) => void;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  // A pin on someone who left is dropped.
  const validPin = pinned && view.people.some((p) => pinned === p.id || (pinned === `${p.id}:screen` && p.state.screen)) ? pinned : null;
  const layout = arrange(view, mode, validPin);
  const tile = (item: TileItem, tileSize: "grid" | "main" | "strip" | "float" | "solo") => (
    <Tile key={item.key} item={item} view={view} call={call} size={tileSize} pinned={validPin} onPin={onPin} />
  );

  let body: ReactNode;
  if (layout.kind === "solo") {
    body = (
      <div className="pd-solo">
        {tile(layout.main, "solo")}
        {view.people.length === 1 && (
          <div className="pd-alone">
            <strong>You're the only one here</strong>
            <p>Share this link to bring up to {MAX_PEOPLE - 1} more people in.</p>
            <CopyLink code={view.code} label="Copy meeting link" />
          </div>
        )}
      </div>
    );
  } else if (layout.kind === "duo") {
    body = (
      <>
        <div className="pd-duo">{tile(layout.main, "main")}</div>
        <SelfFloat>{tile(layout.float, "float")}</SelfFloat>
      </>
    );
  } else if (layout.kind === "grid") {
    const fit = fitGrid(layout.tiles.length, size.w, size.h, GAP);
    // Rows wrap at `cols`; a short last row sits in the middle.
    body = (
      <div className="pd-grid">
        <div
          className="pd-grid-inner"
          style={{ width: fit.cols * fit.w + (fit.cols - 1) * GAP + 1, ["--tile-w" as string]: `${fit.w}px`, ["--tile-h" as string]: `${fit.h}px` }}
        >
          {layout.tiles.map((t) => tile(t, "grid"))}
        </div>
      </div>
    );
  } else {
    const side = size.w >= 900 && size.w / Math.max(1, size.h) > 1.2;
    body = (
      <div className={`pd-focus${side ? " is-side" : " is-bottom"}`}>
        <div className="pd-focus-main">{tile(layout.main, "main")}</div>
        {layout.rest.length > 0 && (
          <div className="pd-strip" aria-label="Everyone else" role="group">
            {layout.rest.map((t) => tile(t, "strip"))}
          </div>
        )}
        {layout.float && <SelfFloat>{tile(layout.float, "float")}</SelfFloat>}
      </div>
    );
  }
  return (
    <div ref={ref} className="pd-stage">
      {body}
    </div>
  );
}
