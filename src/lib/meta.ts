import type { ChapterColor, Clarity, Feeling, MemorySource } from '../types';

export const FEELINGS: { value: Feeling; label: string; color: string }[] = [
  { value: 'joyful', label: 'Joyful', color: '#E3B341' },
  { value: 'proud', label: 'Proud', color: '#D98E5B' },
  { value: 'calm', label: 'Calm', color: '#7FA6A0' },
  { value: 'tender', label: 'Tender', color: '#C98FA0' },
  { value: 'bittersweet', label: 'Bittersweet', color: '#9A8BB8' },
  { value: 'difficult', label: 'Difficult', color: '#7D8790' },
];
export const feelingMeta = (f: Feeling | null) => FEELINGS.find((x) => x.value === f);

export const SOURCES: { value: MemorySource; label: string; description: string }[] = [
  { value: 'remembered', label: 'I remember it', description: 'You can recall it yourself, even faintly' },
  { value: 'told', label: 'I was told', description: 'Someone else told you about it' },
  { value: 'record', label: 'From a photo or video', description: 'You know it from a picture, video or document' },
  { value: 'mixed', label: 'Some of each', description: 'Part memory, part what you’ve been told or seen' },
];

/** Short label for a memory's source, or null when there's nothing to flag. */
export function sourceLabel(source: MemorySource | undefined, tellers: string[]): string | null {
  switch (source) {
    case 'told':
      return tellers.length ? `Told by ${tellers.join(', ')}` : 'Told to you';
    case 'record':
      return 'From a photo or video';
    case 'mixed':
      return tellers.length ? `Partly from ${tellers.join(', ')}` : 'Partly remembered';
    default:
      return null;
  }
}

export const CLARITY: { value: Clarity; label: string; description: string }[] = [
  { value: 'vivid', label: 'Vivid', description: 'I can see it clearly' },
  { value: 'partial', label: 'Partial', description: 'Some pieces are there' },
  { value: 'faint', label: 'Faint', description: 'Just a glimpse or a feeling' },
];

export const CHAPTER_COLORS: { value: ChapterColor; label: string }[] = [
  { value: 'sage', label: 'Sage' },
  { value: 'sky', label: 'Sky' },
  { value: 'sand', label: 'Sand' },
  { value: 'clay', label: 'Clay' },
  { value: 'rose', label: 'Rose' },
  { value: 'plum', label: 'Plum' },
];
export const chapterVar = (c: ChapterColor) => `var(--ch-${c})`;

/** Suggestions offered when describing who someone is. */
export const RELATIONSHIPS = [
  'Mom', 'Dad', 'Sister', 'Brother', 'Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Cousin',
  'Partner', 'Spouse', 'Son', 'Daughter', 'Stepparent', 'Friend', 'Best friend', 'Teacher',
  'Coach', 'Neighbor', 'Coworker', 'Pet',
];

const FAMILY = /\b(mom|mother|mum|dad|father|sister|brother|sibling|grand|aunt|uncle|cousin|niece|nephew|partner|spouse|wife|husband|son|daughter|child|step|in-law|parent|family|twin)/i;

export type Circle = 'family' | 'friends' | 'others';

/** Group a person into a circle from their relationship text. */
export function circleOf(relationship: string): Circle {
  if (FAMILY.test(relationship)) return 'family';
  if (/friend|buddy|roommate|classmate|bandmate|teammate/i.test(relationship)) return 'friends';
  return 'others';
}

export const CIRCLE_LABELS: Record<Circle, string> = {
  family: 'Family',
  friends: 'Friends',
  others: 'Others',
};
