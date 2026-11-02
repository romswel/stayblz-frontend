import type { Page } from "@playwright/test";
export const stableId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export async function mockWorkspace(page: Page, role = "owner") {
  await page.route("**/api/workspaces", (route) =>
    route.fulfill({
      json: { stables: [{ id: stableId, name: "Test stable", role }] },
    }),
  );
  await page.route("**/api/workspaces/members", (route) =>
    route.fulfill({ json: { members: [] } }),
  );
  await page.route("**/api/workspaces/invitations", (route) =>
    route.fulfill({ json: { invitations: [] } }),
  );
}
