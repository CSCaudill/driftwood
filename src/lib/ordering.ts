import type { Memory } from '../types';

/**
 * Ordering model
 * --------------
 * Memories are grouped into year sections. Within a section the default order
 * is chronological (start date, then narrower spans first). When the user
 * rearranges a section, every memory in it receives a numeric `rank`, and the
 * section is ordered by rank from then on. New or re-dated memories that land
 * in a ranked section without a rank are merged in by date, so manual work is
 * never thrown away.
 */

export const RANK_STEP = 1024;

type Orderable = Pick<Memory, 'id' | 'sortStart' | 'sortEnd' | 'rank' | 'createdAt'>;

export function byDate(a: Orderable, b: Orderable): number {
  if (a.sortStart !== b.sortStart) return a.sortStart < b.sortStart ? -1 : 1;
  // Narrower spans before wider ones that start on the same day.
  if (a.sortEnd !== b.sortEnd) return a.sortEnd < b.sortEnd ? -1 : 1;
  return a.createdAt - b.createdAt;
}

/** Order the memories of a single year section. */
export function orderSection<T extends Orderable>(items: T[]): T[] {
  const ranked = items.filter((m) => m.rank != null).sort((a, b) => a.rank! - b.rank! || byDate(a, b));
  const unranked = items.filter((m) => m.rank == null).sort(byDate);
  if (ranked.length === 0) return unranked;
  if (unranked.length === 0) return ranked;

  // Merge: each unranked memory goes before the first ranked memory that
  // starts later than it does.
  const out: T[] = [];
  let u = 0;
  for (const r of ranked) {
    while (u < unranked.length && byDate(unranked[u], r) < 0) out.push(unranked[u++]);
    out.push(r);
  }
  while (u < unranked.length) out.push(unranked[u++]);
  return out;
}

export interface YearSection<T> {
  year: number;
  items: T[];
}

/** Group placed memories into ordered year sections (ascending). */
export function buildSections<T extends Orderable & { groupYear: number | null }>(
  memories: T[],
): YearSection<T>[] {
  const map = new Map<number, T[]>();
  for (const m of memories) {
    if (m.groupYear == null) continue;
    const list = map.get(m.groupYear);
    if (list) list.push(m);
    else map.set(m.groupYear, [m]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, items]) => ({ year, items: orderSection(items) }));
}

/** Evenly spaced ranks for an ordered list. */
export function denseRanks(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, (i + 1) * RANK_STEP]));
}

export interface RankUpdate {
  id: string;
  rank: number;
}

/**
 * Compute the rank updates needed to put `movedId` at `targetIndex` inside a
 * section whose current (already ordered) ids are `sectionIds`. `sectionIds`
 * must NOT include `movedId` if it's coming from another section; if it does
 * include it, it's removed first.
 *
 * Returns every rank that needs writing. If the section was never ranked, the
 * whole section is ranked densely (one write per memory) so the result is
 * stable.
 */
export function rankForMove(
  section: Orderable[],
  movedId: string,
  targetIndex: number,
): RankUpdate[] {
  const others = section.filter((m) => m.id !== movedId);
  const idx = Math.max(0, Math.min(targetIndex, others.length));
  const allRanked = others.every((m) => m.rank != null);

  if (allRanked && others.length > 0) {
    const prev = others[idx - 1]?.rank ?? null;
    const next = others[idx]?.rank ?? null;
    let rank: number;
    if (prev == null && next == null) rank = RANK_STEP;
    else if (prev == null) rank = next! - RANK_STEP;
    else if (next == null) rank = prev + RANK_STEP;
    else rank = (prev + next) / 2;

    // Fall back to a dense re-rank if we've run out of room between neighbours.
    const tooTight = prev != null && next != null && (next - prev) < 1e-6;
    if (!tooTight) return [{ id: movedId, rank }];
  }

  const ids = others.map((m) => m.id);
  ids.splice(idx, 0, movedId);
  return [...denseRanks(ids)].map(([id, rank]) => ({ id, rank }));
}

/**
 * Years between the first and last placed memory that contain nothing yet.
 * Consecutive empty years are collapsed into spans: [[1996, 1999], [2003, 2003]].
 */
export function findGaps(years: number[], minSpan = 1): [number, number][] {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const gaps: [number, number][] = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1] + 1;
    const to = sorted[i] - 1;
    if (to - from + 1 >= minSpan) gaps.push([from, to]);
  }
  return gaps;
}
