/** The Stayblz version shown next to the logo. Bump "version" in package.json for each release. */
export const APP_VERSION = __APP_VERSION__;
/** "v0.10" (patch level hidden when it's 0). */
export const VERSION_LABEL = "v" + APP_VERSION.replace(/\.0$/, "");
export const VERSION_TITLE = `Stayblz ${VERSION_LABEL} · build ${__APP_BUILD__} · development preview`;
