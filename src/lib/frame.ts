import type { Anchor, AnchorKind, ChapterColor } from '../types';

/**
 * The life frame
 * --------------
 * Memories are easier to place, and easier to recall, against a scaffold of
 * known reference points: where you lived, which school you were in, when you
 * moved. Survey researchers use the same idea (the "life history calendar").
 * This module suggests that scaffold from a birth year and answers "what was
 * going on in year X?" for the timeline and the gap prompts.
 *
 * School stages and grades follow the U.S. system (kindergarten at 5).
 */

export const ANCHOR_KINDS: { kind: AnchorKind; label: string; plural: string; hint: string }[] = [
  { kind: 'stage', label: 'Stage of life', plural: 'Stages of life', hint: 'School years, a city, a season of life' },
  { kind: 'home', label: 'Home', plural: 'Homes', hint: 'Houses, apartments, towns you lived in' },
  { kind: 'work', label: 'Work', plural: 'Work', hint: 'Jobs, roles, volunteering' },
  { kind: 'relationship', label: 'Relationship', plural: 'Relationships', hint: 'Partners, close friendships, family changes' },
  { kind: 'milestone', label: 'Milestone', plural: 'Milestones', hint: 'Single moments: a move, a graduation, a birth' },
];

export const kindMeta = (k: AnchorKind) => ANCHOR_KINDS.find((x) => x.kind === k)!;

export interface AnchorSuggestion {
  /** Stable key so dismissed suggestions stay dismissed. */
  key: string;
  kind: AnchorKind;
  title: string;
  startYear: number;
  endYear: number;
  color: ChapterColor;
  /** Shown under the suggestion, e.g. "Ages 5–10". */
  note: string;
}

const STAGES: [key: string, title: string, fromAge: number, toAge: number, color: ChapterColor][] = [
  ['stage-early', 'Early childhood', 0, 4, 'sand'],
  ['stage-elementary', 'Elementary school', 5, 10, 'sky'],
  ['stage-middle', 'Middle school', 11, 13, 'sage'],
  ['stage-high', 'High school', 14, 17, 'clay'],
  ['stage-after-high', 'After high school', 18, 21, 'plum'],
  ['stage-20s', 'Your twenties', 22, 29, 'rose'],
];

const DECADE_COLORS: ChapterColor[] = ['sage', 'sky', 'sand', 'clay', 'plum', 'rose'];

const MILESTONES: [key: string, title: string, age: number][] = [
  ['ms-kindergarten', 'Started kindergarten', 5],
  ['ms-high-school', 'Started high school', 14],
  ['ms-drivers-license', 'Learned to drive', 16],
  ['ms-graduated', 'Finished high school', 18],
];

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Suggested reference points for someone born in `birthYear`, leaving out
 * anything already in their frame (matched by title) or dismissed.
 */
export function suggestFrame(
  birthYear: number,
  existing: Pick<Anchor, 'title' | 'kind'>[],
  dismissed: string[] = [],
  thisYear = new Date().getFullYear(),
): AnchorSuggestion[] {
  const have = new Set(existing.map((a) => norm(a.title)));
  const out: AnchorSuggestion[] = [];
  const currentAge = thisYear - birthYear;

  for (const [key, title, a, b, color] of STAGES) {
    if (birthYear + a > thisYear) continue;
    out.push({
      key,
      kind: 'stage',
      title,
      startYear: birthYear + a,
      endYear: Math.min(birthYear + b, thisYear),
      color,
      note: `Ages ${a}–${Math.min(b, currentAge)}`,
    });
  }
  // Decades after the twenties.
  for (let d = 30, i = 0; d <= currentAge; d += 10, i++) {
    const word = ['thirties', 'forties', 'fifties', 'sixties', 'seventies', 'eighties', 'nineties'][i];
    if (!word) break;
    out.push({
      key: `stage-${d}s`,
      kind: 'stage',
      title: `Your ${word}`,
      startYear: birthYear + d,
      endYear: Math.min(birthYear + d + 9, thisYear),
      color: DECADE_COLORS[i % DECADE_COLORS.length],
      note: `Ages ${d}–${Math.min(d + 9, currentAge)}`,
    });
  }
  for (const [key, title, age] of MILESTONES) {
    if (birthYear + age > thisYear) continue;
    out.push({
      key,
      kind: 'milestone',
      title,
      startYear: birthYear + age,
      endYear: birthYear + age,
      color: 'sand',
      note: `Usually around age ${age}. Adjust the year if yours was different.`,
    });
  }
  return out.filter((s) => !have.has(norm(s.title)) && !dismissed.includes(s.key));
}

