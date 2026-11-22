/** Stayblz Stallions: shapes the API sends (see stayblz-backend migrations/202611220001_stallions.sql). */
export type Pedigree = Record<string, string>;
export type Genetics = Record<string, 0 | 1 | 2>;

export interface MediaRef {
  id: string;
  kind: "photo" | "video";
  poster: boolean;
}
export interface RaceRecord {
  starts?: number;
  wins?: number;
  places?: number;
  shows?: number;
  /** Cents. */
  earnings?: number;
  currency?: string;
}

/** A directory card. */
export interface StallionCard {
  id: string;
  name: string;
  breed: string;
  foaled: number | null;
  color: string;
  heightIn: number | null;
  country: string;
  sire: string;
  dam: string;
  damSire: string;
  farm: string;
  location: string;
  region: string;
  seasonYear: number;
  /** Cents; null = private fee. */
  fee: number | null;
  feeCurrency: string;
  feeTerms: string;
  availability: string;
  methods: string[];
  firstSeason: number | null;
  ownerName: string;
  raceRecord: RaceRecord;
  featured: boolean;
  saves: number;
  saved: boolean;
  mine: boolean;
  status: "draft" | "published" | "hidden";
  cover: MediaRef | null;
  photoCount: number;
  videoCount: number;
  publishedAt: string | null;
  updatedAt: string;
  /** Offspring on public Stayblz racing pages. */
  runners?: number;
}

export interface ProgenyStats {
  runners: number;
  winners: number;
  stakesWinners: number;
  gradedWinners: number;
  starts: number;
  wins: number;
  places: number;
  shows: number;
  earnings: { currency: string; amount: number }[];
  surfaces: { surface: string; starts: number; wins: number }[];
  winDistance: { average: number; shortest: number; longest: number } | null;
  from: string | null;
  to: string | null;
}
export interface TopHorse {
  id: string;
  name: string;
  foaled: number | null;
  sex: string;
  sire: string;
  dam: string;
  damSire: string;
  starts: number;
  wins: number;
  places: number;
  shows: number;
  stakesWins: number;
  lastRun: string | null;
}
export interface Offspring extends Partial<ProgenyStats> {
  named: number;
  top?: TopHorse[];
  crosses?: { damSire: string; runners: number; winners: number; starts: number; wins: number }[];
}
export interface Cross extends Partial<ProgenyStats> {
  named: number;
  top?: TopHorse[];
}

export interface StallionProfile extends StallionCard {
  registry: string;
  registration: string;
  feeNote: string;
  bookingFee: number | null;
  shippingNote: string;
  programs: string;
  pedigree: Pedigree;
  highlights: string[];
  genetics: Genetics;
  fertilityRate: number | null;
  fertilityNote: string;
  description: string;
  inquiriesOpen: boolean;
  racingHorseId: string | null;
  racing: (ProgenyStats & { id: string; name: string; foaled: number | null }) | null;
  hiddenReason: string;
  featuredUntil?: string | null;
  media: { id: string; kind: "photo" | "video"; width: number | null; height: number | null; duration: number | null; poster: boolean }[];
  documents: { id: string; name: string; size: number }[];
  offspring: Offspring | null;
  owner: { views30: number; requests: number; newRequests: number } | null;
}

export interface MyStallion extends StallionCard {
  hiddenReason: string;
  featuredUntil: string | null;
  inquiriesOpen: boolean;
  views30: number;
  daily: number[];
  requests: number;
  newRequests: number;
}

export interface SharedAncestor {
  name: string;
  sire: number[];
  dam: number[];
  notation: string;
  bothSides: boolean;
  through: boolean;
}
export interface GeneticCheck {
  key: string;
  label: string;
  name: string;
  inheritance: "recessive" | "dominant";
  stallion: 0 | 1 | 2 | null;
  mare: 0 | 1 | 2 | null;
  level: "danger" | "warn" | "test" | "clear";
  chance: number | null;
  message: string;
}
export interface MatingReport {
  stallion: { id: string; name: string; breed: string };
  mare: { name: string; breed: string; pedigree: Pedigree };
  foal: Pedigree;
  shared: SharedAncestor[];
  inbreeding: { percent: number; named: number; possible: number };
  genetics: GeneticCheck[];
  crosses: { exact: Cross | null; sireLine: Cross | null; sireLineName: string; asDamSire: Cross | null; mareSire: string };
  notes: string[];
}
export interface Match {
  stallion: StallionCard;
  inbreeding: number;
  shared: { name: string; notation: string }[];
  sharedCount: number;
  genetics: { level: GeneticCheck["level"]; tests: string[] } | null;
  cross: { runners: number; winners: number; wins: number } | null;
}

/** A mare as typed in a form (sent to the API). */
export interface MareDraft {
  name: string;
  breed: string;
  foaled: number | null;
  registration: string;
  pedigree: Pedigree;
  genetics: Genetics;
  racingHorseId?: string | null;
}
export interface SavedMare extends MareDraft {
  id: string;
  color: string;
  notes: string;
  updatedAt: string;
}

export interface BreedingRequest {
  id: string;
  stallionId: string | null;
  stallionName: string;
  senderName: string;
  ownerName: string | null;
  conversationId: string | null;
  mare: { name?: string; breed?: string; foaled?: number | null; sire?: string; dam?: string; damSire?: string; registration?: string; status?: string };
  seasonYear: number | null;
  method: string;
  message: string;
  status: "new" | "talking" | "booked" | "declined" | "closed";
  ownerNote?: string;
  cover: MediaRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface RacingHorse {
  id: string;
  name: string;
  country: string;
  foaled: number | null;
  sex: string;
  color: string;
  breed: string;
  sire: string;
  dam: string;
  damSire: string;
}

export interface SearchResult {
  stallions: StallionCard[];
  total: number;
  page: number;
  more: boolean;
  facets?: { total: number; breeds: { value: string; count: number }[]; regions: { value: string; count: number }[] };
}
