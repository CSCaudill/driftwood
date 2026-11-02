import { db, type LifelineDB } from './db';
import { newId } from '../lib/id';
import { resolveBounds, shiftToYear } from '../lib/fuzzyDate';
import { orderSection, rankForMove } from '../lib/ordering';
import {
  DEFAULT_SETTINGS,
  type Chapter,
  type FuzzyDate,
  type Memory,
  type Photo,
  type Settings,
} from '../types';

/**
 * All writes go through this module so derived fields (sortStart, sortEnd,
 * groupYear, rank) can never drift from the memory's fuzzy date.
 */

export type MemoryDraft = Omit<
  Memory,
  'id' | 'sortStart' | 'sortEnd' | 'groupYear' | 'rank' | 'createdAt' | 'updatedAt'
>;

export function emptyDraft(partial: Partial<MemoryDraft> = {}): MemoryDraft {
  return {
    title: '',
    notes: '',
    date: { precision: 'unknown' },
    location: '',
    people: [],
    tags: [],
    feeling: null,
    clarity: 'partial',
    photoIds: [],
    favorite: false,
    isPrivate: false,
    promptId: null,
    ...partial,
  };
}

export function deriveFields(date: FuzzyDate, birthYear: number | null) {
  const b = resolveBounds(date, birthYear);
  return b
    ? { sortStart: b.start, sortEnd: b.end, groupYear: b.groupYear }
    : { sortStart: '', sortEnd: '', groupYear: null as number | null };
}

// ---------------------------------------------------------------- settings

export async function getSettings(store: LifelineDB = db): Promise<Settings> {
  const row = await store.meta.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>, store: LifelineDB = db): Promise<Settings> {
  const current = await getSettings(store);
  const next = { ...current, ...patch };
  await store.meta.put({ key: 'settings', value: next });
  // Age-based memories depend on the birth year.
  if (patch.birthYear !== undefined && patch.birthYear !== current.birthYear) {
    await recomputeDerived(next.birthYear, store);
  }
  return next;
}

async function recomputeDerived(birthYear: number | null, store: LifelineDB) {
  const all = await store.memories.toArray();
  const changed: Memory[] = [];
  for (const m of all) {
    const d = deriveFields(m.date, birthYear);
    if (d.sortStart !== m.sortStart || d.groupYear !== m.groupYear) {
      changed.push({ ...m, ...d, rank: d.groupYear === m.groupYear ? m.rank : null });
    }
  }
  if (changed.length) await store.memories.bulkPut(changed);
}

// ---------------------------------------------------------------- memories

export async function createMemory(draft: MemoryDraft, store: LifelineDB = db): Promise<Memory> {
  const { birthYear } = await getSettings(store);
  const now = Date.now();
  const memory: Memory = {
    ...draft,
    title: draft.title.trim(),
    id: newId(),
    ...deriveFields(draft.date, birthYear),
    rank: null,
    createdAt: now,
    updatedAt: now,
  };
  await store.memories.add(memory);
  return memory;
}

export async function updateMemory(id: string, patch: Partial<MemoryDraft>, store: LifelineDB = db) {
  const existing = await store.memories.get(id);
  if (!existing) throw new Error('Memory not found');
  const next: Memory = { ...existing, ...patch, updatedAt: Date.now() };
  if (patch.date) {
    const { birthYear } = await getSettings(store);
    Object.assign(next, deriveFields(patch.date, birthYear));
    // Leaving a section drops the manual position; it'll be merged by date.
    if (next.groupYear !== existing.groupYear) next.rank = null;
  }
  if (patch.title !== undefined) next.title = patch.title.trim();
  await store.memories.put(next);
  return next;
}

export async function deleteMemory(id: string, store: LifelineDB = db) {
  await store.transaction('rw', store.memories, store.photos, async () => {
    await store.photos.where('memoryId').equals(id).delete();
    await store.memories.delete(id);
  });
}

export async function toggleFavorite(id: string, store: LifelineDB = db) {
  const m = await store.memories.get(id);
  if (m) await store.memories.update(id, { favorite: !m.favorite, updatedAt: Date.now() });
}

/**
 * Move a memory to `targetIndex` inside the `targetYear` section. If the
 * memory comes from another year its fuzzy date is shifted to match. Returns
 * the previous state of every touched memory so the caller can offer Undo.
 */
