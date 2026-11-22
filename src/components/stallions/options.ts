// Stayblz Stallions: choice lists and formatting. Keys match the backend (src/lib/stallionInput.ts,
// src/lib/stallionGenetics.ts).
import type { Pedigree, RaceRecord, StallionCard, StallionProfile } from "./types";

export type Option = { value: string; label: string };

/** Someone else can ask about a breeding to him: published, requests on, not closed. The server checks the same. */
export const takesRequests = (s: Pick<StallionProfile, "mine" | "status" | "inquiriesOpen" | "availability">) =>
  !s.mine && s.status === "published" && s.inquiriesOpen && s.availability !== "closed";

export const BREEDS: Option[] = [
  { value: "thoroughbred", label: "Thoroughbred" },
  { value: "quarter_horse", label: "Quarter Horse" },
  { value: "standardbred", label: "Standardbred" },
  { value: "arabian", label: "Arabian" },
  { value: "paint", label: "Paint" },
  { value: "appaloosa", label: "Appaloosa" },
  { value: "warmblood", label: "Warmblood" },
  { value: "other", label: "Other" },
];
/** Thoroughbred foals are only registered from live cover. */
export const LIVE_COVER_ONLY = new Set(["thoroughbred"]);

export const AVAILABILITY: (Option & { tone: string; hint: string })[] = [
  { value: "open", label: "Taking bookings", tone: "ok", hint: "Breeders can book seasons now." },
  { value: "limited", label: "A few seasons left", tone: "warn", hint: "Most of his book is full." },
  { value: "full", label: "Book full", tone: "muted", hint: "No more seasons this year; breeders can still ask." },
  { value: "private", label: "Approved mares only", tone: "muted", hint: "You choose which mares he covers." },
  { value: "closed", label: "Not standing this season", tone: "muted", hint: "Shown, but no breeding requests." },
];
export const FEE_TERMS: Option[] = [
  { value: "live_foal", label: "Live foal (stands and nurses)" },
  { value: "return_privilege", label: "Return privilege" },
  { value: "no_guarantee", label: "No guarantee" },
  { value: "other", label: "Other terms (see note)" },
];
export const METHODS: Option[] = [
  { value: "live_cover", label: "Live cover" },
  { value: "cooled", label: "Cooled shipped semen" },
  { value: "frozen", label: "Frozen semen" },
];
export const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "JPY", "AED", "ZAR"];
export const SORTS: Option[] = [
  { value: "popular", label: "Most saved" },
  { value: "newest", label: "Newest" },
  { value: "fee-asc", label: "Fee: low to high" },
  { value: "fee-desc", label: "Fee: high to low" },
  { value: "runners", label: "Most runners in our data" },
  { value: "young", label: "Newest to stud" },
  { value: "name", label: "Name A–Z" },
];
export const FEE_STEPS: Option[] = [500, 1000, 2500, 5000, 7500, 10000, 15000, 25000, 50000, 100000, 250000].map((n) => ({
  value: String(n),
  label: `$${n.toLocaleString("en-US")}`,
}));
export const MARE_STATUS: Option[] = [
  { value: "", label: "Not sure" },
  { value: "maiden", label: "Maiden (never foaled)" },
  { value: "barren", label: "Barren (not in foal last year)" },
  { value: "in_foal", label: "In foal" },
  { value: "foaled", label: "Foaled this year" },
  { value: "slipped", label: "Slipped (lost the foal)" },
];
export const REQUEST_STATUS: (Option & { sender: string; tone: string })[] = [
  { value: "new", label: "New", sender: "Sent", tone: "accent" },
  { value: "talking", label: "Talking", sender: "In talks", tone: "warn" },
  { value: "booked", label: "Booked", sender: "Booked", tone: "ok" },
  { value: "declined", label: "Declined", sender: "Not this time", tone: "muted" },
  { value: "closed", label: "Closed", sender: "Closed", tone: "muted" },
];

export const GENETIC_TESTS: { key: string; label: string; name: string; allele: string; inheritance: "recessive" | "dominant"; breeds: string[] }[] = [
  { key: "GBED", label: "GBED", name: "Glycogen branching enzyme deficiency", allele: "GBED", inheritance: "recessive", breeds: ["quarter_horse", "paint", "appaloosa"] },
  { key: "HERDA", label: "HERDA", name: "Hereditary equine regional dermal asthenia", allele: "HRD", inheritance: "recessive", breeds: ["quarter_horse", "paint", "appaloosa"] },
  { key: "LWO", label: "LWO", name: "Overo lethal white (frame overo)", allele: "O", inheritance: "recessive", breeds: ["paint", "quarter_horse"] },
  { key: "HYPP", label: "HYPP", name: "Hyperkalemic periodic paralysis", allele: "H", inheritance: "dominant", breeds: ["quarter_horse", "paint", "appaloosa"] },
  { key: "PSSM1", label: "PSSM1", name: "Polysaccharide storage myopathy type 1", allele: "P1", inheritance: "dominant", breeds: ["quarter_horse", "paint", "appaloosa", "warmblood", "other"] },
  { key: "MH", label: "MH", name: "Malignant hyperthermia", allele: "MH", inheritance: "dominant", breeds: ["quarter_horse", "paint", "appaloosa"] },
  { key: "IMM", label: "IMM", name: "Immune-mediated myositis (MYH1)", allele: "My", inheritance: "dominant", breeds: ["quarter_horse", "paint", "appaloosa"] },
  { key: "WFFS", label: "WFFS", name: "Warmblood fragile foal syndrome", allele: "WFFS", inheritance: "recessive", breeds: ["warmblood", "thoroughbred", "other"] },
  { key: "SCID", label: "SCID", name: "Severe combined immunodeficiency", allele: "SCID", inheritance: "recessive", breeds: ["arabian"] },
  { key: "CA", label: "CA", name: "Cerebellar abiotrophy", allele: "CA", inheritance: "recessive", breeds: ["arabian"] },
  { key: "LFS", label: "LFS", name: "Lavender foal syndrome", allele: "LFS", inheritance: "recessive", breeds: ["arabian"] },
];
/** "N/N", "N/GBED", "GBED/GBED". */
export const geneticResult = (key: string, copies: 0 | 1 | 2) => {
  const a = GENETIC_TESTS.find((t) => t.key === key)?.allele ?? "x";
  return copies === 0 ? "N/N" : copies === 1 ? `N/${a}` : `${a}/${a}`;
};

