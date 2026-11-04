import { ppContent, productPages } from "./productContent";
export interface PPProduct {
  id: string;
  name: string;
  group: "Thoroughbred" | "Harness";
  description: string;
  preview: "standard" | "detailed" | "chart";
  overview?: boolean;
}

// Reference catalogue content, not live offers. Never add reference prices as
// current prices. Provider data, downloads and checkout are not connected.
export const ppProducts: PPProduct[] = [
  {
    id: "premium",
    name: "Premium PP Program",
    group: "Thoroughbred",
    description: "A detailed past performance report for a race card.",
    preview: "detailed",
  },
  {
    id: "basic",
    name: "Basic PP Program",
    group: "Thoroughbred",
    description: "A simpler past performance report for a race card.",
    preview: "standard",
  },
  {
    id: "daily-racing-form",
    name: "Daily Racing Form Past Performances",
    group: "Thoroughbred",
    description: "Past performance reports in the Daily Racing Form format.",
    preview: "standard",
  },
  {
    id: "platinum",
    name: "TrackMaster Platinum Past Performances",
    group: "Thoroughbred",
    description:
      "The TrackMaster Platinum report option for Thoroughbred races.",
    preview: "detailed",
  },
  {
    id: "lifetime",
    name: "Lifetime PPs",
    group: "Thoroughbred",
    description: "A report option for a horse’s full racing history.",
    preview: "standard",
    overview: false,
  },
  {
    id: "harness",
    name: "TrackMaster PPs Harness",
    group: "Harness",
    description: "A past performance report option for harness races.",
    preview: "standard",
  },
  {
    id: "harness-platinum",
    name: "TrackMaster Platinum PPs for Harness",
    group: "Harness",
    description: "The Platinum report option for harness races.",
    preview: "detailed",
  },
  {
    id: "harness-pro",
    name: "TrackMaster Harness Pro",
    group: "Harness",
    description: "A harness report option with a visual layout.",
    preview: "chart",
  },
];

export const ppLinks = [
  { to: "/pps/compare", label: "Compare PPs" },
  { to: "/pps/by-track", label: "Shop by track" },
  { to: "/pps/day-passes", label: "Day pass plans" },
];

const reportLabels: Record<string, string> = {
  premium: "Premium PPs",
  basic: "Basic PPs",
  "daily-racing-form": "Daily Racing Form",
  platinum: "Platinum PPs",
  lifetime: "Lifetime PPs",
  harness: "Harness PPs",
  "harness-platinum": "Harness Platinum",
  "harness-pro": "Harness Pro",
};

// Both navigation surfaces use these existing routes; top links use short names.
export const ppNavigationGroups = [
  ...(["Thoroughbred", "Harness"] as const).map((group) => ({
    label: group,
    links: ppProducts
      .filter((product) => product.group === group)
      .map((product) => ({
        to: `/pps/${product.id}`,
        label: product.name,
        shortLabel: reportLabels[product.id],
      })),
  })),
  {
    label: "More",
    links: [
      ...ppLinks.map((link) => ({ ...link, shortLabel: link.label })),
      { to: "/pps/store", label: "Handicapping store", shortLabel: "Store" },
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
