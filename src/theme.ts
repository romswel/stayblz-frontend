import { useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const KEY = "stayblz.theme";

const listeners = new Set<() => void>();
function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* Theme still works with storage disabled. */
  }
  listeners.forEach((notify) => notify());
}
window.addEventListener("storage", (event) => {
  if (
    event.key === KEY &&
    (event.newValue === "dark" || event.newValue === "light")
  )
    apply(event.newValue);
});
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore<Theme>(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    read,
    () => "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => apply(read() === "dark" ? "light" : "dark")];
}
