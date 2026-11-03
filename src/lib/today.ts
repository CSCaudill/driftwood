import type { Memory } from '../types';

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Word for the daily prompt card: "Today's", "Tonight's". */
export function partOfDay(date = new Date()): string {
  const h = date.getHours();
  return h >= 18 || h < 5 ? 'Tonight’s' : 'Today’s';
}

const dayIndex = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

/** Memories with an exact date that falls on this month and day in an earlier year. */
export function onThisDay(memories: Memory[], date = new Date()): Memory[] {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return memories.filter(
    (x) => x.date.precision === 'day' && x.date.month === m && x.date.day === d && (x.date.year ?? 0) < date.getFullYear() && !x.isPrivate,
  );
}

/**
 * One memory to revisit today: an "on this day" memory if there is one,
 * otherwise a placed memory with something to look at (notes or a photo),
 * favourites more often. Stable for the whole day.
 */
export function resurface(memories: Memory[], date = new Date()): { memory: Memory; onThisDay: boolean } | null {
  const otd = onThisDay(memories, date);
  if (otd.length) return { memory: otd[dayIndex(date) % otd.length], onThisDay: true };
  const pool = memories
    .filter((m) => m.groupYear != null && !m.isPrivate && (m.notes.trim() || m.photoIds.length))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  if (!pool.length) return null;
  const weighted = pool.flatMap((m) => (m.favorite ? [m, m, m] : [m]));
  return { memory: weighted[(dayIndex(date) * 7919) % weighted.length], onThisDay: false };
}
