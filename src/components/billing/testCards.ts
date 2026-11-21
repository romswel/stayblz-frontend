/**
 * Test mode: the Stayblz test cards and bank accounts. The number someone types is turned into a test token
 * HERE, in the browser, and only the token is sent. Anything that isn't one of these numbers is refused before
 * it leaves the page, so a real card number is never sent or stored while billing is in test mode.
 * The server keeps the same list by token (backend lib/billing/testProcessor.ts).
 */
export interface TestCard {
  number: string;
  token: string;
  brand: string;
  result: string;
}
export const TEST_CARDS: TestCard[] = [
  { number: "4242 4242 4242 4242", token: "tok_visa", brand: "Visa", result: "Pays" },
  { number: "5555 5555 5555 4444", token: "tok_mastercard", brand: "Mastercard", result: "Pays" },
  { number: "3782 822463 10005", token: "tok_amex", brand: "American Express", result: "Pays" },
  { number: "6011 1111 1111 1117", token: "tok_discover", brand: "Discover", result: "Pays" },
  { number: "4000 0566 5566 5556", token: "tok_visa_debit", brand: "Visa debit", result: "Pays" },
  { number: "4000 0000 0000 0341", token: "tok_fail_later", brand: "Visa", result: "Saves, then every charge is declined" },
  { number: "4000 0000 0000 9995", token: "tok_insufficient", brand: "Visa", result: "Declined: not enough money" },
  { number: "4000 0000 0000 0002", token: "tok_declined", brand: "Visa", result: "Declined" },
  { number: "4000 0000 0000 0069", token: "tok_expired", brand: "Visa", result: "Declined: expired" },
  { number: "4000 0000 0000 0119", token: "tok_error", brand: "Visa", result: "Processing error" },
];
export interface TestBank {
  routing: string;
  account: string;
  token: string;
  result: string;
}
export const TEST_BANKS: TestBank[] = [
  { routing: "110000000", account: "000123456789", token: "btok_ok", result: "Clears" },
  { routing: "110000000", account: "000222222227", token: "btok_insufficient", result: "Returned: not enough money" },
  { routing: "110000000", account: "000111111116", token: "btok_closed", result: "Fails: account closed" },
];

export const digitsOnly = (v: string) => v.replace(/\D/g, "");

/** Standard card checksum, for a helpful "check the number" before the test-card check. */
export function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 12 && sum % 10 === 0;
}
export function brandOf(digits: string) {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(011|5)/.test(digits)) return "Discover";
  return "";
}
/** Groups digits for display: 4-4-4-4, or 4-6-5 for American Express. */
export function formatCardNumber(value: string) {
  const d = digitsOnly(value).slice(0, 19);
  if (/^3[47]/.test(d)) return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  return d.replace(/(.{4})/g, "$1 ").trim();
}
export const cardToken = (number: string) => TEST_CARDS.find((c) => digitsOnly(c.number) === digitsOnly(number))?.token ?? null;
export const bankToken = (routing: string, account: string) =>
  TEST_BANKS.find((b) => b.routing === digitsOnly(routing) && b.account === digitsOnly(account))?.token ?? null;
