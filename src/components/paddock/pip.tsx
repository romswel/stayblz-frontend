import { createRoot, type Root } from "react-dom/client";
import { openInApp } from "../../notifications/systemAlert";
import type { PaddockCall } from "./engine/call";
import { MiniView } from "./MiniCall";

/**
 * Picture-in-picture: the call in a small always-on-top window while you use other apps or tabs.
 * Chrome and Edge get a real window with the call's controls (Document Picture-in-Picture); other
 * browsers float the main video on its own.
 */
type DocPip = { requestWindow: (options: { width: number; height: number }) => Promise<Window>; window: Window | null };
const docPip = () => (window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture;
export const canPip = () => typeof window !== "undefined" && (!!docPip() || !!document.pictureInPictureEnabled);

let pipWindow: Window | null = null;
let root: Root | null = null;

export async function openPip(call: PaddockCall): Promise<boolean> {
  const api = docPip();
  if (api) {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.focus();
      return true;
    }
    try {
      const win = await api.requestWindow({ width: 380, height: 260 });
      // Same styles and theme as the page.
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => win.document.head.appendChild(node.cloneNode(true)));
      win.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "light";
      win.document.title = "Stayblz Paddock";
      win.document.body.className = "pd-pip-body";
      const host = win.document.createElement("div");
      host.className = "gx-layer pd-pip-root";
      win.document.body.appendChild(host);
      root = createRoot(host);
      root.render(
        <MiniView
          call={call}
          inPip
          onReturn={() => {
            window.focus();
            openInApp(`/paddock/${call.code}`);
            win.close();
          }}
        />,
      );
      pipWindow = win;
      win.addEventListener("pagehide", () => {
        root?.unmount();
        root = null;
        pipWindow = null;
      });
      return true;
    } catch {
      /* Fall back to the video. */
    }
  }
  const videos = [...document.querySelectorAll<HTMLVideoElement>(".pd-room video, .pd-mini video")].filter((v) => v.videoWidth > 0);
  const others = videos.filter((v) => !v.closest(".is-me"));
  const video = (others.length ? others : videos).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!video?.requestPictureInPicture) return false;
  try {
    await video.requestPictureInPicture();
    return true;
  } catch {
    return false;
  }
}

export function closePip() {
  if (pipWindow && !pipWindow.closed) pipWindow.close();
  if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
}
