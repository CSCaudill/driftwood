import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { createMemory, createPerson, emptyDraft, getSettings, updateSettings, wipeEverything } from '../db/repo';
import { exitSampleLife, loadSampleLife } from './sample';

beforeEach(async () => {
  await db.open();
  await wipeEverything();
});

describe('sample life', () => {
  it('exits back to the welcome screen when nothing else was added', async () => {
    await loadSampleLife();
    expect((await getSettings()).sampleActive).toBe(true);
    expect(await db.memories.count()).toBeGreaterThan(5);
    expect(await exitSampleLife()).toBe(0);
    expect(await db.memories.count()).toBe(0);
    expect(await db.people.count()).toBe(0);
    expect(await db.chapters.count()).toBe(0);
    expect(await getSettings()).toMatchObject({ onboarded: false, birthYear: null, sampleActive: false });
  });

  it('keeps your own memories and people, and restores your settings', async () => {
    await updateSettings({ onboarded: true, birthYear: 1975, name: 'Chris', theme: 'dark' });
    const aunt = await createPerson({ name: 'Aunt Carol', relationship: 'Aunt', avatar: null, notes: '' });
    await loadSampleLife();
    expect((await getSettings()).birthYear).toBe(1988);
    const mom = (await db.people.toArray()).find((p) => p.name === 'Mom')!;
    await createMemory(emptyDraft({ title: 'Mine', date: { precision: 'age', age: 10 }, personIds: [aunt.id, mom.id], sourcePersonIds: [mom.id] }));

    expect(await exitSampleLife()).toBe(1);
    const left = await db.memories.toArray();
    expect(left.map((m) => m.title)).toEqual(['Mine']);
    expect(left[0].personIds).toEqual([aunt.id]);
    expect(left[0].sourcePersonIds).toEqual([]);
    // re-filed for the restored birth year (1975 + 10)
    expect(left[0].groupYear).toBe(1985);
    expect((await db.people.toArray()).map((p) => p.name)).toEqual(['Aunt Carol']);
    expect(await getSettings()).toMatchObject({ onboarded: true, birthYear: 1975, name: 'Chris', theme: 'dark', sampleActive: false });
  });
});

describe('untagged sample from older versions', () => {
  it('recognises and tags it so it can be exited', async () => {
    const { adoptUntaggedSample } = await import('./sample');
    await loadSampleLife();
    // simulate an old sample: strip tags and the active flag
    await db.memories.toCollection().modify((m) => { delete m.sample; });
    await db.people.toCollection().modify((p) => { delete p.sample; });
    await db.chapters.toCollection().modify((c) => { delete c.sample; });
    await updateSettings({ sampleActive: false });
    await db.meta.delete('sampleBackup');
    await createMemory(emptyDraft({ title: 'Mine' }));

    expect(await adoptUntaggedSample()).toBe(true);
    expect((await getSettings()).sampleActive).toBe(true);
    expect(await exitSampleLife()).toBe(1);
    expect((await db.memories.toArray()).map((m) => m.title)).toEqual(['Mine']);
    expect(await db.chapters.count()).toBe(0);
    expect(await adoptUntaggedSample()).toBe(false);
  });
});
