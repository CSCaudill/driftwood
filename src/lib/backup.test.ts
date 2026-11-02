import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DriftwoodDB } from '../db/db';
import { createMemory, createPerson, emptyDraft } from '../db/repo';
import { createBackup, parseBackup, restoreBackup } from './backup';

describe('backup', () => {
  it('round-trips people, recordings and memories', async () => {
    const src = new DriftwoodDB('bk-src-' + Math.random());
    const mom = await createPerson({ name: 'Mom', relationship: 'Mom', avatar: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), notes: '' }, src);
    const m = await createMemory(emptyDraft({ title: 'kitchen', personIds: [mom.id] }), src);
    await src.recordings.add({ id: 'r1', memoryId: m.id, blob: new Blob([new Uint8Array([9, 9])], { type: 'audio/mp4' }), mime: 'audio/mp4', durationMs: 1200, createdAt: 1 });

    const file = parseBackup(JSON.stringify(await createBackup(src)));
    const dst = new DriftwoodDB('bk-dst-' + Math.random());
    await restoreBackup(file, 'replace', dst);
    expect((await dst.people.get(mom.id))!.avatar!.size).toBe(3);
    expect((await dst.recordings.get('r1'))!.blob.size).toBe(2);
    expect((await dst.memories.get(m.id))!.personIds).toEqual([mom.id]);
  });

  it('upgrades v1 backups with plain names and merges people by name', async () => {
    const dst = new DriftwoodDB('bk-v1-' + Math.random());
    const existing = await createPerson({ name: 'Dad', relationship: 'Dad', avatar: null, notes: '' }, dst);
    const v1 = {
      format: 'lifeline-backup', version: 1, exportedAt: '2026-01-01T00:00:00Z',
      settings: {}, chapters: [], photos: [],
      memories: [{ ...emptyDraft({ title: 'zoo' }), id: 'z', people: ['dad', 'Uncle Joe'], personIds: undefined, sortStart: '1995-06-01', sortEnd: '1995-08-31', groupYear: 1995, rank: null, createdAt: 1, updatedAt: 1 }],
    };
    await restoreBackup(parseBackup(JSON.stringify(v1)), 'merge', dst);
    const z = await dst.memories.get('z');
    expect(z!.personIds).toContain(existing.id);
    expect((await dst.people.toArray()).map((p) => p.name).sort()).toEqual(['Dad', 'Uncle Joe']);
  });
});
