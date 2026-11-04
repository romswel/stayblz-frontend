export interface PPContent {
  intro: string;
  highlights: string[];
  sections: { title: string; text: string }[];
  note: string;
}
const running = {
  title: "Running lines and race times",
  text: "Read each previous start by date, track, distance and surface. Positions and margins show where the horse ran; split times show how the race developed.",
};
const figures = {
  title: "Speed, pace and class",
  text: "Speed describes a past performance, pace describes parts of a race, and class helps compare the level of competition. Provider ratings use their own methods and are not interchangeable.",
};
const track = {
  title: "Run-up and rail position",
  text: "Run-up is the distance from the gate to where timing starts. A temporary turf rail changes the course layout. Both help put race times in context.",
};
const results = {
  title: "Results, replays and race changes",
  text: "A report may link to the result chart, replay, scratches and rider changes. Replay access can require a separate plan. A QR code is a shortcut to an existing race page, not a separate source of data.",
};
const changes = {
  title: "Claims, geldings and trip notes",
  text: "Claim notes record changes of ownership, including claims later cancelled by officials. Gelding notes identify the first start after the reported change. Trip notes flag a difficult start, blocked path or other trouble.",
};
export const ppContent: Record<string, PPContent> = {
  premium: {
    intro:
      "A detailed race-card report for comparing runners, recent form and racing connections.",
    highlights: [
      "Up to 12 recent starts in the reference format",
      "Speed, pace, class and race-rating fields",
      "Jockey, trainer and partnership statistics",
      "Claim, scratch and trip notes",
      "Standard and highlighted report layouts",
    ],
    sections: [
      running,
      figures,
      {
        title: "Connections and previous trainers",
        text: "Trainer and jockey records can add context to a runner's form. Previous-trainer and claim information helps explain changes between starts.",
      },
      track,
      changes,
      results,
      {
        title: "Highlighted report option",
        text: "The reference includes a second layout that draws attention to selected fields and groups rating comparisons in charts. Stayblz has no licensed enhanced report or rating calculations connected yet.",
      },
      {
        title: "Other report fields",
        text: "Foreign ratings, outer-turf symbols and wind information for applicable race types depend on the report and its source. Missing information should stay blank, rather than be estimated.",
      },
    ],
    note: "Equibase Speed Figures, Pace Figures and Class Ratings, and Timeform ratings are provider content. No such ratings are supplied or calculated here.",
  },
  basic: {
    intro:
      "A straightforward race-card report for reading recent form before a race.",
    highlights: [
      "Recent race history in a traditional layout",
      "Horse and racing connection details",
      "Speed, pace and class fields",
      "Claims and reported gelding changes",
      "Links to results and available replays",
    ],
    sections: [running, figures, track, changes, results],
    note: "The reference Basic report includes provider ratings. Stayblz does not supply those ratings or a licensed Basic PP file yet.",
  },
  platinum: {
    intro:
      "A detailed report format with ratings, race context and horse-by-horse comparisons.",
    highlights: [
      "Power, speed, class and pace fields",
      "Positive and negative form notes",
      "Full positions at each call",
      "Jockey and trainer statistics",
      "Run-up, rail and track-bias context",
    ],
    sections: [
      running,
      {
        title: "Power ratings",
        text: "TrackMaster's Power Rating combines its speed, class and pace information into a provider-specific comparison. Stayblz does not reproduce that formula or generate a substitute rating.",
      },
      figures,
      track,
      {
        title: "Track bias and running style",
        text: "Bias notes describe whether a surface appeared to favour leaders, stalking runners or horses coming from behind. They describe past conditions and are not a guarantee about the next race.",
      },
      results,
    ],
    note: "TrackMaster Power Ratings and the provider's other ratings require a separate data arrangement. No Platinum files or ratings are connected.",
  },
  "daily-racing-form": {
    intro:
      "A traditional past-performance format, with additional race information when supplied by the publisher.",
    highlights: [
      "Detailed recent race history",
      "Graded entry summaries",
      "Track records by distance",
      "Race analysis where supplied",
      "Selections where supplied",
    ],
    sections: [
      running,
      {
        title: "Graded entries",
        text: "A short view of the field can show post position, rider, assigned weight, expected odds and comments. Race conditions and equipment changes give more context.",
      },
      {
        title: "Track records",
        text: "Track records list the fastest recorded performances at the listed distance and surface. Compare like conditions when reading them.",
      },
      {
        title: "Analysis and selections",
        text: "Publisher-written race analysis and selections are separate editorial content. They may not appear in every edition. Stayblz does not copy the publisher's picks or generate results in their place.",
      },
      {
        title: "Beyer Speed Figures",
        text: "Beyer Speed Figures are a Daily Racing Form rating. They are not the same as an Equibase figure. No Beyer data or calculations are included in Stayblz.",
      },
    ],
    note: "Daily Racing Form reports, Beyer Speed Figures and publisher analysis are reference content only. Stayblz is not an authorised seller of these files.",
  },
  lifetime: {
    intro:
      "Find an individual horse and review the option for a report covering its racing history.",
    highlights: [
      "Horse-based search instead of a race-card selection",
      "Career racing history for Thoroughbreds and Quarter Horses",
      "Performance and connection details",
      "Sales and pedigree context where supplied",
    ],
    sections: [
      {
        title: "Choose the right horse",
        text: "Start with the horse's registered name. Birth year and dam's name can help distinguish horses with similar names when a provider supports those fields.",
      },
      {
        title: "Career history",
        text: "A lifetime report follows one horse across its recorded starts. Coverage and available fields depend on the provider and the countries where the horse raced.",
      },
      {
        title: "Sales and pedigree information",
        text: "Sales history, pedigree and stakes summaries may be supplied in a provider's report. These are separate from the recent-race lists shown in Stayblz.",
      },
    ],
    note: "The screenshot identifies equineline as the lifetime-report provider. No equineline search or report delivery is connected here.",
  },
};
export const productViews = [
  "features",
  "sample",
  "free-race",
  "guide",
  "subscriptions",
] as const;
export function productPages(id: string) {
  return [
    {
      to: `/pps/${id}`,
      label: id === "lifetime" ? "Find a horse" : "Pricing & tracks",
    },
    { to: `/pps/${id}/features`, label: "Features" },
    {
      to: `/pps/${id}/${id === "premium" ? "free-race" : "sample"}`,
      label: id === "premium" ? "Free race" : "Sample",
    },
    { to: `/pps/${id}/guide`, label: "How to read" },
    ...(id !== "lifetime" && id !== "daily-racing-form"
      ? [{ to: `/pps/${id}/subscriptions`, label: "Subscriptions" }]
      : []),
  ];
}
