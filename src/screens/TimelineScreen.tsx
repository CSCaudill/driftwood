import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Plus, Search, Sparkles, Star, X } from 'lucide-react';
import { ArrangeList } from '../components/ArrangeList';
import { MemoryEntry } from '../components/MemoryEntry';
import { PromptCard } from '../components/PromptCard';
import { Button, Chip, EmptyState, IconButton, cx } from '../components/ui';
import { useChapters, useMemories, useSettings } from '../hooks/data';
import { loadSampleLife } from '../lib/sample';
import { chapterVar, FEELINGS } from '../lib/meta';
import { buildSections } from '../lib/ordering';
import { currentYear } from '../lib/fuzzyDate';
import { useApp } from '../state/app';
import type { Chapter, Feeling, Memory } from '../types';

type Row =
  | { kind: 'year'; year: number; items: Memory[] }
  | { kind: 'gap'; from: number; to: number };

export function TimelineScreen() {
  const memories = useMemories();
  const settings = useSettings();
  const chapters = useChapters();
  const { openEditor, lastTouched, setLastTouched } = useApp();
  const [arranging, setArranging] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const filtering = !!query.trim() || favOnly || !!feeling;
  const filtered = useMemo(() => {
    if (!memories) return [];
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (favOnly && !m.favorite) return false;
      if (feeling && m.feeling !== feeling) return false;
      if (!q) return true;
      const hay = [m.title, m.notes, m.location, ...m.people, ...m.tags].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [memories, query, favOnly, feeling]);

  const sections = useMemo(() => buildSections(filtered), [filtered]);
  const unplacedCount = memories?.filter((m) => m.groupYear == null).length ?? 0;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const showGaps = settings.showGaps && !filtering;
    if (showGaps && settings.birthYear && sections[0] && sections[0].year > settings.birthYear) {
      out.push({ kind: 'gap', from: settings.birthYear, to: sections[0].year - 1 });
    }
    sections.forEach((s, i) => {
      out.push({ kind: 'year', year: s.year, items: s.items });
      const next = sections[i + 1];
      if (showGaps && next && next.year - s.year > 1) out.push({ kind: 'gap', from: s.year + 1, to: next.year - 1 });
    });
    return out;
  }, [sections, settings.showGaps, settings.birthYear, filtering]);

  // Scroll to and highlight the memory that was just saved.
  useEffect(() => {
    if (!lastTouched) return;
    const el = document.getElementById(`m-${lastTouched}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setLastTouched(null), 1800);
    return () => clearTimeout(t);
  }, [lastTouched, memories, setLastTouched]);

  useEffect(() => {
    if (searching) searchInput.current?.focus();
  }, [searching]);

  if (!memories) return <div className="h-dvh" />;

  const placed = memories.length - unplacedCount;
  const decades = [...new Set(sections.map((s) => Math.floor(s.year / 10) * 10))];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
      {/* Header */}
      <header className="safe-top sticky top-0 z-20 -mx-4 bg-mist/90 px-4 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex h-16 items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-xl font-semibold">
              {settings.name ? `${settings.name}’s timeline` : 'Your timeline'}
            </h1>
            <p className="text-[0.8rem] text-graphite">
              {placed === 0 ? 'Nothing placed yet' : `${placed} ${placed === 1 ? 'memory' : 'memories'} across ${sections.length} ${sections.length === 1 ? 'year' : 'years'}`}
            </p>
          </div>
          {!arranging && (
            <IconButton label="Search memories" active={searching} onClick={() => { setSearching((s) => !s); if (searching) { setQuery(''); setFavOnly(false); setFeeling(null); } }}>
              <Search size={20} />
            </IconButton>
          )}
          {placed > 1 && (
            <Button
              size="sm"
              variant={arranging ? 'primary' : 'secondary'}
              onClick={() => setArranging((a) => !a)}
              icon={arranging ? undefined : <ArrowDownUp size={15} />}
            >
              {arranging ? 'Done' : 'Rearrange'}
            </Button>
          )}
        </div>
        {searching && !arranging && (
          <div className="anim-fade pb-3">
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                ref={searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, notes, people, places"
                className="h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-10 focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash"
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-graphite">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
              <Chip selected={favOnly} onClick={() => setFavOnly((f) => !f)}>
                <Star size={13} className={favOnly ? 'fill-current' : ''} /> Favorites
              </Chip>
              {FEELINGS.map((f) => (
                <Chip key={f.value} selected={feeling === f.value} onClick={() => setFeeling(feeling === f.value ? null : f.value)} className="shrink-0">
                  <span className="h-2 w-2 rounded-full" style={{ background: f.color }} aria-hidden />
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </header>

      {arranging ? (
        <ArrangeList memories={memories} birthYear={settings.birthYear} />
      ) : placed === 0 ? (
        <>
          <PromptCard />
          <EmptyState
            art={<EmptySpine />}
            title="Your timeline starts with one memory"
            action={
              <div className="flex flex-col items-center gap-3">
                <Button variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => openEditor()}>
                  Add a memory
                </Button>
                <Button variant="quiet" size="sm" icon={<Sparkles size={15} />} onClick={() => loadSampleLife()}>
                  Explore with a sample life
                </Button>
              </div>
            }
          >
            It doesn’t need a date or many details. Write down whatever comes back, and place it when you can.
          </EmptyState>
        </>
      ) : (
        <div className="relative pb-32" style={{ ['--spine-x' as string]: '4.75rem' }}>
          {!filtering && <PromptCard />}

          {filtering && sections.length === 0 && (
            <p className="py-16 text-center text-graphite">No memories match. Try another word or clear the filters.</p>
          )}

          {settings.birthYear && !filtering && sections[0] && (
            <Milestone year={settings.birthYear} label="Born" />
          )}

          {rows.map((row, i) => {
            const startYear = row.kind === 'year' ? row.year : row.from;
            const chapter = chapterFor(chapters, startYear);
            const prev = rows[i - 1];
            const prevChapter = prev ? chapterFor(chapters, prev.kind === 'year' ? prev.year : prev.from) : undefined;
            const heading = chapter && chapter.id !== prevChapter?.id && !filtering;
            return (
              <Fragment key={row.kind === 'year' ? row.year : `gap-${row.from}`}>
                {heading && <ChapterHeading chapter={chapter} />}
                {row.kind === 'gap' ? (
                  <GapRow
                    from={row.from}
                    to={row.to}
                    chapter={chapter}
                    onAdd={() =>
                      openEditor({
                        initial: {
                          date:
                            row.from === row.to
                              ? { precision: 'year', year: row.from }
                              : { precision: 'range', year: row.from, endYear: row.to },
                        },
                      })
                    }
                  />
                ) : (
                  <YearBlock
                    year={row.year}
                    birthYear={settings.birthYear}
                    chapter={chapter}
                    items={row.items}
                    lastTouched={lastTouched}
                  />
                )}
              </Fragment>
            );
          })}

          {!filtering && <Milestone year={currentYear()} label="Today" now />}
        </div>
      )}

      {!arranging && decades.length > 2 && <DecadeScrubber decades={decades} years={sections.map((s) => s.year)} />}
    </div>
  );
}

function chapterFor(chapters: Chapter[], year: number) {
  // Most specific (shortest) chapter wins when chapters overlap.
  return chapters
    .filter((c) => year >= c.startYear && year <= c.endYear)
    .sort((a, b) => a.endYear - a.startYear - (b.endYear - b.startYear))[0];
}

function YearBlock({
  year,
  birthYear,
  items,
  chapter,
  lastTouched,
}: {
  year: number;
  birthYear: number | null;
  items: Memory[];
  chapter?: Chapter;
  lastTouched: string | null;
}) {
  const age = birthYear != null ? year - birthYear : null;
  return (
    <section id={`y-${year}`} aria-label={String(year)} className="relative flex scroll-mt-24">
      <div className="w-[var(--spine-x)] shrink-0 pr-3">
        <div className="sticky top-20 pt-2.5">
          <div className="year-numeral text-[2rem] leading-none text-ink">{year}</div>
          {age != null && age >= 0 && <div className="mt-1 text-xs text-graphite">{age === 0 ? 'Birth year' : `Age ${age}`}</div>}
        </div>
      </div>
      <ol
        className="relative min-w-0 flex-1 border-l-2 pb-6 pl-5"
        style={{ borderColor: chapter ? chapterVar(chapter.color) : 'var(--line)' }}
      >
        {items.map((m) => (
          <MemoryEntry key={m.id} memory={m} birthYear={birthYear} highlight={lastTouched === m.id} />
        ))}
      </ol>
    </section>
  );
}

function ChapterHeading({ chapter }: { chapter: Chapter }) {
  return (
    <div className="relative flex pb-1 pt-4">
      <div className="w-[var(--spine-x)] shrink-0" />
      <div
        className="-ml-px flex min-w-0 flex-1 items-center gap-3 border-l-[4px] py-1.5 pl-[1.15rem]"
        style={{ borderColor: chapterVar(chapter.color) }}
      >
        <span className="display truncate text-[0.95rem] font-semibold">{chapter.title}</span>
        <span className="shrink-0 text-xs tabular-nums text-graphite">
          {chapter.startYear}–{chapter.endYear}
        </span>
      </div>
    </div>
  );
}

function GapRow({ from, to, onAdd, chapter }: { from: number; to: number; onAdd: () => void; chapter?: Chapter }) {
    return (
    <div className="relative flex">
      <div className="w-[var(--spine-x)] shrink-0 pr-3 pt-2">
        <div className="year-numeral text-base leading-none text-faint">{from}</div>
        {from !== to && <div className="year-numeral mt-0.5 text-base leading-none text-faint">{to}</div>}
      </div>
      <div
        className="flex min-w-0 flex-1 items-center justify-between gap-3 border-l-2 border-dashed pb-4 pl-5 pt-1"
        style={{ borderColor: chapter ? chapterVar(chapter.color) : 'var(--line)' }}
      >
        <p className="text-sm text-faint">Nothing here yet</p>
        <button
          onClick={onAdd}
          aria-label={`Add a memory from ${from === to ? from : `${from} to ${to}`}`}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-tide hover:bg-tide-wash"
        >
          <Plus size={15} /> Add one
        </button>
      </div>
    </div>
  );
}

function Milestone({ year, label, now }: { year: number; label: string; now?: boolean }) {
  return (
    <div className="relative flex items-center py-3">
      <div className="w-[var(--spine-x)] shrink-0 pr-3 text-right">
        <span className={cx('text-xs font-semibold', now ? 'text-ink' : 'text-graphite')}>{label}</span>
      </div>
      <span
        aria-hidden
        className={cx('-ml-[5px] h-3 w-3 rounded-full', now ? 'bg-lantern ring-4 ring-lantern-wash' : 'bg-ink')}
      />
      <span className="ml-3 text-sm tabular-nums text-graphite">{year}</span>
    </div>
  );
}

function DecadeScrubber({ decades, years }: { decades: number[]; years: number[] }) {
  const jump = (d: number) => {
    const y = years.find((x) => x >= d);
    document.getElementById(`y-${y}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav
      aria-label="Jump to decade"
      className="fixed right-1.5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-full bg-paper/80 px-1 py-2 shadow-raise backdrop-blur lg:right-[max(1.5rem,calc((100vw-15rem-48rem)/2-3rem))]"
    >
      {decades.map((d) => (
        <button
          key={d}
          onClick={() => jump(d)}
          className="rounded-full px-1.5 py-1 text-[0.7rem] font-semibold tabular-nums text-graphite hover:bg-tide-wash hover:text-tide"
        >
          ’{String(d).slice(2)}
        </button>
      ))}
    </nav>
  );
}

function EmptySpine() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
      <line x1="60" y1="8" x2="60" y2="112" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 6" />
      <circle cx="60" cy="34" r="7" fill="var(--mist)" stroke="var(--faint-ink)" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="60" cy="62" r="9" fill="var(--tide)" />
      <circle cx="60" cy="90" r="6" fill="var(--mist)" stroke="var(--tide)" strokeWidth="2" />
    </svg>
  );
}
