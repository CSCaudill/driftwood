import type { Anchor, FuzzyDate, Memory, Person } from '../types';
import { anchorLabel, contextForRange, gradeLabel } from './frame';
import type { PromptTheme, ReflectionPrompt } from './prompts';

/**
 * Prompts for an empty stretch of the timeline.
 *
 * Recall works through cues, so these are built from what we already know
 * about that stretch: the person's age, where they lived, school, work,
 * people from the memories on either side, and those memories themselves.
 *
 * Design rule: prompts ask open questions and never suggest what happened.
 * ("Who did you sit with at lunch?" not "You were lonely at lunch.")
 */

export interface GapPrompt extends ReflectionPrompt {
  /** Why this prompt was chosen, shown under it: "Because you lived on Maple Street". */
  because?: string;
  /** Suggested date for a memory written from this prompt. */
  date: FuzzyDate;
}

export interface GapContext {
  from: number;
  to: number;
  birthYear: number | null;
  anchors: Anchor[];
  memories: Memory[];
  people: Map<string, Person>;
}

type Band = 'early' | 'grade' | 'preteen' | 'teen' | 'young' | 'adult';

function bandFor(age: number): Band {
  if (age <= 5) return 'early';
  if (age <= 10) return 'grade';
  if (age <= 13) return 'preteen';
  if (age <= 17) return 'teen';
  if (age <= 24) return 'young';
  return 'adult';
}

/** Questions that fit a stage of life. {age} and {span} are filled in. */
const BY_BAND: Record<Band, [PromptTheme, string][]> = {
  early: [
    ['senses', 'What is the earliest thing you can picture from around {span}? A room, a color, a sound is enough.'],
    ['places', 'Where did you sleep when you were little? What was next to the bed?'],
    ['people', 'Who looked after you during the day when you were {age}?'],
    ['senses', 'Was there a toy, blanket or object you carried everywhere?'],
    ['everyday', 'What did a bath time, bedtime or mealtime look like back then?'],
    ['places', 'Was there a yard, park or street where you played?'],
  ],
  grade: [
    ['people', 'Picture a classroom from {span}. Who was your teacher? Where did you sit?'],
    ['everyday', 'What did you do at recess when you were {age}?'],
    ['people', 'Who did you play with after school around age {age}?'],
    ['everyday', 'What did you eat for lunch at school, or bring from home?'],
    ['senses', 'Was there a show you watched, a game you played or a book you read over and over around age {age}?'],
    ['milestones', 'Think of a birthday around age {age}. Where were you, and who was there?'],
    ['everyday', 'Where did you go in the summers around {span}?'],
    ['firsts', 'Was there something you learned to do around age {age}: ride a bike, swim, tie your shoes?'],
  ],
  preteen: [
    ['people', 'Who were your closest friends around age {age}? Where did you hang out?'],
    ['places', 'What did your bedroom look like around {span}? What was on the walls?'],
    ['everyday', 'What did you do on a typical weekend at {age}?'],
    ['senses', 'What music were you listening to around age {age}, and how did you listen to it?'],
    ['people', 'Was there a teacher, coach or adult from around {span} who stands out?'],
    ['firsts', 'Was there a first from around age {age}: a sleepover, a dance, a trip without your parents?'],
  ],
  teen: [
    ['people', 'Who did you spend most of your time with at {age}?'],
    ['everyday', 'What did you do after school around {span}: a sport, a job, a club, nothing at all?'],
    ['firsts', 'Was there a first job, first car or first concert around age {age}?'],
    ['places', 'Where did you go when you wanted to get out of the house at {age}?'],
    ['senses', 'Think of a song from around {span}. Where are you when you hear it?'],
    ['milestones', 'Was there a decision or a moment around age {age} that changed something for you?'],
  ],
  young: [
    ['places', 'Where were you living around {span}? Walk in the front door. What do you see?'],
    ['everyday', 'What did an ordinary weekday look like when you were {age}?'],
    ['people', 'Who were the people you saw most often around {span}?'],
    ['firsts', 'Was there a first from around {span}: living on your own, a first real job, a trip?'],
    ['milestones', 'What were you working toward or worried about at {age}?'],
    ['everyday', 'How did you spend your money around {span}? What felt like a treat?'],
  ],
  adult: [
    ['places', 'Where were you living around {span}? What did the kitchen look like?'],
    ['everyday', 'What did a normal week look like around {span}?'],
    ['people', 'Who were you closest to around {span}?'],
    ['milestones', 'What was taking up most of your energy around {span}?'],
    ['everyday', 'Was there a trip, a hobby or a routine from around {span} you remember?'],
    ['senses', 'Is there a smell, song or place that takes you straight back to {span}?'],
  ],
};

