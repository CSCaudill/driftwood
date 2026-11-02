/**
 * Reflection prompts. Memory often comes back through specific sensory or
 * relational cues rather than "what happened in 1994?", so prompts are
 * concrete and gentle. `ages` lets us suggest an age range for the date.
 */

export type PromptTheme = 'places' | 'people' | 'senses' | 'firsts' | 'everyday' | 'milestones';

export interface ReflectionPrompt {
  id: string;
  text: string;
  theme: PromptTheme;
  /** Suggested age range the memory likely comes from. */
  ages?: [number, number];
}

export const PROMPT_THEMES: Record<PromptTheme, string> = {
  places: 'Places',
  people: 'People',
  senses: 'Senses',
  firsts: 'Firsts',
  everyday: 'Everyday life',
  milestones: 'Milestones',
};

export const PROMPTS: ReflectionPrompt[] = [
  { id: 'p-home-1', theme: 'places', text: 'Picture the first home you remember. What did your bedroom look like?', ages: [3, 8] },
  { id: 'p-home-2', theme: 'places', text: 'Walk through the front door of a childhood home. What do you see first?', ages: [4, 12] },
  { id: 'p-school-1', theme: 'places', text: 'What do you remember about your first school building or classroom?', ages: [5, 7] },
  { id: 'p-place-1', theme: 'places', text: 'Was there a place you went to be alone as a kid?', ages: [6, 14] },
  { id: 'p-place-2', theme: 'places', text: 'Think of a trip in the car. Where were you going, and who was there?' },
  { id: 'p-place-3', theme: 'places', text: 'A grandparent’s or relative’s house — what did it smell like?' },
  { id: 'p-place-4', theme: 'places', text: 'The first place you lived on your own. How did it feel to walk in?', ages: [17, 26] },

  { id: 'p-ppl-1', theme: 'people', text: 'A teacher you still think about. What did they say or do?', ages: [5, 18] },
  { id: 'p-ppl-2', theme: 'people', text: 'Your best friend at age ten. What did you two do together?', ages: [9, 11] },
  { id: 'p-ppl-3', theme: 'people', text: 'A neighbor you remember. What were they like?' },
  { id: 'p-ppl-4', theme: 'people', text: 'A time someone was unexpectedly kind to you.' },
  { id: 'p-ppl-5', theme: 'people', text: 'A pet you had, or wished you had.', ages: [4, 16] },
  { id: 'p-ppl-6', theme: 'people', text: 'Something a parent or caregiver used to say all the time.' },
  { id: 'p-ppl-7', theme: 'people', text: 'Someone you lost touch with. What’s one moment you shared?' },

  { id: 'p-sense-1', theme: 'senses', text: 'A song that instantly takes you back. Where are you when you hear it?' },
  { id: 'p-sense-2', theme: 'senses', text: 'A meal that someone made for you, often. Who cooked it?' },
  { id: 'p-sense-3', theme: 'senses', text: 'A smell you can still recall — rain, a kitchen, a perfume.' },
  { id: 'p-sense-4', theme: 'senses', text: 'A toy, piece of clothing, or object you loved.', ages: [3, 12] },
  { id: 'p-sense-5', theme: 'senses', text: 'A TV show or movie you watched over and over.' },
  { id: 'p-sense-6', theme: 'senses', text: 'The weather on a day you remember well — snow, heat, a storm.' },

  { id: 'p-first-1', theme: 'firsts', text: 'Your first job. What was your first day like?', ages: [14, 22] },
  { id: 'p-first-2', theme: 'firsts', text: 'Learning to ride a bike, swim, or drive.' },
  { id: 'p-first-3', theme: 'firsts', text: 'The first concert, game, or big event you went to.' },
  { id: 'p-first-4', theme: 'firsts', text: 'The first time you traveled somewhere new.' },
  { id: 'p-first-5', theme: 'firsts', text: 'A first day — of school, of a job, in a new city.' },

  { id: 'p-day-1', theme: 'everyday', text: 'What did an ordinary Saturday look like when you were a kid?', ages: [6, 12] },
  { id: 'p-day-2', theme: 'everyday', text: 'How did you get to school? Who did you see on the way?', ages: [5, 17] },
  { id: 'p-day-3', theme: 'everyday', text: 'A holiday tradition your family kept.' },
  { id: 'p-day-4', theme: 'everyday', text: 'Something you collected or were obsessed with for a while.' },
  { id: 'p-day-5', theme: 'everyday', text: 'What you did after school, most days.', ages: [8, 17] },

  { id: 'p-mile-1', theme: 'milestones', text: 'A moment you felt proud of yourself.' },
  { id: 'p-mile-2', theme: 'milestones', text: 'A time you moved — what did you leave behind?' },
  { id: 'p-mile-3', theme: 'milestones', text: 'A graduation, ceremony, or celebration.' },
  { id: 'p-mile-4', theme: 'milestones', text: 'A decision that changed the direction of your life.' },
  { id: 'p-mile-5', theme: 'milestones', text: 'A hard season that you came through.' },
];

export const promptById = (id: string | null | undefined) => PROMPTS.find((p) => p.id === id);

/** A stable "prompt of the day" with an optional offset for "show another". */
export function dailyPrompt(offset = 0, date = new Date()): ReflectionPrompt {
  const day = Math.floor(date.getTime() / 86_400_000);
  // Multiply by a prime so consecutive days don't walk the list in order.
  const idx = (((day * 7919 + offset) % PROMPTS.length) + PROMPTS.length) % PROMPTS.length;
  return PROMPTS[idx];
}

/**
 * Pick the next prompt for the Reflect screen: matching the chosen theme,
 * skipping ones the person dismissed, preferring ones they haven't answered
 * or seen recently.
 */
export function pickPrompt(opts: {
  theme: PromptTheme | null;
  skipped: string[];
  answered: Set<string>;
  recent: string[];
  exclude?: string | null;
  random?: () => number;
}): ReflectionPrompt | null {
  const rand = opts.random ?? Math.random;
  const base = PROMPTS.filter((p) => (!opts.theme || p.theme === opts.theme) && !opts.skipped.includes(p.id));
  if (base.length === 0) return null;
  const tiers = [
    base.filter((p) => !opts.answered.has(p.id) && !opts.recent.includes(p.id) && p.id !== opts.exclude),
    base.filter((p) => !opts.answered.has(p.id) && p.id !== opts.exclude),
    base.filter((p) => p.id !== opts.exclude),
    base,
  ];
  const pool = tiers.find((t) => t.length > 0)!;
  return pool[Math.floor(rand() * pool.length)];
}

/** A short title suggestion from the first sentence of free writing. */
export function suggestTitle(text: string, max = 60): string {
  const first = text.trim().split(/(?<=[.!?])\s|\n/)[0]?.trim() ?? '';
  const clean = first.replace(/[.!?]+$/, '');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : max).trim() + '…';
}
