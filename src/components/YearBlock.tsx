import { chapterVar } from '../lib/meta';
import type { Chapter, Memory } from '../types';
import { FrameContext } from './FrameContext';
import { MemoryEntry } from './MemoryEntry';
import type { YearContext } from '../lib/frame';

/** One year on the spine: sticky numeral + age on the left, memories on the right. */
export function YearBlock({
  year,
  birthYear,
  items,
  chapter,
  lastTouched,
  anchor = true,
  context,
}: {
  year: number;
  birthYear: number | null;
  items: Memory[];
  chapter?: Chapter;
  lastTouched?: string | null;
  /** Register a #y-YEAR anchor for the decade jump bar. */
  anchor?: boolean;
  /** Reference points from the life frame for this year. */
  context?: YearContext;
}) {
  const age = birthYear != null ? year - birthYear : null;
  return (
    <section id={anchor ? `y-${year}` : undefined} aria-label={String(year)} className="relative flex scroll-mt-24">
      <div className="w-[var(--spine-x)] shrink-0 pr-3">
        <div className="sticky top-20 pt-2.5">
          <div className="year-numeral text-[2rem] leading-none text-ink">{year}</div>
          {age != null && age >= 0 && <div className="mt-1 text-xs text-graphite">{age === 0 ? 'Birth year' : `Age ${age}`}</div>}
        </div>
      </div>
      <div
        className="relative min-w-0 flex-1 border-l-2 pb-6 pl-5"
        style={{ borderColor: chapter ? chapterVar(chapter.color) : 'var(--line)' }}
      >
        {context && <FrameContext {...context} className="pb-1 pt-3" />}
        <ol>
          {items.map((m) => (
            <MemoryEntry key={m.id} memory={m} birthYear={birthYear} highlight={lastTouched === m.id} />
          ))}
        </ol>
      </div>
    </section>
  );
}