const HOME: string[] = [
  'At {label}: picture the kitchen. Who is usually in it?',
  'What could you see from a window at {label}?',
  'How did you get from {label} to school or work, and what did you pass on the way?',
  'Was there a neighbor or a spot nearby you remember from {label}?',
];
const STAGE_SCHOOL: string[] = [
  'At {label}: who was a teacher you remember, and what was their classroom like?',
  'Where did you eat lunch at {label}, and who with?',
  'Was there a field trip, show or assembly from {label} you remember?',
];
const WORK: string[] = [
  'What was a normal day at {label} like? Start with arriving.',
  'Who did you work with at {label}? Is there one conversation you remember?',
];
const RELATIONSHIP: string[] = [
  'What did you and {label} do on an ordinary day together?',
  'Is there one place you associate with {label}?',
];
const MILESTONE: string[] = [
  'What do you remember about the time around "{label}"? What came right before it?',
  'How did things change after "{label}"?',
];

// Deterministic hash so the same gap always produces the same prompt ids
// (drafts and "answered" state survive a reload).
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export function spanLabel(from: number, to: number, birthYear: number | null): string {
  const years = from === to ? String(from) : `${from}–${to}`;
  if (birthYear == null) return years;
  const a = from - birthYear;
  const b = to - birthYear;
  if (a < 0) return years;
  return a === b ? `age ${a} (${years})` : `ages ${a}–${b} (${years})`;
}

