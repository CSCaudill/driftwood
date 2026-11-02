import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LifelineDB } from './db';
import { createMemory, emptyDraft, moveMemory, updateMemory, updateSettings } from './repo';
import { orderSection } from '../lib/ordering';

let store: LifelineDB;
beforeEach(async () => {
  store = new LifelineDB('test-' + Math.random());
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
