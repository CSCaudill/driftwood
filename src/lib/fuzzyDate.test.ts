import { describe, expect, it } from 'vitest';
import { formatFuzzyDate, formatFuzzyDateShort, resolveBounds, shiftToYear } from './fuzzyDate';

describe('resolveBounds', () => {
  it('handles exact days, clamping impossible days', () => {
    expect(resolveBounds({ precision: 'day', year: 2001, month: 2, day: 31 }, null)).toEqual({
      start: '2001-02-28', end: '2001-02-28', groupYear: 2001,
    });
  });

  it('handles months, seasons and years', () => {
    expect(resolveBounds({ precision: 'month', year: 2000, month: 2 }, null)!.end).toBe('2000-02-29');
    expect(resolveBounds({ precision: 'season', year: 1998, season: 'summer' }, null)).toEqual({
      start: '1998-06-01', end: '1998-08-31', groupYear: 1998,
    });
    expect(resolveBounds({ precision: 'season', year: 1998, season: 'winter' }, null)).toEqual({
      start: '1998-12-01', end: '1999-02-28', groupYear: 1998,
    });
    expect(resolveBounds({ precision: 'year', year: 1990 }, null)!.groupYear).toBe(1990);
  });

  it('normalises reversed ranges and decades', () => {
    expect(resolveBounds({ precision: 'range', year: 1999, endYear: 1995 }, null)).toEqual({
      start: '1995-01-01', end: '1999-12-31', groupYear: 1995,
    });
    expect(resolveBounds({ precision: 'decade', decade: 1994 }, null)).toEqual({
      start: '1990-01-01', end: '1999-12-31', groupYear: 1990,
    });
  });

  it('needs a birth year for ages', () => {
    expect(resolveBounds({ precision: 'age', age: 8 }, null)).toBeNull();
    expect(resolveBounds({ precision: 'age', age: 8 }, 1988)).toEqual({
      start: '1996-01-01', end: '1997-12-31', groupYear: 1996,
    });
    expect(resolveBounds({ precision: 'age', age: 8, ageEnd: 10 }, 1988)!.end).toBe('1999-12-31');
  });

  it('returns null for unknown or incomplete dates', () => {
    expect(resolveBounds({ precision: 'unknown' }, 1988)).toBeNull();
    expect(resolveBounds({ precision: 'month', year: 2000 }, null)).toBeNull();
  });
});

describe('formatting', () => {
  it('produces readable labels', () => {
    expect(formatFuzzyDate({ precision: 'day', year: 2001, month: 6, day: 14 }, null)).toBe('June 14, 2001');
    expect(formatFuzzyDate({ precision: 'season', year: 1998, season: 'winter' }, null)).toBe('Winter 1998–99');
    expect(formatFuzzyDate({ precision: 'season', year: 1998, season: 'summer', circa: true }, null)).toBe('Around summer 1998');
    expect(formatFuzzyDate({ precision: 'decade', decade: 1990 }, null)).toBe('The 1990s');
    expect(formatFuzzyDate({ precision: 'age', age: 8, ageEnd: 10 }, 1988)).toBe('Ages 8–10 (1996–1999)');
    expect(formatFuzzyDateShort({ precision: 'year', year: 1996, circa: true }, null)).toBe('~ 1996');
    expect(formatFuzzyDateShort({ precision: 'decade', decade: 1990 }, null)).toBe('1990s');
  });
});

describe('shiftToYear', () => {
  it('moves years, months and seasons', () => {
    expect(shiftToYear({ precision: 'year', year: 1996 }, 1998, null)).toEqual({ precision: 'year', year: 1998 });
    expect(shiftToYear({ precision: 'month', year: 1996, month: 3 }, 1994, null).year).toBe(1994);
  });

  it('never moves exact dates', () => {
    const d = { precision: 'day' as const, year: 2001, month: 6, day: 14 };
    expect(shiftToYear(d, 2003, null)).toBe(d);
  });

  it('narrows a range when dropped inside it, shifts it otherwise', () => {
    expect(shiftToYear({ precision: 'range', year: 1995, endYear: 1999 }, 1997, null)).toEqual({
      precision: 'range', year: 1997, endYear: 1999,
    });
    expect(shiftToYear({ precision: 'range', year: 1995, endYear: 1999 }, 2000, null)).toEqual({
      precision: 'range', year: 2000, endYear: 2004,
    });
  });

  it('shifts ages with the birth year', () => {
    expect(shiftToYear({ precision: 'age', age: 8, ageEnd: 10 }, 1998, 1988)).toEqual({
      precision: 'age', age: 10, ageEnd: 12,
    });
  });
});
