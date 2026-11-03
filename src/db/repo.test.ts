import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DriftwoodDB } from './db';
import Dexie from 'dexie';
import { createMemory, createPerson, deletePerson, emptyDraft, moveMemory, updateMemory, updateSettings } from './repo';
import { orderSection } from '../lib/ordering';

let store: DriftwoodDB;
beforeEach(async () => {
  store = new DriftwoodDB('test-' + Math.random());
  await store.open();
});

const year = (title: string, y: number) => emptyDraft({ title, date: { precision: 'year', year: y } });

describe('repo', () => {
  it('derives sort fields and files unknown dates as unplaced', async () => {
    const a = await createMemory(year('a', 1998), store);
    const u = await createMemory(emptyDraft({ title: 'u' }), store);
    expect(a.groupYear).toBe(1998);
    expect(u.groupYear).toBeNull();
  });

  it('re-files age-based memories when the birth year changes', async () => {
    await updateSettings({ birthYear: 1990 }, store);
    const m = await createMemory(emptyDraft({ title: 'age', date: { precision: 'age', age: 5 } }), store);
    expect(m.groupYear).toBe(1995);
    await updateSettings({ birthYear: 1988 }, store);
    expect((await store.memories.get(m.id))!.groupYear).toBe(1993);
  });

  it('reorders within a year and moves across years with undo data', async () => {
    const a = await createMemory(year('a', 1998), store);
    const b = await createMemory(year('b', 1998), store);
    const c = await createMemory(year('c', 1999), store);

    await moveMemory(b.id, 1998, 0, store);
    let sec = orderSection(await store.memories.where('groupYear').equals(1998).toArray());
    expect(sec.map((x) => x.title)).toEqual(['b', 'a']);

    const res = await moveMemory(c.id, 1998, 1, store);
    sec = orderSection(await store.memories.where('groupYear').equals(1998).toArray());
    expect(sec.map((x) => x.title)).toEqual(['b', 'c', 'a']);
    expect((await store.memories.get(c.id))!.date.year).toBe(1998);
    expect(res!.undo.find((x) => x.id === c.id)!.groupYear).toBe(1999);
    void a;
  });

  it('refuses to implicitly re-date exact memories', async () => {
    const d = await createMemory(emptyDraft({ title: 'd', date: { precision: 'day', year: 2001, month: 6, day: 14 } }), store);
    expect(await moveMemory(d.id, 2003, 0, store)).toBeNull();
  });

  it('drops manual rank when a memory is re-dated into another year', async () => {
    const a = await createMemory(year('a', 1998), store);
    await createMemory(year('b', 1998), store);
    await moveMemory(a.id, 1998, 1, store);
    expect((await store.memories.get(a.id))!.rank).not.toBeNull();
    const moved = await updateMemory(a.id, { date: { precision: 'year', year: 2000 } }, store);
    expect(moved.rank).toBeNull();
    expect(moved.groupYear).toBe(2000);
  });
});

describe('people', () => {
  it('migrates v1 name tags into people records', async () => {
    const name = 'migrate-' + Math.random();
    const v1 = new Dexie(name);
    v1.version(1).stores({ memories: 'id, groupYear, sortStart, updatedAt, createdAt, favorite, *tags, *people', photos: 'id, memoryId', chapters: 'id, startYear', meta: 'key' });
    await v1.table('memories').bulkAdd([
      { id: 'a', title: 'a', people: ['Mom', 'Danny'], tags: [], groupYear: 1990, sortStart: '1990-01-01', createdAt: 1, updatedAt: 1, favorite: false },
      { id: 'b', title: 'b', people: ['mom '], tags: [], groupYear: 1991, sortStart: '1991-01-01', createdAt: 1, updatedAt: 1, favorite: false },
    ]);
    v1.close();

    const v2 = new DriftwoodDB(name);
    await v2.open();
    const people = await v2.people.toArray();
    expect(people.map((p) => p.name).sort()).toEqual(['Danny', 'Mom']);
    const a = await v2.memories.get('a');
    const b = await v2.memories.get('b');
    const mom = people.find((p) => p.name === 'Mom')!;
    expect(a!.personIds).toContain(mom.id);
    expect(b!.personIds).toEqual([mom.id]);
    expect((a as unknown as { people?: unknown }).people).toBeUndefined();
    expect((await v2.memories.where('personIds').equals(mom.id).toArray()).length).toBe(2);
  });

  it('removes a deleted person from every memory', async () => {
    const p = await createPerson({ name: 'Grandpa', relationship: 'Grandpa', avatar: null, notes: '' }, store);
    const m = await createMemory(emptyDraft({ title: 'shop', personIds: [p.id] }), store);
    await deletePerson(p.id, store);
    expect((await store.memories.get(m.id))!.personIds).toEqual([]);
    expect(await store.people.get(p.id)).toBeUndefined();
  });
});

describe('life frame migration', () => {
  it('turns v2 chapters into stage anchors', async () => {
    const name = 'frame-' + Math.random();
    const v2 = new Dexie(name);
    v2.version(2).stores({ memories: 'id, groupYear, sortStart, updatedAt, createdAt, favorite, promptId, *tags, *personIds', photos: 'id, memoryId', chapters: 'id, startYear', meta: 'key', people: 'id, name', recordings: 'id, memoryId' });
    await v2.table('chapters').add({ id: 'c1', title: 'High school', startYear: 2002, endYear: 2005, color: 'clay', createdAt: 1 });
    v2.close();
    const v3 = new DriftwoodDB(name);
    await v3.open();
    const c = await v3.chapters.get('c1');
    expect(c).toMatchObject({ kind: 'stage', detail: '', title: 'High school' });
    expect(await v3.chapters.where('kind').equals('stage').count()).toBe(1);
  });
});
