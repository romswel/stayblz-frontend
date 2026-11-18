import { useState, type ReactNode } from "react";
import Modal from "../components/Modal";
import DialogHead from "../components/ui/DialogHead";
import { useInstall, type InstallPlatform } from "./installState";
import "./install.css";

/* Small pictures of the buttons people have to find. Drawn plainly so they match any browser. */
const glyph = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const ShareGlyph = () => (
  <svg {...glyph}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const AddGlyph = () => (
  <svg {...glyph}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const DotsGlyph = () => (
  <svg {...glyph}>
    <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" />
  </svg>
);
const InstallGlyph = () => (
  <svg {...glyph}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M12 8v5M9.5 10.5 12 13l2.5-2.5M8 21h8" />
  </svg>
);
export const AppGlyph = ({ size = 18 }: { size?: number }) => (
  <svg {...glyph} width={size} height={size}>
    <rect x="6" y="2.5" width="12" height="19" rx="3" />
    <path d="M12 7v6M9.5 10.5 12 13l2.5-2.5M10.5 18.5h3" />
  </svg>
);
const Key = ({ children }: { children: ReactNode }) => <span className="ig-key">{children}</span>;

interface Step {
  text: ReactNode;
}
function stepsFor(platform: InstallPlatform): { steps: Step[]; note?: ReactNode } {
  switch (platform) {
    case "ios-safari":
      return {
        steps: [
          { text: <>Tap the Share button <Key><ShareGlyph /></Key> at the bottom of Safari (top right on iPad).</> },
          { text: <>Scroll down and tap <Key><AddGlyph /> Add to Home Screen</Key>.</> },
          { text: <>Tap <Key>Add</Key>, then open Stayblz from your Home Screen.</> },
        ],
        note: "On iPhone and iPad, notifications only work in the Stayblz app opened from your Home Screen.",
      };
    case "ios-other":
      return {
        steps: [
          { text: <>Tap the Share button <Key><ShareGlyph /></Key> next to the address bar.</> },
          { text: <>Tap <Key><AddGlyph /> Add to Home Screen</Key> (scroll the list if you don't see it).</> },
          { text: <>Tap <Key>Add</Key>, then open Stayblz from your Home Screen.</> },
        ],
        note: "Needs iOS 16.4 or newer. If the option isn't there, open stayblz-app.com in Safari and do the same. Notifications on iPhone only work in the app from your Home Screen.",
      };
    case "android":
      return {
        steps: [
          { text: <>Tap the menu <Key><DotsGlyph /></Key> at the top right of your browser.</> },
          { text: <>Tap <Key>Install app</Key> (some phones say <Key>Add to Home screen</Key>).</> },
          { text: <>Tap <Key>Install</Key>. Stayblz appears with your other apps.</> },
        ],
      };
    case "desktop":
      return {
        steps: [
          { text: <>Click the install icon <Key><InstallGlyph /></Key> at the right end of the address bar.</> },
          {
            text: (
              <>
                No icon? Open the menu <Key><DotsGlyph /></Key> → <Key>Cast, save and share</Key> → <Key>Install page as app</Key> in
                Chrome, or <Key>Apps</Key> → <Key>Install this site as an app</Key> in Edge.
              </>
            ),
          },
          { text: <>Click <Key>Install</Key>. Stayblz opens in its own window; pin it to your taskbar or dock.</> },
        ],
      };
    case "mac-safari":
      return {
        steps: [
          { text: <>In the menu bar choose <Key>File</Key> → <Key>Add to Dock…</Key> (or Share <Key><ShareGlyph /></Key> → <Key>Add to Dock</Key>).</> },
          { text: <>Click <Key>Add</Key>. Stayblz opens from your Dock like any other app.</> },
        ],
        note: "Needs Safari 17 (macOS Sonoma) or newer.",
      };
    case "firefox-desktop":
      return {
        steps: [{ text: <>Firefox on computers can't install websites as apps. Open <strong>stayblz-app.com</strong> in Chrome, Edge or Safari and install it from there.</> }],
      };
    default:
      return {
        steps: [{ text: <>Open your browser's menu and look for <Key>Install app</Key> or <Key>Add to Home Screen</Key>.</> }],
      };
  }
}

/** "Get the Stayblz app": the browser's own install box when it offers one, otherwise directions for this device. */
export default function InstallGuide({ onClose, onNext }: { onClose: () => void; onNext?: () => void }) {
  const { platform, installed, canPrompt, prompt } = useInstall();
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const { steps, note } = stepsFor(platform);
  const showSteps = !canPrompt || declined;
  return (
    <Modal label="Get the Stayblz app" onClose={onClose} className="modal-sm ig-dialog gx-layer">
      <DialogHead kicker="Stayblz app" title={installed ? "Stayblz is installed" : "Get the Stayblz app"} onClose={onClose} />
      <div className="dlg">
        <div className="ig-hero" aria-hidden="true">
          <img src="/icons/icon-192.png" alt="" width="56" height="56" />
        </div>
        {installed ? (
          <p className="dlg-text">
            {platform.startsWith("ios")
              ? "Open Stayblz from your Home Screen from now on. That's where notifications work."
              : "Stayblz now opens in its own window, like any other app on this device."}
          </p>
        ) : (
          <>
            <p className="dlg-text">
              Open Stayblz in one tap from your {platform === "desktop" || platform === "mac-safari" ? "dock or taskbar" : "home screen"}, in its own window,
              {platform.startsWith("ios") ? " and get notifications on your iPhone." : " with notifications like any other app."}
            </p>
            {canPrompt && !declined && (
              <button
                type="button"
                className="btn btn-primary ig-install"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await prompt().catch(() => false);
                  setBusy(false);
                  if (!ok) setDeclined(true);
                }}
              >
                <AppGlyph /> {busy ? "Opening…" : "Install Stayblz"}
              </button>
            )}
            {showSteps && (
              <ol className="ig-steps">
                {steps.map((step, i) => (
                  <li key={i}>
                    <span className="ig-num" aria-hidden="true">{i + 1}</span>
                    <span>{step.text}</span>
                  </li>
                ))}
              </ol>
            )}
            {note && <p className="ig-note">{note}</p>}
          </>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            {installed ? "Close" : "Not now"}
          </button>
          {onNext && (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              Next: notifications
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * The "Get the app" button: hidden once Stayblz runs as an installed app. One click installs where the browser
 * allows it; otherwise it opens the directions.
 */
export function InstallButton({ variant = "chip", label = "Get the app" }: { variant?: "chip" | "icon" | "pill"; label?: string }) {
  const { installed, canPrompt, prompt } = useInstall();
  const [open, setOpen] = useState(false);
  if (installed) return null;
  const click = async () => {
    // The browser's own box answers either way (installed or "not now"); the directions only when it can't open.
    if (canPrompt && (await prompt().then(() => true, () => false))) return;
    setOpen(true);
  };
  return (
    <>
      {variant === "icon" ? (
        <button type="button" className="gx-icon-btn ig-icon" onClick={click} aria-label="Install the Stayblz app" title="Install the Stayblz app">
          <AppGlyph />
        </button>
      ) : (
        <button type="button" className={variant === "pill" ? "gx-pill" : "ig-chip"} onClick={click}>
          <AppGlyph /> {label}
        </button>
      )}
      {open && <InstallGuide onClose={() => setOpen(false)} />}
    </>
  );
}
