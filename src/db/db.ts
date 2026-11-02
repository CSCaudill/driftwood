import Dexie, { type EntityTable } from 'dexie';
import type { Chapter, Memory, Photo, Settings } from '../types';

interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Local-first storage (IndexedDB via Dexie). Works identically in browsers and
 * in the iOS WKWebView shell. Everything stays on the device unless the user
 * exports a backup.
 */
export class LifelineDB extends Dexie {
  memories!: EntityTable<Memory, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'lifeline') {
    super(name);
    this.version(1).stores({
      memories: 'id, groupYear, sortStart, updatedAt, createdAt, favorite, *tags, *people',
      photos: 'id, memoryId',
      chapters: 'id, startYear',
      meta: 'key',
    });
  }
}

export const db = new LifelineDB();

export type { MetaRow, Settings };
