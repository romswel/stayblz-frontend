// Keep stored values compatible with existing accounts and API validation.
// This describes the customer; it never changes access permissions.
export const accountTypes = [
  { value: "owner", label: "Horse owner" },
  { value: "trainer", label: "Trainer" },
  { value: "jockey", label: "Jockey" },
  { value: "staff", label: "Stable staff" },
  { value: "fan", label: "Racing fan" },
  { value: "other", label: "Other" },
];
