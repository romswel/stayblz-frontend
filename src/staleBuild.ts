// After a new release, a tab opened earlier still asks for the old page files, which no longer exist, so a lazy page
// fails to load ("Failed to fetch dynamically imported module"). Reload once to pick up the new version instead of
// showing an error; the reload is skipped when offline, or when we already reloaded a moment ago (no loops).

const KEY = "stayblz.reloadedForUpdate";

export function isStaleBuildError(error: unknown): boolean {
  const text = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError/i.test(
    text,
  );
}

/** Reloads the page and returns true, unless offline or it already reloaded in the last 30 seconds. */
export function reloadForUpdate(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite reports a failed page-file load here first. */
export function watchStaleBuild() {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForUpdate()) event.preventDefault();
  });
}
