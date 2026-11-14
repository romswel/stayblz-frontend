/** What video meetings are called across the site (menu, pages, dialogs, Updates). Change it here. */
export const PADDOCK_NAME = "Stayblz Paddock";
export const PADDOCK_SHORT = "Paddock";
/** Browser-to-browser calls: the API enforces the same limit. */
export const MAX_PEOPLE = 8;

/** Saddlecloth colours (US convention) give each person in a call a number and colour, 1–8. */
export const SADDLECLOTHS: { bg: string; ink: string }[] = [
  { bg: "#c8282e", ink: "#ffffff" },
  { bg: "#f4f2ea", ink: "#111111" },
  { bg: "#1d4fa3", ink: "#ffffff" },
  { bg: "#f2cf3b", ink: "#111111" },
  { bg: "#1f8a46", ink: "#ffffff" },
  { bg: "#161616", ink: "#f2cf3b" },
  { bg: "#ee7d22", ink: "#111111" },
  { bg: "#f19bc0", ink: "#111111" },
];
export const saddlecloth = (n: number) => SADDLECLOTHS[(Math.max(1, n) - 1) % SADDLECLOTHS.length];

export const meetingLink = (code: string) => `${window.location.origin}/paddock/${code}`;

/** "hzpk-rwta", or a pasted link containing one. */
export function codeFrom(input: string): string | null {
  const text = input.trim().toLowerCase();
  const match = text.match(/(?:^|\/|\s)([a-z]{4})-?([a-z]{4})(?:$|[/?#\s])/) ?? text.match(/^([a-z]{4})-?([a-z]{4})$/);
  return match ? `${match[1]}-${match[2]}` : null;
}
