import type { ChapterColor, Clarity, Feeling } from '../types';

export const FEELINGS: { value: Feeling; label: string; color: string }[] = [
  { value: 'joyful', label: 'Joyful', color: '#E3B341' },
  { value: 'proud', label: 'Proud', color: '#D98E5B' },
  { value: 'calm', label: 'Calm', color: '#7FA6A0' },
  { value: 'tender', label: 'Tender', color: '#C98FA0' },
  { value: 'bittersweet', label: 'Bittersweet', color: '#9A8BB8' },
  { value: 'difficult', label: 'Difficult', color: '#7D8790' },
];
export const feelingMeta = (f: Feeling | null) => FEELINGS.find((x) => x.value === f);

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
