/**
 * A system notification from anywhere (no React needed): through the service worker when there is one, else
 * from the page. Tapping it brings Stayblz forward on `url` (the service worker posts "stayblz:open", the page
 * fallback fires the same event; NotificationsContext navigates). Quietly does nothing without permission.
 */
export interface SystemAlert {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Stays until answered (incoming calls). */
  sticky?: boolean;
  silent?: boolean;
}

export const openInApp = (url: string) => window.dispatchEvent(new CustomEvent("stayblz:open", { detail: url }));

export async function systemAlert(alert: SystemAlert): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return false;
  const options = {
    body: alert.body,
    tag: alert.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: alert.url },
    renotify: true,
    requireInteraction: !!alert.sticky,
    silent: !!alert.silent,
  } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(alert.title, options);
      return true;
    }
  } catch {
    /* Fall back to a page notification. */
  }
  try {
    const n = new Notification(alert.title, options);
    n.onclick = () => {
      window.focus();
      openInApp(alert.url);
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Close a sticky one (the call was answered elsewhere, or stopped ringing). */
export async function closeSystemAlert(tag: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const open = (await reg?.getNotifications?.({ tag })) ?? [];
    open.forEach((n) => n.close());
  } catch {
    /* Nothing to close. */
  }
}
