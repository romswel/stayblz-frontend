export interface PPContent {
  intro: string;
  highlights: string[];
  sections: { title: string; text: string }[];
  note: string;
  mode?: "history" | "workspace";
  subscriptions?: boolean;
}
const raceConditions = {
  title: "Race conditions",
  text: "Check the distance, surface, entry rules and scheduled start. Changes to a race should come from an approved racing source and carry an update time.",
};
const runningLines = {
  title: "Previous starts",
  text: "Read earlier starts by date, track and distance. Finishing position, margins and split times can help explain the run when that information is available.",
};
const records = {
  title: "Records and source",
  text: "Each race or horse record needs an identified source. Missing fields stay blank. A published entry does not mean a full history or downloadable report is available.",
};
const harnessBasics = {
  title: "Pace and trot",
  text: "Harness races use different gaits. Check whether the race is for pacers or trotters before comparing form. Gait is a race condition, not a speed rating.",
};
const harnessPeople = {
  title: "Drivers and trainers",
  text: "The driver steers the horse from a sulky; the trainer prepares the horse. Driver changes and trainer records can add context when approved records are available.",
};
const harnessForm = {
  title: "Breaks and qualifying races",
  text: "A break means a horse left the required gait. Qualifying races and time away can help explain a return to racing. These details must come from recorded results, not guesses.",
};
const availability =
  "This is a Stayblz report design. Prices, approved report files and paid access are not available yet.";
export const ppContent: Record<string, PPContent> = {
  racecard: {
    intro: "A clear view of the entries and conditions for a race day.",
    highlights: [
      "Track and race-date selection",
      "Race conditions and entry details",
      "A readable print layout",
    ],
    sections: [raceConditions, runningLines, records],
    note: availability,
    subscriptions: true,
  },
  "detailed-racecard": {
    intro:
      "A planned report that gives more space to each horse's previous starts.",
    highlights: [
      "An expanded running-line layout",
      "Space for rider and trainer changes",
      "Notes beside the facts you are comparing",
    ],
    sections: [
      runningLines,
      {
        title: "Race context",
        text: "Read the conditions and changes alongside the result. A run at a different distance or surface may need a closer look.",
      },
      {
        title: "Your notes",
        text: "Keep personal observations in My notes. Notes belong to your account and do not change published racing records.",
      },
      records,
    ],
    note: availability,
    subscriptions: true,
  },
  "race-day-summary": {
    intro:
      "A planned short report for checking the day's schedule and race conditions.",
    highlights: [
      "A compact race-day outline",
      "Conditions and published changes",
      "Quick links to available records",
    ],
    sections: [
      raceConditions,
      {
        title: "Changes and updates",
        text: "A schedule is useful only when changes are clear. Show the source and time of each scratch, cancellation or rider change when that feed is connected.",
      },
      records,
    ],
    note: availability,
  },
  "form-comparison": {
    intro: "A planned side-by-side layout for comparing recent horse form.",
    highlights: [
      "Comparable dates, surfaces and distances",
      "Positions and margins where available",
      "Your notes alongside the race facts",
    ],
    sections: [
      runningLines,
      {
        title: "Compare similar conditions",
        text: "Start with races at a similar distance and surface. A finishing position alone does not explain the field or race conditions.",
      },
      {
        title: "Compare the facts",
        text: "Compare the available records directly. This layout does not calculate a score or predict a winner.",
      },
      records,
    ],
    note: availability,
  },
  "horse-history": {
    intro:
      "Find a published horse and explore the design for a career-history report.",
    mode: "history",
    highlights: [
      "Search published horses by name",
      "Planned career-history layout",
      "Clear gaps when history is missing",
    ],
    sections: [
      {
        title: "Find the right horse",
        text: "Start with the registered name. Birth year and dam can help distinguish similar names once a horse-record source supports those fields.",
      },
      runningLines,
      records,
    ],
    note: availability,
  },
  "harness-racecard": {
    intro: "A straightforward report design for a harness race day.",
    highlights: [
      "Harness tracks and race dates",
      "Driver, trainer and gait fields",
      "Entries in a clear print layout",
    ],
    sections: [harnessBasics, raceConditions, harnessPeople, records],
    note: availability,
    subscriptions: true,
  },
  "harness-form": {
    intro:
      "A planned expanded view of harness form, with room to read each previous start.",
    highlights: [
      "Space for recent starts and split times",
      "Breaks, qualifying races and time away",
      "Driver and trainer changes",
      "Recent form without a predicted score",
    ],
    sections: [
      harnessBasics,
      runningLines,
      harnessForm,
      harnessPeople,
      {
        title: "Equipment and other changes",
        text: "Shoe, equipment and medication changes can be useful context when the source provides them. Do not infer a change from a missing field.",
      },
      records,
    ],
    note: availability,
    subscriptions: true,
  },
  "harness-workspace": {
    intro:
      "Browse published harness entries and horse records, sort the list, and keep your own notes.",
    mode: "workspace",
    highlights: [
      "Search the loaded harness records",
      "Switch between race entries and horses",
      "Sort by name or recorded starts and wins",
      "Open your private notes",
    ],
    sections: [
      {
        title: "What works here",
        text: "Search, list switching and sorting work on the harness records published in Stayblz. The workspace does not need a paid report to open.",
      },
      {
        title: "Keep your observations",
        text: "Use My notes for private observations. Your notes remain separate from the public race and horse records.",
      },
      {
        title: "What is not connected",
        text: "Runner-level race fields, charts, pedigree analysis, automatic picks and proprietary ratings are not supplied here. No figures are invented to fill an empty list.",
      },
      records,
    ],
    note: "This workspace uses the published records loaded in Stayblz. It does not include paid files, automated picks or a scoring model.",
  },
};
export function productPages(id: string) {
  const content = ppContent[id];
  return [
    {
      to: `/pps/${id}`,
      label:
        content?.mode === "history"
          ? "Find a horse"
          : content?.mode === "workspace"
            ? "Workspace"
            : "Tracks & access",
    },
    { to: `/pps/${id}/features`, label: "Features" },
    ...(content?.mode === "workspace"
      ? []
      : [{ to: `/pps/${id}/sample`, label: "Sample layout" }]),
    { to: `/pps/${id}/guide`, label: "Reading guide" },
    ...(content?.subscriptions
      ? [{ to: `/pps/${id}/subscriptions`, label: "Access plans" }]
      : []),
  ];
}