/* ---------- Regions ---------- */
const US: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"], ["PR", "Puerto Rico"],
];
const CANADA: [string, string][] = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"], ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"],
  ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"],
];
const COUNTRIES: [string, string][] = [
  ["GB", "Great Britain"], ["IE", "Ireland"], ["FR", "France"], ["DE", "Germany"], ["IT", "Italy"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["JP", "Japan"], ["HK", "Hong Kong"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"],
  ["QA", "Qatar"], ["ZA", "South Africa"], ["AR", "Argentina"], ["BR", "Brazil"], ["CL", "Chile"], ["UY", "Uruguay"],
  ["PE", "Peru"], ["MX", "Mexico"], ["KR", "South Korea"], ["IN", "India"], ["TR", "Türkiye"],
];
export const REGION_GROUPS: { label: string; options: Option[] }[] = [
  { label: "United States", options: [{ value: "US", label: "Anywhere in the US" }, ...US.map(([c, n]) => ({ value: `US-${c}`, label: n }))] },
  { label: "Canada", options: [{ value: "CA", label: "Anywhere in Canada" }, ...CANADA.map(([c, n]) => ({ value: `CA-${c}`, label: n }))] },
  { label: "Other countries", options: COUNTRIES.map(([c, n]) => ({ value: c, label: n })) },
];
const REGION_NAMES = new Map(REGION_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o.label] as const)));
export const regionLabel = (code: string) => REGION_NAMES.get(code) ?? code;
/** Countries a horse can be foaled in (two letters), for the form. */
export const FOALED_COUNTRIES: Option[] = [{ value: "US", label: "United States" }, { value: "CA", label: "Canada" }, ...COUNTRIES.map(([c, n]) => ({ value: c, label: n }))];

/* ---------- Formatting ---------- */
export const labelOf = (list: Option[], value: string) => list.find((o) => o.value === value)?.label ?? value;
export const breedLabel = (v: string) => labelOf(BREEDS, v);

export function money(cents: number | null | undefined, currency = "USD", digits = 0) {
  if (cents === null || cents === undefined) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(cents / 100);
  } catch {
    return `${(cents / 100).toLocaleString("en-US")} ${currency}`;
  }
}
/** "$7,500" or "Private fee". */
export const feeText = (s: Pick<StallionCard, "fee" | "feeCurrency">) => (s.fee === null ? "Private fee" : money(s.fee, s.feeCurrency));
/** Racing earnings come as whole amounts (not cents). */
export const amount = (value: number, currency: string) => money(value * 100, currency);

/** 65 inches → "16.1 hh". */
export const hands = (inches: number | null | undefined) => (inches ? `${Math.floor(inches / 4)}.${inches % 4} hh` : "");
export const HEIGHTS: Option[] = Array.from({ length: 33 }, (_, i) => 48 + i).map((n) => ({ value: String(n), label: hands(n) }));

export const ageOf = (foaled: number | null) => (foaled ? new Date().getFullYear() - foaled : null);

export function recordText(r: RaceRecord | null | undefined) {
  if (!r || r.starts === undefined) return "";
  return `${r.starts}: ${r.wins ?? 0}-${r.places ?? 0}-${r.shows ?? 0}`;
}
export const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");
export const dateText = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
export const surfaceLabel = (s: string) =>
  ({ dirt: "Dirt", turf: "Turf", synthetic: "Synthetic", all_weather: "All-weather", unknown: "Not given" })[s] ?? s;
export const furlongs = (f: number) => (f >= 8 && Math.abs(f % 1) < 0.01 && f % 8 === 0 ? `${f / 8} mi` : `${f} f`);

/* ---------- Pedigrees ---------- */
/** Every position up to `depth` generations, nearest first: s, d, ss, sd, … */
export function pedigreePaths(depth: number): string[] {
  const out: string[] = [];
  let level = [""];
  for (let g = 1; g <= depth; g++) {
    level = level.flatMap((p) => [`${p}s`, `${p}d`]);
    out.push(...level);
  }
  return out;
}
/** "s" → "Sire", "ds" → "Dam's sire", "sds" → "Sire's dam's sire". */
export function positionLabel(path: string) {
  const words = [...path].map((c) => (c === "s" ? "sire" : "dam"));
  const text = words.map((w, i) => (i < words.length - 1 ? `${w}'s` : w)).join(" ");
  return text[0].toUpperCase() + text.slice(1);
}
export const nameKey = (name: string | undefined) =>
  (name ?? "").replace(/\s*\([A-Za-z]{2,3}\)\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase();
export const sireLine = (p: Pedigree) => ["s", "ss", "sss", "ssss"].map((k) => p[k]).filter(Boolean) as string[];
export const breedingLine = (s: Pick<StallionCard, "sire" | "dam" | "damSire">) =>
  [s.sire && `by ${s.sire}`, s.dam && `out of ${s.dam}`, s.damSire && `(by ${s.damSire})`].filter(Boolean).join(" ");
