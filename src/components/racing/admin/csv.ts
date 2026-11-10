// Reads a race-card CSV (or tab-separated text pasted from a spreadsheet) into import rows.
// One row per runner. Header names are matched loosely, so "Race #", "race" and "Race number" all work.

export const IMPORT_COLUMNS = [
  "race", "postTime", "raceName", "raceType", "grade", "distance", "unit", "surface", "purse", "conditions",
  "program", "post", "horse", "country", "sire", "dam", "sex", "foaled", "jockey", "trainer", "owner",
  "weight", "ml", "medication", "equipment",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const aliases: Record<string, ImportColumn> = {
  race: "race", racenumber: "race", raceno: "race", r: "race",
  posttime: "postTime", post_time: "postTime", time: "postTime",
  racename: "raceName", name: "raceName",
  racetype: "raceType", type: "raceType",
  grade: "grade",
  distance: "distance", dist: "distance",
  unit: "unit", distanceunit: "unit",
  surface: "surface",
  purse: "purse",
  conditions: "conditions",
  program: "program", programnumber: "program", pgm: "program", number: "program", saddlecloth: "program",
  post: "post", postposition: "post", pp: "post",
  horse: "horse", horsename: "horse",
  country: "country", horsecountry: "country",
  sire: "sire", dam: "dam", sex: "sex",
  foaled: "foaled", yearfoaled: "foaled", foaledyear: "foaled",
  jockey: "jockey", driver: "jockey", rider: "jockey",
  trainer: "trainer", owner: "owner",
  weight: "weight", wgt: "weight",
  ml: "ml", morningline: "ml", mlodds: "ml",
  medication: "medication", med: "medication",
  equipment: "equipment", equip: "equipment",
};
const normalise = (header: string) => header.toLowerCase().replace(/[^a-z_]/g, "");

/** RFC 4180-style parsing: quoted fields, doubled quotes, commas/newlines inside quotes. */
export function parseDelimited(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export function toImportRows(text: string): { rows: Partial<Record<ImportColumn, string>>[]; error?: string; ignored: string[] } {
  const table = parseDelimited(text);
  if (table.length < 2) return { rows: [], ignored: [], error: "Add a header row and at least one runner." };
  const header = table[0].map((cell) => aliases[normalise(cell)]);
  const ignored = table[0].filter((_, i) => !header[i]).map((cell) => cell.trim()).filter(Boolean);
  for (const needed of ["race", "program", "horse"] as const)
    if (!header.includes(needed)) return { rows: [], ignored, error: `The header needs a "${needed}" column.` };
  const rows = table.slice(1).map((cells) => {
    const row: Partial<Record<ImportColumn, string>> = {};
    header.forEach((key, i) => {
      const value = (cells[i] ?? "").trim();
      if (key && value) row[key] = value;
    });
    return row;
  });
  return { rows, ignored };
}

export const TEMPLATE_HEADER =
  "race,postTime,raceName,raceType,grade,distance,unit,surface,purse,program,post,horse,country,sire,dam,sex,foaled,jockey,trainer,owner,weight,ml,medication,equipment";