/** Build prompts for the years `from`–`to`, most specific first. */
export function generateGapPrompts(ctx: GapContext): GapPrompt[] {
  const { from, to, birthYear, anchors, memories, people } = ctx;
  const out: GapPrompt[] = [];
  const add = (p: Omit<GapPrompt, 'id'>, seed: string) => {
    const id = `gap-${from}-${to}-${hash(seed + p.text)}`;
    if (!out.some((o) => o.id === id)) out.push({ ...p, id });
  };
  const rangeDate: FuzzyDate =
    from === to ? { precision: 'year', year: from } : { precision: 'range', year: from, endYear: to };
  const midAge = birthYear != null ? Math.round((from + to) / 2) - birthYear : null;
  const ages: [number, number] | undefined =
    birthYear != null && from - birthYear >= 0 ? [from - birthYear, to - birthYear] : undefined;
  const ageDate: FuzzyDate =
    ages ? (ages[0] === ages[1] ? { precision: 'age', age: ages[0] } : { precision: 'age', age: ages[0], ageEnd: ages[1] }) : rangeDate;
  const span = spanLabel(from, to, birthYear);
  const vars = { span: from === to ? String(from) : `${from}–${to}`, age: midAge != null ? String(midAge) : '' };

  // 1. Bridges from the memories on either side of the gap.
  const placed = memories.filter((m) => m.groupYear != null);
  const before = placed.filter((m) => m.groupYear! < from).sort((a, b) => b.sortStart.localeCompare(a.sortStart))[0];
  const after = placed.filter((m) => m.groupYear! > to).sort((a, b) => a.sortStart.localeCompare(b.sortStart))[0];
  if (before) {
    add({ theme: 'milestones', text: `Just before this stretch you remember "${before.title}". What happened after that?`, because: `Follows "${before.title}"`, date: rangeDate, ages }, 'before');
  }
  if (after) {
    add({ theme: 'milestones', text: `Right after this stretch comes "${after.title}". What led up to it?`, because: `Leads into "${after.title}"`, date: rangeDate, ages }, 'after');
  }

  // 2. The life frame: homes, school, work, relationships, milestones.
  const { ongoing, milestones } = contextForRange(from, to, anchors);
  const stages = anchors.filter((a) => a.kind === 'stage' && a.startYear <= to && a.endYear >= from);
  for (const a of ongoing) {
    const label = a.title;
    const bank = a.kind === 'home' ? HOME : a.kind === 'work' ? WORK : RELATIONSHIP;
    bank.forEach((t) =>
      add({ theme: a.kind === 'home' ? 'places' : 'people', text: fill(t, { label }), because: `${a.kind === 'home' ? 'You lived at' : a.kind === 'work' ? 'You worked at' : 'You were with'} ${anchorLabel(a)}`, date: rangeDate, ages }, a.id),
    );
  }
  for (const a of stages) {
    if (/school|kindergarten|college/i.test(a.title) || a.detail) {
      const label = a.detail || a.title.toLowerCase();
      STAGE_SCHOOL.forEach((t) => add({ theme: 'places', text: fill(t, { label }), because: `During ${a.title.toLowerCase()}`, date: rangeDate, ages }, a.id));
    }
  }
  for (const m of milestones) {
    MILESTONE.forEach((t) => add({ theme: 'milestones', text: fill(t, { label: m.title }), because: `${m.title}, ${m.startYear}`, date: { precision: 'year', year: m.startYear }, ages }, m.id));
  }

  // 3. People from the memories nearest the gap.
  const nearby = placed
    .filter((m) => m.groupYear! >= from - 3 && m.groupYear! <= to + 3)
    .flatMap((m) => m.personIds.map((id) => [id, m] as const));
  const seen = new Set<string>();
  for (const [id, m] of nearby) {
    const p = people.get(id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    add({ theme: 'people', text: `You remember ${p.name} from ${m.groupYear}. What else did you two do around ${vars.span}?`, because: `${p.name} appears in "${m.title}"`, date: rangeDate, ages }, id);
    if (seen.size >= 3) break;
  }

  // Someone else may remember this stretch. (Their account is labelled as
  // "told", never merged into what you remember yourself.)
  add({ theme: 'people', text: `Who else was around in ${vars.span}? Is there someone you could ask about those years?`, because: 'Someone else may remember', date: rangeDate, ages }, 'ask');

  // 4. Stage-of-life questions for the ages in the gap.
  if (midAge != null && midAge >= 0) {
    const bands = new Set([bandFor(from - birthYear!), bandFor(midAge), bandFor(to - birthYear!)]);
    for (const band of bands) {
      for (const [theme, t] of BY_BAND[band]) add({ theme, text: fill(t, vars), because: `Ages ${span.replace(/^ages? /, '')}`, date: ageDate, ages }, band);
    }
    const grade = gradeLabel(Math.round((from + to) / 2), birthYear);
    if (grade) {
      add({ theme: 'people', text: `In ${grade.toLowerCase()}, who was your teacher? Picture their desk.`, because: grade, date: ageDate, ages }, 'grade');
    }
  } else {
    // No birth year: fall back to the general adult bank, phrased by year.
    for (const [theme, t] of BY_BAND.adult) add({ theme, text: fill(t, vars), date: rangeDate }, 'adult');
  }

  return out;
}

/** Years with no placed memories between birth (or the first memory) and now, as spans. */
export function lifeGaps(memories: Memory[], birthYear: number | null, thisYear = new Date().getFullYear()): [number, number][] {
  const years = new Set(memories.filter((m) => m.groupYear != null).map((m) => m.groupYear!));
  const start = birthYear ?? Math.min(...years);
  if (!Number.isFinite(start)) return [];
  const gaps: [number, number][] = [];
  let runStart: number | null = null;
  for (let y = start; y <= thisYear; y++) {
    if (!years.has(y)) runStart ??= y;
    else if (runStart != null) {
      gaps.push([runStart, y - 1]);
      runStart = null;
    }
  }
  if (runStart != null) gaps.push([runStart, thisYear]);
  return gaps;
}

/** Age boundaries where one stage of life hands over to the next. */
const STAGE_STARTS = [0, 5, 11, 14, 18, 22, 30, 40, 50, 60, 70, 80, 90];

/** Split a long gap at stage boundaries so each piece is something you can focus on. */
export function splitByStage(from: number, to: number, birthYear: number | null): [number, number][] {
  if (birthYear == null) {
    const out: [number, number][] = [];
    for (let y = from; y <= to; y += 5) out.push([y, Math.min(y + 4, to)]);
    return out;
  }
  const cuts = STAGE_STARTS.map((a) => birthYear + a).filter((y) => y > from && y <= to);
  const out: [number, number][] = [];
  let start = from;
  for (const c of cuts) {
    out.push([start, c - 1]);
    start = c;
  }
  out.push([start, to]);
  return out;
}

/**
 * The stretch most worth focusing on: the longest empty piece of a single
 * stage of life, preferring childhood and teenage years (which people most
 * often want to fill in) over recent ones, and over infancy.
 */
export function biggestGap(memories: Memory[], birthYear: number | null, thisYear = new Date().getFullYear()): [number, number] | null {
  const pieces = lifeGaps(memories, birthYear, thisYear)
    // The current year being empty isn't a "gap" worth pointing out.
    .map(([a, b]) => [a, Math.min(b, thisYear - 1)] as [number, number])
    .filter(([a, b]) => b >= a)
    .flatMap(([a, b]) => splitByStage(a, b, birthYear));
  if (!pieces.length) return null;
  const score = ([a, b]: [number, number]) => {
    const len = b - a + 1;
    const age = birthYear != null ? (a + b) / 2 - birthYear : 30;
    // Few people recall much before age 3 or 4 (childhood amnesia), so don't lead with infancy.
    const weight = age < 4 ? 0.5 : age <= 18 ? 1.5 : 1;
    return len * weight;
  };
  return [...pieces].sort((x, y) => score(y) - score(x) || x[0] - y[0])[0];
}
