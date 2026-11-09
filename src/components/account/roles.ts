import type { User } from "../../types";

const rank: Record<string, number> = { member: 0, admin: 1, superadmin: 2 };

export const roleLabel = (role: string | undefined | null) =>
  role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : "Customer";

/** Uses the role in use now, so "View as: Customer" hides staff tools. The server enforces the same rule. */
export const canUse = (user: User | null | undefined, minimum: "admin" | "superadmin") =>
  (rank[user?.role ?? ""] ?? -1) >= rank[minimum];

/** Views this account may switch between, highest first. */
export function availableViews(user: User | null | undefined): string[] {
  const real = user?.platformRole ?? user?.role ?? "member";
  return ["superadmin", "admin", "member"].filter((role) => rank[role] <= (rank[real] ?? 0));
}
