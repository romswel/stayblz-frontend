import { isPPDestination } from "./components/pps/catalog";

const destinations = new Set([
  "/dashboard",
  "/account",
  "/entries",
  "/results",
  "/workouts",
  "/speed-figures",
  "/statistics",
  "/stakes",
  "/virtual-stable",
  "/tracker",
  "/stables",
  "/messages",
  "/inventory",
  "/my-racing",
  "/workspace",
  "/workspace/virtual",
  "/team-messages",
  "/paddock",
]);

/** Pages we may send people to after they sign in (never an outside address). */
export const allowedDestination = (value: unknown): value is string =>
  typeof value === "string" &&
  (destinations.has(value) ||
    /^\/updates(\/[a-z0-9-]{1,80})?$/.test(value) ||
    /^\/racing\/(days|races|horses|people)\/[0-9a-f-]{36}$/.test(value) ||
    /^\/paddock\/[a-z]{4}-[a-z]{4}$/.test(value) ||
    // Stayblz Stallions: every section, a stallion's page (optionally opening "Ask about a breeding") and its edit form,
    // with the query strings those pages use.
    /^\/stallions(\/(mares|manage(\/(new|[0-9a-f-]{36}))?|requests(\?side=(received|sent))?|mating(\?stallion=[0-9a-f-]{36})?|compare(\?ids=[0-9a-f,-]{36,120})?|[0-9a-f-]{36}(\?ask=1)?))?$/.test(value) ||
    isPPDestination(value));

/** Where a signed-in visitor goes from the home, log in or sign up address. */
export function signedInDestination(state: unknown): string {
  const wanted = (state as { destination?: unknown } | null)?.destination;
  return allowedDestination(wanted) ? wanted : "/dashboard";
}
