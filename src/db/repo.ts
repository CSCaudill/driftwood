import { db, type DriftwoodDB } from './db';
import { newId } from '../lib/id';
import { resolveBounds, shiftToYear } from '../lib/fuzzyDate';
import { orderSection, rankForMove } from '../lib/ordering';
import { suggestFrame } from '../lib/frame';
import {
  DEFAULT_SETTINGS,
  type Chapter,
  type ChapterColor,
  type FuzzyDate,
  type Memory,
  type Person,
  type Photo,
  type Recording,
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
    personIds: [],
    tags: [],
    feeling: null,
    clarity: 'partial',
    source: 'remembered',
    sourcePersonIds: [],
    photoIds: [],
    favorite: false,
    isPrivate: false,
    promptId: null,
    promptText: null,
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

export async function getSettings(store: DriftwoodDB = db): Promise<Settings> {
  const row = await store.meta.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>, store: DriftwoodDB = db): Promise<Settings> {
  const current = await getSettings(store);
  const next = { ...current, ...patch };
  await store.meta.put({ key: 'settings', value: next });
  // Age-based memories depend on the birth year.
  if (patch.birthYear !== undefined && patch.birthYear !== current.birthYear) {
    await recomputeDerived(next.birthYear, store);
  }
  return next;
}

async function recomputeDerived(birthYear: number | null, store: DriftwoodDB) {
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

export async function createMemory(draft: MemoryDraft, store: DriftwoodDB = db): Promise<Memory> {
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

export async function updateMemory(id: string, patch: Partial<MemoryDraft>, store: DriftwoodDB = db) {
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

export async function deleteMemory(id: string, store: DriftwoodDB = db) {
  await store.transaction('rw', store.memories, store.photos, store.recordings, async () => {
    await store.photos.where('memoryId').equals(id).delete();
    await store.recordings.where('memoryId').equals(id).delete();
    await store.memories.delete(id);
  });
}

export async function toggleFavorite(id: string, store: DriftwoodDB = db) {
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
  store: DriftwoodDB = db,
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

export async function restoreMemories(snapshots: Memory[], store: DriftwoodDB = db) {
  await store.memories.bulkPut(snapshots);
}

/** Clear manual ordering for one year (back to chronological). */
export async function resetSectionOrder(year: number, store: DriftwoodDB = db) {
  const items = await store.memories.where('groupYear').equals(year).toArray();
  await store.memories.bulkPut(items.map((m) => ({ ...m, rank: null })));
}

// ---------------------------------------------------------------- photos

export async function savePhotos(
  memoryId: string,
  photos: Omit<Photo, 'id' | 'memoryId' | 'createdAt'>[],
  store: DriftwoodDB = db,
): Promise<string[]> {
  const rows: Photo[] = photos.map((p) => ({ ...p, id: newId(), memoryId, createdAt: Date.now() }));
  await store.photos.bulkAdd(rows);
  return rows.map((r) => r.id);
}

export async function deletePhotos(ids: string[], store: DriftwoodDB = db) {
  await store.photos.bulkDelete(ids);
}

/** Remove photos attached to a memory that are no longer referenced by it. */
export async function prunePhotos(memoryId: string, keep: string[], store: DriftwoodDB = db) {
  const keepSet = new Set(keep);
  const ids = (await store.photos.where('memoryId').equals(memoryId).primaryKeys()).filter(
    (id) => !keepSet.has(id as string),
  );
  if (ids.length) await store.photos.bulkDelete(ids as string[]);
}

// ---------------------------------------------------------------- recordings

export async function saveRecordings(
  memoryId: string,
  recordings: Omit<Recording, 'id' | 'memoryId' | 'createdAt'>[],
  store: DriftwoodDB = db,
): Promise<string[]> {
  const rows: Recording[] = recordings.map((r) => ({ ...r, id: newId(), memoryId, createdAt: Date.now() }));
  if (rows.length) await store.recordings.bulkAdd(rows);
  return rows.map((r) => r.id);
}

/** Remove recordings attached to a memory that the user deleted in the editor. */
export async function pruneRecordings(memoryId: string, keep: string[], store: DriftwoodDB = db) {
  const keepSet = new Set(keep);
  const ids = (await store.recordings.where('memoryId').equals(memoryId).primaryKeys()).filter(
    (id) => !keepSet.has(id as string),
  );
  if (ids.length) await store.recordings.bulkDelete(ids as string[]);
}

// ---------------------------------------------------------------- people

const PERSON_COLORS: ChapterColor[] = ['sage', 'sky', 'clay', 'plum', 'sand', 'rose'];

export type PersonDraft = Pick<Person, 'name' | 'relationship' | 'avatar' | 'notes'> & { color?: ChapterColor };

export async function createPerson(draft: PersonDraft, store: DriftwoodDB = db): Promise<Person> {
  const count = await store.people.count();
  const now = Date.now();
  const person: Person = {
    color: PERSON_COLORS[count % PERSON_COLORS.length],
    ...draft,
    name: draft.name.trim(),
    relationship: draft.relationship.trim(),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  await store.people.add(person);
  return person;
}

/** Find a person by (case-insensitive) name, creating them if needed. */
export async function findOrCreatePerson(name: string, store: DriftwoodDB = db): Promise<Person> {
  const key = name.trim().toLowerCase();
  const existing = (await store.people.toArray()).find((p) => p.name.toLowerCase() === key);
  return existing ?? createPerson({ name, relationship: '', avatar: null, notes: '' }, store);
}

export async function updatePerson(id: string, patch: Partial<PersonDraft>, store: DriftwoodDB = db) {
  const p = await store.people.get(id);
  if (!p) throw new Error('Person not found');
  const next: Person = { ...p, ...patch, updatedAt: Date.now() };
  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.relationship !== undefined) next.relationship = patch.relationship.trim();
  await store.people.put(next);
  return next;
}

/** Delete a person and remove them from every memory they appear in. */
export async function deletePerson(id: string, store: DriftwoodDB = db) {
  await store.transaction('rw', store.people, store.memories, async () => {
    await store.memories
      .where('personIds')
      .equals(id)
      .modify((m) => {
        m.personIds = m.personIds.filter((x) => x !== id);
      });
    await store.people.delete(id);
  });
}

// ---------------------------------------------------------------- reflection

export interface ReflectionState {
  /** Prompt currently on screen. */
  promptId: string | null;
  /** Unsaved writing, per prompt, so shuffling never loses anything. */
  drafts: Record<string, string>;
  /** Prompts the person asked not to see again. */
  skipped: string[];
  /** Recently shown, so shuffling doesn't repeat itself. */
  recent: string[];
  /** Years the person is focusing on (gap prompts), or null for general prompts. */
  focus: { from: number; to: number } | null;
  /** Text of generated prompts that have drafts, keyed by prompt id. */
  promptTexts: Record<string, string>;
}

const EMPTY_REFLECTION: ReflectionState = { promptId: null, drafts: {}, skipped: [], recent: [], focus: null, promptTexts: {} };

export async function getReflection(store: DriftwoodDB = db): Promise<ReflectionState> {
  const row = await store.meta.get('reflection');
  return { ...EMPTY_REFLECTION, ...((row?.value as Partial<ReflectionState>) ?? {}) };
}

export async function saveReflection(patch: Partial<ReflectionState>, store: DriftwoodDB = db) {
  const next = { ...(await getReflection(store)), ...patch };
  await store.meta.put({ key: 'reflection', value: next });
  return next;
}

// ---------------------------------------------------------------- chapters

export async function saveChapter(
  chapter: Omit<Chapter, 'id' | 'createdAt' | 'kind' | 'detail'> & { id?: string; kind?: Chapter['kind']; detail?: string },
  store: DriftwoodDB = db,
): Promise<Chapter> {
  const existing = chapter.id ? await store.chapters.get(chapter.id) : undefined;
  const [startYear, endYear] =
    chapter.startYear <= chapter.endYear
      ? [chapter.startYear, chapter.endYear]
      : [chapter.endYear, chapter.startYear];
  const row: Chapter = {
    ...chapter,
    kind: chapter.kind ?? existing?.kind ?? 'stage',
    detail: (chapter.detail ?? existing?.detail ?? '').trim(),
    startYear,
    endYear,
    title: chapter.title.trim(),
    id: chapter.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await store.chapters.put(row);
  return row;
}

export async function deleteChapter(id: string, store: DriftwoodDB = db) {
  await store.chapters.delete(id);
}

/** Starter stages of life for a birth year (used by onboarding and the sample life). */
export function suggestedChapters(birthYear: number, thisYear = new Date().getFullYear()) {
  return suggestFrame(birthYear, [], [], thisYear)
    .filter((s) => s.kind === 'stage')
    .map(({ kind, title, startYear, endYear, color }) => ({ kind, title, startYear, endYear, color }));
}

export async function wipeEverything(store: DriftwoodDB = db) {
  const tables = [store.memories, store.photos, store.chapters, store.people, store.recordings, store.meta];
  await store.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
}
