// Pages that exist for signed-in people. When someone signed out opens one, we send
// them to log in instead of showing "not found". Keep in step with the routes in App.tsx.
const prefixes = [
  "/dashboard",
  "/pps",
  "/account",
  "/racing-records",
  "/racing",
  "/admin",
  "/messages",
  "/team-messages",
  "/my-racing",
  "/workspace",
  "/inventory",
  "/tracker",
  "/entries",
  "/results",
  "/workouts",
  "/speed-figures",
  "/statistics",
  "/stakes",
  "/virtual-stable",
  "/stables",
  "/administration",
  "/betting",
  "/marketplace",
  "/tv",
];

export const isAppPath = (pathname: string) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
