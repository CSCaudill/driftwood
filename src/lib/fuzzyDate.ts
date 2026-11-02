import type { FuzzyDate, Season } from '../types';

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

export interface DateBounds {
  /** ISO yyyy-mm-dd, inclusive. */
  start: string;
  /** ISO yyyy-mm-dd, inclusive. */
  end: string;
  /** Year the memory is filed under on the timeline. */
  groupYear: number;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const iso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const SEASON_MONTHS: Record<Season, [startMonth: number, endMonth: number, spansYear: boolean]> = {
  spring: [3, 5, false],
  summer: [6, 8, false],
  fall: [9, 11, false],
  // Winter of 1998 = Dec 1998 → Feb 1999 (labelled "Winter 1998–99").
  winter: [12, 2, true],
};

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/**
 * Resolve a fuzzy date into concrete inclusive bounds.
 * Returns `null` when the date can't be placed (unknown, incomplete, or an
 * age without a birth year).
 */
export function resolveBounds(date: FuzzyDate, birthYear: number | null): DateBounds | null {
  switch (date.precision) {
    case 'day': {
      const { year, month, day } = date;
      if (!isInt(year) || !isInt(month) || !isInt(day)) return null;
      const d = Math.min(day, daysInMonth(year, month));
      const s = iso(year, month, d);
      return { start: s, end: s, groupYear: year };
    }
    case 'month': {
      const { year, month } = date;
      if (!isInt(year) || !isInt(month)) return null;
      return {
        start: iso(year, month, 1),
        end: iso(year, month, daysInMonth(year, month)),
        groupYear: year,
      };
    }
    case 'season': {
      const { year, season } = date;
      if (!isInt(year) || !season) return null;
      const [sm, em, spans] = SEASON_MONTHS[season];
      const endYear = spans ? year + 1 : year;
      return {
        start: iso(year, sm, 1),
        end: iso(endYear, em, daysInMonth(endYear, em)),
        groupYear: year,
      };
    }
    case 'year': {
      if (!isInt(date.year)) return null;
      return { start: iso(date.year, 1, 1), end: iso(date.year, 12, 31), groupYear: date.year };
    }
    case 'range': {
      const { year, endYear } = date;
      if (!isInt(year) || !isInt(endYear)) return null;
      const [a, b] = year <= endYear ? [year, endYear] : [endYear, year];
      return { start: iso(a, 1, 1), end: iso(b, 12, 31), groupYear: a };
    }
    case 'decade': {
      if (!isInt(date.decade)) return null;
      const d = Math.floor(date.decade / 10) * 10;
      return { start: iso(d, 1, 1), end: iso(d + 9, 12, 31), groupYear: d };
    }
    case 'age': {
      if (!isInt(date.age) || !isInt(birthYear)) return null;
      const a = date.age;
      const b = isInt(date.ageEnd) && date.ageEnd >= a ? date.ageEnd : a;
      // Without a birthday, "age 8" spans the 8th birthday year and the next.
      // We file it under the first year and let the end year absorb the rest.
      return {
        start: iso(birthYear + a, 1, 1),
        end: iso(birthYear + b + 1, 12, 31),
        groupYear: birthYear + a,
      };
    }
    case 'unknown':
    default:
      return null;
  }
}

/** Long, human label: "Around summer 1998", "Ages 8–10 (1994–1997)". */
export function formatFuzzyDate(date: FuzzyDate, birthYear: number | null): string {
  const base = baseLabel(date, birthYear, false);
  if (!date.circa || date.precision === 'unknown') return base;
  return `Around ${lowerFirst(base)}`;
}

/** Compact label used on timeline cards: "~Summer ’98" style but kept legible. */
export function formatFuzzyDateShort(date: FuzzyDate, birthYear: number | null): string {
  const base = baseLabel(date, birthYear, true);
  if (!date.circa || date.precision === 'unknown') return base;
  return `~ ${base}`;
}

function lowerFirst(s: string) {
  // Keep month names and "Age" capitalised-looking for proper nouns; only lower
  // generic leading words.
  return /^(Spring|Summer|Fall|Winter|The)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function baseLabel(date: FuzzyDate, birthYear: number | null, short: boolean): string {
  const M = short ? MONTHS_SHORT : MONTHS;
  switch (date.precision) {
    case 'day':
      if (!date.year || !date.month || !date.day) return 'Date unknown';
      return short
        ? `${M[date.month - 1]} ${date.day}, ${date.year}`
        : `${M[date.month - 1]} ${date.day}, ${date.year}`;
    case 'month':
      if (!date.year || !date.month) return 'Date unknown';
      return `${M[date.month - 1]} ${date.year}`;
    case 'season': {
      if (!date.year || !date.season) return 'Date unknown';
      const label = SEASONS.find((s) => s.value === date.season)!.label;
      if (date.season === 'winter') {
        return `${label} ${date.year}–${String((date.year + 1) % 100).padStart(2, '0')}`;
      }
      return `${label} ${date.year}`;
    }
    case 'year':
      return date.year ? String(date.year) : 'Date unknown';
    case 'range': {
      if (!date.year || !date.endYear) return 'Date unknown';
      const [a, b] = date.year <= date.endYear ? [date.year, date.endYear] : [date.endYear, date.year];
      return a === b ? String(a) : `${a} – ${b}`;
    }
    case 'decade':
      if (date.decade == null) return 'Date unknown';
      return short ? `${Math.floor(date.decade / 10) * 10}s` : `The ${Math.floor(date.decade / 10) * 10}s`;
    case 'age': {
      if (date.age == null) return 'Date unknown';
      const span = date.ageEnd != null && date.ageEnd > date.age;
      const ageText = span ? `Ages ${date.age}–${date.ageEnd}` : `Age ${date.age}`;
      if (!birthYear) return ageText;
      const y1 = birthYear + date.age;
      const y2 = birthYear + (span ? date.ageEnd! : date.age) + 1;
      return short ? `${ageText}` : `${ageText} (${y1}–${y2})`;
    }
    case 'unknown':
    default:
      return 'Date unknown';
  }
}

/** A one-word description of how precise the date is, for badges and filters. */
export function precisionLabel(date: FuzzyDate): string {
  switch (date.precision) {
    case 'day': return 'Exact date';
    case 'month': return 'Month';
    case 'season': return 'Season';
    case 'year': return 'Year';
    case 'age': return 'Age';
    case 'range': return 'Year range';
    case 'decade': return 'Decade';
    default: return 'Unplaced';
  }
}

/** Whether the date is pinned to a specific day (and so shouldn't be dragged around). */
export const isExact = (date: FuzzyDate) => date.precision === 'day';

/**
 * Move a fuzzy date so it's filed under `targetYear`, preserving its kind of
 * precision. Used when the user drags a memory into a different year while
 * rearranging. Exact (day) dates are never moved implicitly.
 */
export function shiftToYear(date: FuzzyDate, targetYear: number, birthYear: number | null): FuzzyDate {
  const current = resolveBounds(date, birthYear);
  if (!current || date.precision === 'day') return date;
  const delta = targetYear - current.groupYear;
  if (delta === 0) return date;
  switch (date.precision) {
    case 'month':
    case 'season':
    case 'year':
      return { ...date, year: date.year! + delta };
    case 'range': {
      // If the target year is already inside the range, the range is fine as-is
      // but we narrow its start so it files under the year the user chose.
      const a = Math.min(date.year!, date.endYear!);
      const b = Math.max(date.year!, date.endYear!);
      if (targetYear >= a && targetYear <= b) return { ...date, year: targetYear, endYear: b };
      return { ...date, year: a + delta, endYear: b + delta };
    }
    case 'decade': {
      // Dropping a decade memory onto a specific year turns it into that year
      // range-wise only if it leaves the decade; inside the decade we keep it.
      const d = Math.floor(date.decade! / 10) * 10;
      if (targetYear >= d && targetYear <= d + 9) {
        return { precision: 'range', year: targetYear, endYear: d + 9, circa: date.circa };
      }
      return { ...date, decade: Math.floor(targetYear / 10) * 10 };
    }
    case 'age':
      return {
        ...date,
        age: date.age! + delta,
        ageEnd: date.ageEnd != null ? date.ageEnd + delta : undefined,
      };
    default:
      return date;
  }
}

/** Convert an ISO date (e.g. from photo EXIF) into an exact fuzzy date. */
export function fuzzyFromIso(isoDate: string): FuzzyDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  return { precision: 'day', year: +m[1], month: +m[2], day: +m[3] };
}

/** Number of whole years covered by a memory, for the "span" indicator. */
export function spanYears(bounds: DateBounds): number {
  return Number(bounds.end.slice(0, 4)) - Number(bounds.start.slice(0, 4));
}

export function currentYear(): number {
  return new Date().getFullYear();
}
