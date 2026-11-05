import type { RacingRecord } from "../landing/useRacingOverview";
export function isHarnessRecord(record: RacingRecord) {
  return record.category?.trim().toLowerCase() === "harness";
}
export function recordsForDiscipline(
  rows: RacingRecord[],
  group: "Harness" | "Thoroughbred",
) {
  // Unclassified records are never presented as harness racing.
  return rows.filter((row) =>
    group === "Harness" ? isHarnessRecord(row) : !isHarnessRecord(row),
  );
}
