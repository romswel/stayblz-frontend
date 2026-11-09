// Who people are in racing. Describes a person and helps others find the right
// people; it never grants access. Keys must match the backend
// (lib/profileInput.ts) and database (stayblz_community_roles()).

export interface CommunityRole {
  value: string;
  label: string;
  /** One line on how this role takes part in the community. */
  hint: string;
}
export interface RoleGroup {
  label: string;
  roles: CommunityRole[];
}

export const roleGroups: RoleGroup[] = [
  {
    label: "Owners & breeding",
    roles: [
      { value: "owner", label: "Horse owner", hint: "Owns or co-owns racehorses and follows their runs." },
      { value: "syndicate", label: "Syndicate or club member", hint: "Shares a horse through a syndicate, partnership or racing club." },
      { value: "breeder", label: "Breeder", hint: "Breeds foals and follows how its bloodlines race." },
      { value: "bloodstock", label: "Bloodstock agent or consignor", hint: "Buys, sells and advises on horses at sales and privately." },
    ],
  },
  {
    label: "Training & riding",
    roles: [
      { value: "trainer", label: "Trainer", hint: "Prepares horses to race and plans their entries." },
      { value: "assistant_trainer", label: "Assistant trainer", hint: "Runs the yard day to day alongside a trainer." },
      { value: "jockey", label: "Jockey", hint: "Rides in races and builds a record with trainers and owners." },
      { value: "apprentice", label: "Apprentice jockey", hint: "Learning the trade and earning rides." },
      { value: "exercise_rider", label: "Exercise rider", hint: "Rides horses in morning work and gallops." },
      { value: "jockey_agent", label: "Jockey's agent", hint: "Books rides and manages a jockey's schedule." },
    ],
  },
  {
    label: "Horse care",
    roles: [
      { value: "staff", label: "Groom or stable staff", hint: "Looks after horses every day in the yard or barn." },
      { value: "farrier", label: "Farrier", hint: "Shoes horses and looks after their feet." },
      { value: "vet", label: "Equine vet", hint: "Keeps horses healthy and fit to race." },
      { value: "equine_therapist", label: "Physio, dentist or therapist", hint: "Supports recovery, comfort and fitness." },
    ],
  },
  {
    label: "Racing operations",
    roles: [
      { value: "official", label: "Steward or racing official", hint: "Runs race days and applies the rules." },
      { value: "track_staff", label: "Racecourse or track staff", hint: "Works at a racecourse: track, gates, office or events." },
    ],
  },
  {
    label: "Insight & media",
    roles: [
      { value: "handicapper", label: "Handicapper or form analyst", hint: "Studies form and figures to read races." },
      { value: "media", label: "Journalist, photographer or broadcaster", hint: "Reports, films and photographs racing." },
    ],
  },
  {
    label: "Fans",
    roles: [
      { value: "fan", label: "Racing fan", hint: "Follows horses, jockeys and big races." },
      { value: "newcomer", label: "New to racing", hint: "Just getting started and learning the sport." },
    ],
  },
  {
    label: "Something else",
    roles: [{ value: "other", label: "Other", hint: "Takes part in racing in another way." }],
  },
];

export const allRoles = roleGroups.flatMap((group) => group.roles);
export const roleLabelFor = (value: string | undefined) =>
  allRoles.find((role) => role.value === value)?.label ?? "";
export const MAX_EXTRA_ROLES = 3;
