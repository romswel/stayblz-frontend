import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// vercel.json allows exactly one inline script by hash. Editing the theme script in
// index.html without updating the hash would blank the theme in production.
test("the production CSP allows the inline theme script and stays strict", () => {
  const html = readFileSync("index.html", "utf8");
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const csp: string = config.headers[0].headers.find(
    (h: { key: string }) => h.key === "Content-Security-Policy",
  ).value;
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(scripts).toHaveLength(1);
  const hash = "sha256-" + createHash("sha256").update(scripts[0]).digest("base64");
  expect(csp).toContain(`'${hash}'`);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
});
