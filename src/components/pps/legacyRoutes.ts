// Old bookmarks redirect to the new designs; this does not imply product equivalence.
export const oldPPIds: Record<string, string> = {
  premium: "detailed-racecard",
  basic: "racecard",
  "daily-racing-form": "race-day-summary",
  platinum: "form-comparison",
  lifetime: "horse-history",
  harness: "harness-racecard",
  "harness-platinum": "harness-form",
  "harness-pro": "harness-workspace",
};
export function canonicalPPPath(pathname: string) {
  const parts = pathname.split("/");
  if (parts[1] !== "pps" || !Object.hasOwn(oldPPIds, parts[2])) return pathname;
  parts[2] = oldPPIds[parts[2]];
  if (parts[3] === "free-race") parts[3] = "sample";
  if (parts[2] === "harness-workspace" && parts[3] === "sample")
    parts.splice(3);
  return parts.join("/");
}
