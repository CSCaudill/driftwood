import { describe, expect, it } from 'vitest';
import { buildSections, findGaps, orderSection, rankForMove, RANK_STEP } from './ordering';

const m = (id: string, start: string, rank: number | null = null, end = start, groupYear = Number(start.slice(0, 4))) => ({
  id, sortStart: start, sortEnd: end, rank, createdAt: 0, groupYear,
});

describe('orderSection', () => {
  it('orders by date, narrower spans first', () => {
    const items = [m('year', '1998-01-01', null, '1998-12-31'), m('jan', '1998-01-01', null, '1998-01-31'), m('may', '1998-05-03')];
    expect(orderSection(items).map((x) => x.id)).toEqual(['jan', 'year', 'may']);
  });

  it('respects manual rank and merges unranked items by date', () => {
    const items = [
      m('b', '1998-03-01', 1 * RANK_STEP),
      m('a', '1998-01-01', 2 * RANK_STEP), // user put a after b
      m('new', '1998-02-01'), // unranked → before first ranked item that starts after it (b, March)
      m('late', '1998-12-01'), // nothing ranked starts after it → end
    ];
    expect(orderSection(items).map((x) => x.id)).toEqual(['new', 'b', 'a', 'late']);
  });
});

describe('rankForMove', () => {
  it('densely ranks a never-arranged section', () => {
    const section = [m('a', '1998-01-01'), m('b', '1998-02-01'), m('c', '1998-03-01')];
    const updates = rankForMove(section, 'c', 0);
    const order = [...updates].sort((x, y) => x.rank - y.rank).map((u) => u.id);
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('writes a single midpoint rank when the section is already ranked', () => {
    const section = [m('a', '1998-01-01', 1024), m('b', '1998-02-01', 2048), m('c', '1998-03-01', 3072)];
    expect(rankForMove(section, 'c', 1)).toEqual([{ id: 'c', rank: 1536 }]);
    expect(rankForMove(section, 'a', 3)).toEqual([{ id: 'a', rank: 4096 }]);
    expect(rankForMove(section, 'x', 0)).toEqual([{ id: 'x', rank: 0 }]);
  });
});

describe('buildSections & gaps', () => {
  it('groups by year and skips unplaced', () => {
    const items = [m('a', '2001-01-01'), m('b', '1998-01-01'), { ...m('u', ''), groupYear: null }];
    expect(buildSections(items).map((s) => s.year)).toEqual([1998, 2001]);
  });

  it('collapses empty years into spans', () => {
    expect(findGaps([1990, 1991, 1995, 1997])).toEqual([[1992, 1994], [1996, 1996]]);
  });
});
