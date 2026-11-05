import { ppContent, productPages } from "./productContent";
export interface PPProduct {
  id: string;
  name: string;
  group: "Thoroughbred" | "Harness";
  description: string;
  preview: "standard" | "detailed" | "chart";
  overview?: boolean;
}

// Stayblz report designs, not offers for another company's products.
export const ppProducts: PPProduct[] = [
  {
    id: "detailed-racecard",
    name: "Detailed Racecard",
    group: "Thoroughbred",
    description: "More space to read previous starts and race context.",
    preview: "detailed",
  },
  {
    id: "racecard",
    name: "Racecard",
    group: "Thoroughbred",
    description: "Entries and race conditions in a clear report layout.",
    preview: "standard",
  },
  {
    id: "race-day-summary",
    name: "Race Day Summary",
    group: "Thoroughbred",
    description:
      "A short view of the schedule, conditions and published changes.",
    preview: "standard",
  },
  {
    id: "form-comparison",
    name: "Form Comparison",
    group: "Thoroughbred",
    description: "A planned side-by-side view of recent form.",
    preview: "detailed",
  },
  {
    id: "horse-history",
    name: "Horse History",
    group: "Thoroughbred",
    description: "Find a horse and explore a career-history report design.",
    preview: "standard",
    overview: false,
  },
  {
    id: "harness-racecard",
    name: "Harness Racecard",
    group: "Harness",
    description: "Race-day entries, conditions and driver fields.",
    preview: "standard",
  },
  {
    id: "harness-form",
    name: "Harness Form Guide",
    group: "Harness",
    description: "An expanded harness running-line layout and reading guide.",
    preview: "detailed",
  },
  {
    id: "harness-workspace",
    name: "Harness Workspace",
    group: "Harness",
    description:
      "Search and sort published harness records, then open your notes.",
    preview: "chart",
  },
];

export const ppLinks = [
  { to: "/pps/compare", label: "Compare PPs" },
  { to: "/pps/by-track", label: "Shop by track" },
  { to: "/pps/day-passes", label: "Day pass plans" },
];

// Both navigation surfaces use these existing routes; top links use short names.
export const ppNavigationGroups = [
  ...(["Thoroughbred", "Harness"] as const).map((group) => ({
    label: group,
    links: ppProducts
      .filter((product) => product.group === group)
      .map((product) => ({
        to: `/pps/${product.id}`,
        label: product.name,
        shortLabel: product.name,
      })),
  })),
  {
    label: "More",
    links: [
      ...ppLinks.map((link) => ({ ...link, shortLabel: link.label })),
      { to: "/pps/store", label: "Report catalogue", shortLabel: "Store" },
    ],
  },
];

export const ppPaths = [
  "/pps",
  "/pps/store",
  "/pps/cart",
  ...ppLinks.map((link) => link.to),
  ...ppProducts.map((product) => `/pps/${product.id}`),
  ...Object.keys(ppContent).flatMap((id) =>
    productPages(id).map((page) => page.to),
  ),
];

// Only internal, registered PP routes may survive sign-in or be used as Back origins.
export function isPPDestination(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2048 &&
    ppPaths.includes(value.split(/[?#]/, 1)[0])
  );
}
