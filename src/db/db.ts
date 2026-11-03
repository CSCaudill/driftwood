import Dexie, { type EntityTable } from 'dexie';
import type { Chapter, ChapterColor, Memory, Person, Photo, Recording, Settings } from '../types';
import { newId } from '../lib/id';

interface MetaRow {
  key: string;
  value: unknown;
}

const COLORS: ChapterColor[] = ['sage', 'sky', 'clay', 'plum', 'sand', 'rose'];

/**
 * Local-first storage (IndexedDB via Dexie). Works identically in browsers and
 * in the iOS WKWebView shell. Everything stays on the device unless the user
 * exports a backup.
 */
export class DriftwoodDB extends Dexie {
  memories!: EntityTable<Memory, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  people!: EntityTable<Person, 'id'>;
  recordings!: EntityTable<Recording, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'driftwood') {
    super(name);
    this.version(1).stores({
      memories: 'id, groupYear, sortStart, updatedAt, createdAt, favorite, *tags, *people',
      photos: 'id, memoryId',
      chapters: 'id, startYear',
      meta: 'key',
    });

    // v2: people become first-class records; voice recordings added.
    this.version(2)
      .stores({
        memories: 'id, groupYear, sortStart, updatedAt, createdAt, favorite, promptId, *tags, *personIds',
        people: 'id, name',
        recordings: 'id, memoryId',
      })
      .upgrade(async (tx) => {
        const byName = new Map<string, string>();
        const now = Date.now();
        const people: Person[] = [];
        await tx
          .table('memories')
          .toCollection()
          .modify((m: Record<string, unknown>) => {
            const names = (m.people as string[] | undefined) ?? [];
            m.personIds = names.map((raw) => {
              const name = raw.trim();
              const key = name.toLowerCase();
              let id = byName.get(key);
              if (!id) {
                id = newId();
                byName.set(key, id);
                people.push({
                  id,
                  name,
                  relationship: '',
                  avatar: null,
                  color: COLORS[people.length % COLORS.length],
                  notes: '',
                  createdAt: now,
                  updatedAt: now,
                });
              }
              return id;
            });
            delete m.people;
          });
        if (people.length) await tx.table('people').bulkAdd(people);
      });

    // v3: chapters become life-frame anchors with a kind and optional detail.
    this.version(3)
      .stores({ chapters: 'id, startYear, kind' })
      .upgrade(async (tx) => {
        await tx
          .table('chapters')
          .toCollection()
          .modify((c: Record<string, unknown>) => {
            c.kind ??= 'stage';
            c.detail ??= '';
          });
      });
  }
}

export const db = new DriftwoodDB();

export type { MetaRow, Settings };