// ------------------------------------------------------------------ grades

function gradeName(g: number, long: boolean): string {
  if (g === -1) return 'Pre-K';
  if (g === 0) return long ? 'Kindergarten' : 'K';
  const suffix = g % 10 === 1 && g !== 11 ? 'st' : g % 10 === 2 && g !== 12 ? 'nd' : g % 10 === 3 && g !== 13 ? 'rd' : 'th';
  return long ? `${g}${suffix} grade` : `${g}${suffix}`;
}

/**
 * The school grade(s) someone was in during a calendar year. A calendar year
 * spans the end of one school year and the start of the next, so most years
 * show two: "2nd–3rd grade". Returns null outside school age.
 */
export function gradeLabel(year: number, birthYear: number | null): string | null {
  if (birthYear == null) return null;
  const age = year - birthYear;
  const spring = age - 6; // grade finishing in spring
  const fall = age - 5; // grade starting in fall
  const valid = (g: number) => g >= -1 && g <= 12;
  if (valid(spring) && valid(fall)) {
    if (fall === 0) return 'Pre-K–Kindergarten';
    return `${gradeName(spring, false)}–${gradeName(fall, true)}`;
  }
  if (valid(spring)) return gradeName(spring, true);
  if (valid(fall)) return gradeName(fall, true);
  return null;
}

// ------------------------------------------------------------------ context

export interface YearContext {
  /** Homes, work and relationships that cover this year. */
  ongoing: Anchor[];
  /** Milestones that happened this year. */
  milestones: Anchor[];
  grade: string | null;
}

export function contextForYear(year: number, anchors: Anchor[], birthYear: number | null, showGrades = true): YearContext {
  return {
    ongoing: anchors.filter(
      (a) => a.kind !== 'stage' && a.kind !== 'milestone' && year >= a.startYear && year <= a.endYear,
    ),
    milestones: anchors.filter((a) => a.kind === 'milestone' && a.startYear === year),
    grade: showGrades ? gradeLabel(year, birthYear) : null,
  };
}

/** Context for a span of years (a gap): anything that overlaps it. */
export function contextForRange(from: number, to: number, anchors: Anchor[]): { ongoing: Anchor[]; milestones: Anchor[] } {
  const overlaps = (a: Anchor) => a.startYear <= to && a.endYear >= from;
  return {
    ongoing: anchors.filter((a) => a.kind !== 'stage' && a.kind !== 'milestone' && overlaps(a)),
    milestones: anchors.filter((a) => a.kind === 'milestone' && overlaps(a)),
  };
}

/** The stage (coloured spine band) for a year: the shortest stage covering it. */
export function stageFor(anchors: Anchor[], year: number): Anchor | undefined {
  return anchors
    .filter((a) => a.kind === 'stage' && year >= a.startYear && year <= a.endYear)
    .sort((a, b) => a.endYear - a.startYear - (b.endYear - b.startYear))[0];
}

/** Short label for an anchor, using its detail when it has one: "Maple Street house". */
export function anchorLabel(a: Pick<Anchor, 'title' | 'detail'>): string {
  return a.detail ? `${a.title}, ${a.detail}` : a.title;
}
