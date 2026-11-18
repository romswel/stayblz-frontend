/** "Open Gmail" (or Outlook, Yahoo…) after we send a link, for the big webmail providers. Null for anything else. */
const PROVIDERS: [RegExp, string, string][] = [
  [/^(gmail|googlemail)\.com$/, "Gmail", "https://mail.google.com/mail/u/0/#inbox"],
  [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, "Outlook", "https://outlook.live.com/mail/0/"],
  [/^(yahoo|ymail)\.[a-z.]+$/, "Yahoo Mail", "https://mail.yahoo.com/"],
  [/^(icloud|me|mac)\.com$/, "iCloud Mail", "https://www.icloud.com/mail"],
  [/^(proton\.me|protonmail\.com|pm\.me)$/, "Proton Mail", "https://mail.proton.me/"],
  [/^aol\.com$/, "AOL Mail", "https://mail.aol.com/"],
];

export function inboxFor(email: string): { name: string; url: string } | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const found = PROVIDERS.find(([pattern]) => pattern.test(domain));
  return found ? { name: found[1], url: found[2] } : null;
}

/** The four password rules, for the live checklist under the password field. */
export function passwordRules(value: string) {
  return [
    { label: "12+ characters", ok: value.length >= 12 && value.length <= 128 },
    { label: "Uppercase", ok: /[A-Z]/.test(value) },
    { label: "Lowercase", ok: /[a-z]/.test(value) },
    { label: "Number", ok: /[0-9]/.test(value) },
  ];
}
