/**
 * Core domain types for Lifeline.
 *
 * Memories rarely come with exact dates, so the date model is "fuzzy": a
 * memory can be pinned to a day, a month, a season, a year, an age, a range of
 * years, a decade, or be left unplaced until the user remembers more.
 */

export type DatePrecision =
  | 'day'
  | 'month'
  | 'season'
  | 'year'
  | 'age'
  | 'range'
  | 'decade'
  | 'unknown';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface FuzzyDate {
  precision: DatePrecision;
  /** Used by day / month / season / year, and as the start of a range. */
  year?: number;
  /** 1–12. Used by day / month. */
  month?: number;
  /** 1–31. Used by day. */
  day?: number;
  season?: Season;
  /** Inclusive end year for `range`. */
  endYear?: number;
  /** First year of the decade, e.g. 1990, for `decade`. */
  decade?: number;
  /** Age (or start of an age span) for `age`. Resolved with the user's birth year. */
  age?: number;
  /** Optional inclusive end of an age span ("ages 8–10"). */
  ageEnd?: number;
  /** "Around" — the user isn't sure. Purely presentational; bounds are unchanged. */
  circa?: boolean;
}

export type Clarity = 'vivid' | 'partial' | 'faint';

export type Feeling =
  | 'joyful'
  | 'proud'
  | 'calm'
  | 'tender'
  | 'bittersweet'
  | 'difficult';

export interface Memory {
  id: string;
  title: string;
  notes: string;
  date: FuzzyDate;
  /** Derived from `date` (ISO yyyy-mm-dd). Empty string when unplaced. */
  sortStart: string;
  sortEnd: string;
  /** Timeline section the memory lives in. `null` = unplaced (in the inbox). */
  groupYear: number | null;
  /**
   * Manual position inside a year section, set when the user rearranges.
   * Lower comes first. `null` means "order by date".
   */
  rank: number | null;
  location: string;
  /** People in this memory (ids into the people table). */
  personIds: string[];
  tags: string[];
  feeling: Feeling | null;
  clarity: Clarity;
  photoIds: string[];
  favorite: boolean;
  /** Hidden behind a tap-to-reveal veil on the timeline. */
  isPrivate: boolean;
  /** The reflection prompt that sparked this memory, if any. */
  promptId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  id: string;
  memoryId: string;
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** EXIF capture date if the photo carried one (ISO yyyy-mm-dd). */
  takenAt: string | null;
  createdAt: number;
}

/** A person who appears in memories: family, friends, teachers… */
export interface Person {
  id: string;
  name: string;
  /** Free text, e.g. "Mom", "Grandfather", "Best friend". */
  relationship: string;
  /** Small square JPEG, or null to show initials. */
  avatar: Blob | null;
  color: ChapterColor;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

/** A spoken voice note attached to a memory. */
export interface Recording {
  id: string;
  memoryId: string;
  blob: Blob;
  mime: string;
  durationMs: number;
  createdAt: number;
}

export type ChapterColor = 'sage' | 'clay' | 'sky' | 'plum' | 'sand' | 'rose';

export interface Chapter {
  id: string;
  title: string;
  startYear: number;
  /** Inclusive. */
  endYear: number;
  color: ChapterColor;
  createdAt: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  name: string;
  birthYear: number | null;
  theme: ThemePreference;
  onboarded: boolean;
  /** Show empty-year "gaps" on the timeline as gentle prompts. */
  showGaps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  birthYear: null,
  theme: 'system',
  onboarded: false,
  showGaps: true,
};
