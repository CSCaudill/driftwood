import { describe, expect, it } from 'vitest';
import { greeting, onThisDay, partOfDay, resurface } from './today';
import type { Memory } from '../types';

const mem = (p: Partial<Memory>): Memory => ({
  id: p.title ?? 'm', title: 'm', notes: 'notes', date: { precision: 'year', year: 1999 }, sortStart: '1999-01-01', sortEnd: '1999-12-31',
  groupYear: 1999, rank: null, location: '', personIds: [], tags: [], feeling: null, clarity: 'partial', photoIds: [],
  favorite: false, isPrivate: false, promptId: null, createdAt: 0, updatedAt: 0, ...p,
});

describe('today', () => {
  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 10, 3, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 10, 3, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 10, 3, 21))).toBe('Good evening');
    expect(partOfDay(new Date(2026, 10, 3, 21))).toBe('Tonight’s');
    expect(partOfDay(new Date(2026, 10, 3, 9))).toBe('Today’s');
  });

  it('prefers an exact-date memory from this day in an earlier year', () => {
    const day = mem({ title: 'move', date: { precision: 'day', year: 2001, month: 11, day: 3 } });
    const other = mem({ title: 'other', favorite: true });
    const hidden = mem({ title: 'hidden', isPrivate: true, date: { precision: 'day', year: 2001, month: 11, day: 3 } });
    const today = new Date(2026, 10, 3, 12);
    expect(onThisDay([day, other, hidden], today).map((m) => m.title)).toEqual(['move']);
    expect(resurface([day, other], today)).toEqual({ memory: day, onThisDay: true });
  });

  it('otherwise picks a placed memory with something to show, stable through the day', () => {
    const empty = mem({ title: 'empty', notes: '' });
    const unplaced = mem({ title: 'unplaced', groupYear: null });
    const good = mem({ title: 'good' });
    const morning = resurface([empty, unplaced, good], new Date(2026, 10, 3, 7));
    const night = resurface([empty, unplaced, good], new Date(2026, 10, 3, 23));
    expect(morning?.memory.title).toBe('good');
    expect(morning).toEqual(night);
    expect(resurface([empty, unplaced])).toBeNull();
  });
});