export async function moveMemory(
  id: string,
  targetYear: number,
  targetIndex: number,
  store: LifelineDB = db,
): Promise<{ undo: Memory[]; moved: Memory } | null> {
  return store.transaction('rw', store.memories, store.meta, async () => {
    const { birthYear } = await getSettings(store);
    const memory = await store.memories.get(id);
    if (!memory || memory.groupYear == null) return null;

    const section = orderSection(
      (await store.memories.where('groupYear').equals(targetYear).toArray()).filter((m) => m.id !== id),
    );
    const undo: Memory[] = [{ ...memory }];
    let moved = { ...memory };

    if (memory.groupYear !== targetYear) {
      if (memory.date.precision === 'day') return null; // exact dates stay put
      const date = shiftToYear(memory.date, targetYear, birthYear);
      moved = { ...moved, date, ...deriveFields(date, birthYear) };
    }

    const updates = rankForMove(section, id, targetIndex);
    const byId = new Map(section.map((m) => [m.id, m]));
    const writes: Memory[] = [];
    for (const u of updates) {
      if (u.id === id) {
        moved = { ...moved, rank: u.rank, updatedAt: Date.now() };
        writes.push(moved);
      } else {
        const m = byId.get(u.id)!;
        undo.push({ ...m });
        writes.push({ ...m, rank: u.rank });
      }
    }
    await store.memories.bulkPut(writes);
    return { undo, moved };
  });
}

export async function restoreMemories(snapshots: Memory[], store: LifelineDB = db) {
  await store.memories.bulkPut(snapshots);
}

/** Clear manual ordering for one year (back to chronological). */
export async function resetSectionOrder(year: number, store: LifelineDB = db) {
  const items = await store.memories.where('groupYear').equals(year).toArray();
  await store.memories.bulkPut(items.map((m) => ({ ...m, rank: null })));
}

// ---------------------------------------------------------------- photos

export async function savePhotos(
  memoryId: string,
  photos: Omit<Photo, 'id' | 'memoryId' | 'createdAt'>[],
  store: LifelineDB = db,
): Promise<string[]> {
  const rows: Photo[] = photos.map((p) => ({ ...p, id: newId(), memoryId, createdAt: Date.now() }));
  await store.photos.bulkAdd(rows);
  return rows.map((r) => r.id);
}

export async function deletePhotos(ids: string[], store: LifelineDB = db) {
  await store.photos.bulkDelete(ids);
}

/** Remove photos attached to a memory that are no longer referenced by it. */
export async function prunePhotos(memoryId: string, keep: string[], store: LifelineDB = db) {
  const keepSet = new Set(keep);
  const ids = (await store.photos.where('memoryId').equals(memoryId).primaryKeys()).filter(
    (id) => !keepSet.has(id as string),
  );
  if (ids.length) await store.photos.bulkDelete(ids as string[]);
}

// ---------------------------------------------------------------- chapters

export async function saveChapter(
  chapter: Omit<Chapter, 'id' | 'createdAt'> & { id?: string },
  store: LifelineDB = db,
): Promise<Chapter> {
  const existing = chapter.id ? await store.chapters.get(chapter.id) : undefined;
  const [startYear, endYear] =
    chapter.startYear <= chapter.endYear
      ? [chapter.startYear, chapter.endYear]
      : [chapter.endYear, chapter.startYear];
  const row: Chapter = {
    ...chapter,
    startYear,
    endYear,
    title: chapter.title.trim(),
    id: chapter.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await store.chapters.put(row);
  return row;
}

export async function deleteChapter(id: string, store: LifelineDB = db) {
  await store.chapters.delete(id);
}

/** Starter chapters based on a birth year — the user can rename or delete them. */
export function suggestedChapters(birthYear: number, thisYear = new Date().getFullYear()) {
  const stages: [string, number, number, Chapter['color']][] = [
    ['Early childhood', 0, 5, 'sand'],
    ['Grade school', 6, 11, 'sky'],
    ['Middle school', 12, 13, 'sage'],
    ['High school', 14, 17, 'clay'],
    ['Early adulthood', 18, 24, 'plum'],
  ];
  return stages
    .map(([title, a, b, color]) => ({
      title,
      startYear: birthYear + a,
      endYear: Math.min(birthYear + b, thisYear),
      color,
    }))
    .filter((c) => c.startYear <= thisYear);
}

export async function wipeEverything(store: LifelineDB = db) {
  await store.transaction('rw', [store.memories, store.photos, store.chapters, store.meta], async () => {
    await Promise.all([store.memories.clear(), store.photos.clear(), store.chapters.clear(), store.meta.clear()]);
  });
}
