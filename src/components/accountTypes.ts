// Kept for older imports. The full grouped list lives in account/communityRoles.ts.
import { allRoles } from "./account/communityRoles";

export const accountTypes = allRoles.map(({ value, label }) => ({ value, label }));
