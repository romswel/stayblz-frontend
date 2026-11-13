// Horse marketplace choice lists. The keys must match the server's lists
// (stayblz-backend src/lib/marketplaceInput.ts); the labels are only shown here.

export type Option = { value: string; label: string };

export const BREEDS: Option[] = [
  { value: "thoroughbred", label: "Thoroughbred" },
  { value: "quarter-horse", label: "Quarter Horse" },
  { value: "standardbred", label: "Standardbred" },
  { value: "arabian", label: "Arabian" },
  { value: "appaloosa", label: "Appaloosa" },
  { value: "paint", label: "Paint Horse" },
  { value: "warmblood", label: "Warmblood" },
  { value: "andalusian", label: "Andalusian" },
  { value: "friesian", label: "Friesian" },
  { value: "morgan", label: "Morgan" },
  { value: "tennessee-walker", label: "Tennessee Walking Horse" },
  { value: "mustang", label: "Mustang" },
  { value: "draft", label: "Draft" },
  { value: "pony", label: "Pony" },
  { value: "other", label: "Other / crossbred" },
];

export const DISCIPLINES: Option[] = [
  { value: "flat-racing", label: "Flat racing" },
  { value: "harness-racing", label: "Harness racing" },
  { value: "jump-racing", label: "Jump racing (steeplechase)" },
  { value: "barrel-racing", label: "Barrel racing" },
  { value: "show-jumping", label: "Show jumping" },
  { value: "dressage", label: "Dressage" },
  { value: "eventing", label: "Eventing" },
  { value: "hunter", label: "Hunter / equitation" },
  { value: "western-pleasure", label: "Western pleasure" },
  { value: "reining", label: "Reining" },
  { value: "ranch", label: "Ranch work" },
  { value: "endurance", label: "Endurance" },
  { value: "polo", label: "Polo" },
  { value: "trail", label: "Trail & pleasure" },
  { value: "breeding", label: "Breeding" },
  { value: "unstarted", label: "Unstarted / none yet" },
];

export const TYPES: Option[] = [
  { value: "racehorse", label: "Racehorse (in training)" },
  { value: "racing-prospect", label: "Racing prospect" },
  { value: "retired-racehorse", label: "Retired racehorse" },
  { value: "broodmare", label: "Broodmare" },
  { value: "stallion", label: "Stallion / stud" },
  { value: "yearling", label: "Yearling" },
  { value: "weanling", label: "Weanling" },
  { value: "foal", label: "Foal" },
  { value: "sport-horse", label: "Sport / competition horse" },
  { value: "riding-horse", label: "Riding horse" },
  { value: "companion", label: "Companion horse" },
];

export const GENDERS: Option[] = [
  { value: "mare", label: "Mare" },
  { value: "filly", label: "Filly" },
  { value: "gelding", label: "Gelding" },
  { value: "stallion", label: "Stallion" },
  { value: "colt", label: "Colt" },
  { value: "ridgling", label: "Ridgling" },
];

export const COLORS: Option[] = [
  { value: "bay", label: "Bay" },
  { value: "dark-bay-brown", label: "Dark bay / brown" },
  { value: "chestnut", label: "Chestnut" },
  { value: "gray", label: "Gray" },
  { value: "roan", label: "Roan" },
  { value: "black", label: "Black" },
  { value: "palomino", label: "Palomino" },
  { value: "buckskin", label: "Buckskin" },
  { value: "dun", label: "Dun" },
  { value: "grullo", label: "Grullo" },
  { value: "pinto", label: "Pinto / paint" },
  { value: "appaloosa", label: "Appaloosa (spotted)" },
  { value: "white", label: "White" },
  { value: "cremello", label: "Cremello / perlino" },
  { value: "other", label: "Other" },
];

/** Coat and mane colours for the drawn portrait on each listing card. */
export const COAT: Record<string, { coat: string; mane: string; blaze?: boolean }> = {
  bay: { coat: "#8a4f2a", mane: "#1d130d" },
  "dark-bay-brown": { coat: "#4a2c1a", mane: "#120b07" },
  chestnut: { coat: "#a85a26", mane: "#7a3d18", blaze: true },
  gray: { coat: "#a9a9a3", mane: "#5f5f5b" },
  roan: { coat: "#8f7b70", mane: "#3b2c24" },
  black: { coat: "#262422", mane: "#0e0d0c" },
  palomino: { coat: "#d6ac5a", mane: "#f3ead2", blaze: true },
  buckskin: { coat: "#c9a063", mane: "#1e1610" },
  dun: { coat: "#b99a6b", mane: "#3d2e20" },
  grullo: { coat: "#7c7468", mane: "#2b2723" },
  pinto: { coat: "#8b5a32", mane: "#f2efe7", blaze: true },
  appaloosa: { coat: "#d8cfc0", mane: "#3b2c24" },
  white: { coat: "#efece4", mane: "#d9d4c8" },
  cremello: { coat: "#ecdfbf", mane: "#f5ecd6" },
  other: { coat: "#8a6a4a", mane: "#3a2a1c" },
};

export const labelOf = (list: Option[], value: string) =>
  list.find((o) => o.value === value)?.label ?? value;

/** Heights are stored in inches. 1 hand = 4 inches; 16.2 hh means 16 hands 2 inches (66 in). */
export const HEIGHT_MIN = 24;
export const HEIGHT_MAX = 80;
export const formatHands = (inches: number) => `${Math.floor(inches / 4)}.${inches % 4} hh`;
/** Every height from 6.0 hh to 20.0 hh, for the listing form. */
export const HEIGHTS: Option[] = Array.from({ length: HEIGHT_MAX - HEIGHT_MIN + 1 }, (_, i) => {
  const inches = HEIGHT_MIN + i;
  return { value: String(inches), label: formatHands(inches) };
});
/** The filter only needs the usual range: 12.0 hh to 18.0 hh. */
export const HEIGHT_FILTER: Option[] = HEIGHTS.filter((h) => +h.value >= 48 && +h.value <= 72);

export const PRICE_MAX = 100_000_000;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const formatPrice = (value: number) => usd.format(value);
export const PRICE_STEPS: Option[] = [
  1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
].map((n) => ({ value: String(n), label: formatPrice(n) }));

export const AGE_MAX = 40;
export const formatAge = (age: number) => (age === 0 ? "Under 1 yr" : `${age} yr${age === 1 ? "" : "s"}`);
export const AGE_FILTER: Option[] = Array.from({ length: 26 }, (_, age) => ({
  value: String(age),
  label: age === 0 ? "Under 1" : String(age),
}));

export const SORTS: Option[] = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "age-asc", label: "Youngest first" },
];

export interface Listing {
  id: string;
  name: string;
  price: number;
  breed: string;
  discipline: string;
  type: string;
  gender: string;
  color: string;
  age: number;
  heightIn: number;
  location: string;
  sellerName: string;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the listing form sends (and the server checks again). */
export type ListingInput = Omit<Listing, "id" | "sellerName" | "mine" | "createdAt" | "updatedAt">;
