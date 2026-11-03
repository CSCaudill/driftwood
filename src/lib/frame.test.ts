import { describe, expect, it } from 'vitest';
import { contextForYear, gradeLabel, stageFor, suggestFrame } from './frame';
import { biggestGap, generateGapPrompts, lifeGaps, spanLabel, splitByStage } from './gapPrompts';
import type { Anchor, Memory, Person } from '../types';

const anchor = (p: Partial<Anchor>): Anchor => ({
  id: p.title ?? 'a', kind: 'stage', title: 'x', detail: '', startYear: 2000, endYear: 2000, color: 'sage', createdAt: 0, ...p,
});
const mem = (title: string, year: number, personIds: string[] = []): Memory => ({
  id: title, title, notes: '', date: { precision: 'year', year }, sortStart: `${year}-01-01`, sortEnd: `${year}-12-31`,
  groupYear: year, rank: null, location: '', personIds, tags: [], feeling: null, clarity: 'partial', photoIds: [],
  favorite: false, isPrivate: false, promptId: null, createdAt: 0, updatedAt: 0,
});

describe('suggestFrame', () => {
  it('suggests school stages and milestones from a birth year', () => {
    const s = suggestFrame(1990, [], [], 2026);
    const elementary = s.find((x) => x.title === 'Elementary school')!;
    expect([elementary.startYear, elementary.endYear]).toEqual([1995, 2000]);
    expect(s.find((x) => x.title === 'Finished high school')!.startYear).toBe(2008);
    expect(s.some((x) => x.title === 'Your thirties')).toBe(true);
    expect(s.some((x) => x.title === 'Your forties')).toBe(false);
  });
  it('skips what already exists, what was dismissed, and the future', () => {
    const s = suggestFrame(2015, [{ title: 'elementary school', kind: 'stage' }], ['ms-kindergarten'], 2026);
    expect(s.some((x) => x.title === 'Elementary school')).toBe(false);
    expect(s.some((x) => x.key === 'ms-kindergarten')).toBe(false);
    expect(s.some((x) => x.title === 'High school')).toBe(false);
    expect(s.find((x) => x.title === 'Middle school')!.endYear).toBe(2026);
  });
});

describe('grades', () => {
  it('labels the two grades a calendar year spans', () => {
    expect(gradeLabel(1998, 1990)).toBe('2nd–3rd grade');
    expect(gradeLabel(1995, 1990)).toBe('Pre-K–Kindergarten');
    expect(gradeLabel(1996, 1990)).toBe('K–1st grade');
    expect(gradeLabel(2008, 1990)).toBe('12th grade');
    expect(gradeLabel(1994, 1990)).toBe('Pre-K');
    expect(gradeLabel(2009, 1990)).toBeNull();
    expect(gradeLabel(1998, null)).toBeNull();
  });
});

describe('year context', () => {
  const anchors = [
    anchor({ kind: 'home', title: 'Maple Street house', startYear: 1992, endYear: 2000 }),
    anchor({ kind: 'milestone', title: 'Moved to Austin', startYear: 2001, endYear: 2001 }),
    anchor({ kind: 'stage', title: 'Elementary school', startYear: 1995, endYear: 2000 }),
    anchor({ kind: 'stage', title: 'Childhood', startYear: 1990, endYear: 2003 }),
  ];
  it('finds homes, milestones and the most specific stage', () => {
    expect(contextForYear(1998, anchors, 1990).ongoing.map((a) => a.title)).toEqual(['Maple Street house']);
    expect(contextForYear(2001, anchors, 1990).milestones.map((a) => a.title)).toEqual(['Moved to Austin']);
    expect(stageFor(anchors, 1998)!.title).toBe('Elementary school');
    expect(stageFor(anchors, 2002)!.title).toBe('Childhood');
  });
});

describe('gaps', () => {
  const memories = [mem('Zoo', 1995, ['dad']), mem('Moving', 2001)];
  it('finds empty stretches from birth to now and picks the most useful one', () => {
    expect(lifeGaps(memories, 1990, 2003)).toEqual([[1990, 1994], [1996, 2000], [2002, 2003]]);
    expect(biggestGap(memories, 1990, 2003)).toEqual([1996, 2000]);
  });

  it('splits long gaps at stages of life', () => {
    expect(splitByStage(2002, 2025, 1990)).toEqual([[2002, 2003], [2004, 2007], [2008, 2011], [2012, 2019], [2020, 2025]]);
    // a 24-year empty stretch suggests one stage, not the whole thing; infancy comes last
    expect(biggestGap([mem('a', 2001)], 1990, 2026)).toEqual([1995, 2000]);
  });

  it('builds prompts from the frame, neighbours, people and age', () => {
    const people = new Map<string, Person>([['dad', { id: 'dad', name: 'Dad', relationship: 'Dad', avatar: null, color: 'sky', notes: '', createdAt: 0, updatedAt: 0 }]]);
    const anchors = [
      anchor({ id: 'h', kind: 'home', title: 'Maple Street house', startYear: 1992, endYear: 2000 }),
      anchor({ id: 's', kind: 'stage', title: 'Elementary school', detail: 'Lincoln Elementary', startYear: 1995, endYear: 2000 }),
    ];
    const prompts = generateGapPrompts({ from: 1996, to: 1998, birthYear: 1990, anchors, memories, people });
    const texts = prompts.map((p) => p.text);
    expect(texts[0]).toContain('"Zoo"');
    expect(texts.some((t) => t.includes('"Moving"'))).toBe(true);
    expect(texts.some((t) => t.includes('Maple Street house'))).toBe(true);
    expect(texts.some((t) => t.includes('Lincoln Elementary'))).toBe(true);
    expect(texts.some((t) => t.includes('Dad'))).toBe(true);
    expect(texts.some((t) => t.includes('age 7'))).toBe(true);
    // stable ids
    expect(generateGapPrompts({ from: 1996, to: 1998, birthYear: 1990, anchors, memories, people }).map((p) => p.id)).toEqual(prompts.map((p) => p.id));
    expect(new Set(prompts.map((p) => p.id)).size).toBe(prompts.length);
    // dates default to the gap's ages
    expect(prompts.find((p) => p.because?.startsWith('Ages'))!.date).toEqual({ precision: 'age', age: 6, ageEnd: 8 });
  });

  it('labels spans with ages', () => {
    expect(spanLabel(1996, 1998, 1990)).toBe('ages 6–8 (1996–1998)');
    expect(spanLabel(1996, 1996, 1990)).toBe('age 6 (1996)');
    expect(spanLabel(1996, 1998, null)).toBe('1996–1998');
  });
});

import { sourceLabel } from './meta';
describe('memory sources', () => {
  it('labels told, recorded and mixed memories, and stays quiet for remembered ones', () => {
    expect(sourceLabel('remembered', [])).toBeNull();
    expect(sourceLabel(undefined, [])).toBeNull();
    expect(sourceLabel('told', ['Mom', 'Dad'])).toBe('Told by Mom, Dad');
    expect(sourceLabel('told', [])).toBe('Told to you');
    expect(sourceLabel('record', [])).toBe('From a photo or video');
    expect(sourceLabel('mixed', ['Grandma'])).toBe('Partly from Grandma');
  });
});
