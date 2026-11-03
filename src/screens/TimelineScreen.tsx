import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownUp, House, Plus, Search, Sparkles, Star, X } from 'lucide-react';
import { ArrangeList } from '../components/ArrangeList';
import { YearBlock } from '../components/YearBlock';
import { PromptCard } from '../components/PromptCard';
import { Button, Chip, EmptyState, IconButton, cx } from '../components/ui';
import { useChapters, useMemories, useSettings } from '../hooks/data';
import { loadSampleLife } from '../lib/sample';
import { updateSettings } from '../db/repo';
import { chapterVar, FEELINGS, SOURCES } from '../lib/meta';
import { buildSections } from '../lib/ordering';
import { currentYear } from '../lib/fuzzyDate';
import { useApp } from '../state/app';
import { FrameContext } from '../components/FrameContext';
import { contextForRange, contextForYear, gradeLabel, stageFor } from '../lib/frame';
import { splitByStage } from '../lib/gapPrompts';
import { usePeopleLookup } from '../state/people';
import { PersonAvatar } from '../components/People';
import type { Chapter, Feeling, Memory, MemorySource } from '../types';

type Row =
  | { kind: 'year'; year: number; items: Memory[] }
  | { kind: 'gap'; from: number; to: number };

export function TimelineScreen() {
  const memories = useMemories();
  const settings = useSettings();
  const chapters = useChapters();
  const { openEditor, lastTouched, setLastTouched } = useApp();
  const navigate = useNavigate();
  const [arranging, setArranging] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [source, setSource] = useState<MemorySource | null>(null);
  const peopleMap = usePeopleLookup();
  const searchInput = useRef<HTMLInputElement>(null);

  const filtering = !!query.trim() || favOnly || !!feeling || !!personId || !!source;
  const filtered = useMemo(() => {
    if (!memories) return [];
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (favOnly && !m.favorite) return false;
      if (feeling && m.feeling !== feeling) return false;
      if (personId && !m.personIds.includes(personId)) return false;
      if (source && (m.source ?? 'remembered') !== source) return false;
      if (!q) return true;
      const names = m.personIds.map((id) => {
        const p = peopleMap.get(id);
        return p ? `${p.name} ${p.relationship}` : '';
      });
      const hay = [m.title, m.notes, m.location, ...names, ...m.tags].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [memories, query, favOnly, feeling, personId, source, peopleMap]);

  // People who appear most, for the filter row.
  const topPeople = useMemo(() => {
    const f = new Map<string, number>();
    for (const m of memories ?? []) for (const id of m.personIds) f.set(id, (f.get(id) ?? 0) + 1);
    return [...f.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => peopleMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .slice(0, 10);
  }, [memories, peopleMap]);

  const sections = useMemo(() => buildSections(filtered), [filtered]);
  const unplacedCount = memories?.filter((m) => m.groupYear == null).length ?? 0;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const showGaps = settings.showGaps && !filtering;
    // Long empty stretches are split by stage of life, so each one gets
    // prompts for a single period rather than "ages 12–35".
    const pushGap = (from: number, to: number) => {
      const pieces = to - from + 1 > 6 ? splitByStage(from, to, settings.birthYear) : [[from, to] as [number, number]];
      for (const [a, b] of pieces) out.push({ kind: 'gap', from: a, to: b });
    };
    if (showGaps && settings.birthYear && sections[0] && sections[0].year > settings.birthYear) {
      pushGap(settings.birthYear, sections[0].year - 1);
    }
    sections.forEach((s, i) => {
      out.push({ kind: 'year', year: s.year, items: s.items });
      const next = sections[i + 1];
      if (showGaps && next && next.year - s.year > 1) pushGap(s.year + 1, next.year - 1);
    });
    // The years since the most recent memory, up to last year.
    const last = sections[sections.length - 1];
    if (showGaps && last && last.year < currentYear() - 1) pushGap(last.year + 1, currentYear() - 1);
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
              {filtering
                ? `${sections.reduce((n, s) => n + s.items.length, 0)} matching`
                : placed === 0 ? 'Nothing placed yet' : `${placed} ${placed === 1 ? 'memory' : 'memories'} across ${sections.length} ${sections.length === 1 ? 'year' : 'years'}`}
            </p>
          </div>
          {!arranging && (
            <IconButton label="Search memories" active={searching} onClick={() => { setSearching((s) => !s); if (searching) { setQuery(''); setFavOnly(false); setFeeling(null); setPersonId(null); setSource(null); } }}>
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
                placeholder="Search memories, people, places"
                className="h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-10 focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash"
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-graphite">
                  <X size={16} />
                </button>
              )}
            </div>
            {topPeople.length > 0 && (
              <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4" aria-label="Filter by person">
                {topPeople.map((p) => (
                  <Chip key={p.id} selected={personId === p.id} onClick={() => setPersonId(personId === p.id ? null : p.id)} className="shrink-0 pl-1">
                    <PersonAvatar person={p} size={22} />
                    {p.name}
                  </Chip>
                ))}
              </div>
            )}
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              <Chip selected={favOnly} onClick={() => setFavOnly((f) => !f)}>
                <Star size={13} className={favOnly ? 'fill-current' : ''} /> Favorites
              </Chip>
              {SOURCES.map((o) => (
                <Chip key={o.value} selected={source === o.value} onClick={() => setSource(source === o.value ? null : o.value)} className="shrink-0">
                  {o.value === 'remembered' ? 'Remembered' : o.value === 'told' ? 'Told to me' : o.value === 'record' ? 'From photos' : 'Some of each'}
                </Chip>
              ))}
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
          {!filtering && unplacedCount > 0 && (
            <Link
              to="/unplaced"
              className="mb-3 mt-2 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm hover:border-tide"
            >
              <span className="h-2 w-2 rounded-full bg-lantern" aria-hidden />
              <span className="flex-1">
                {unplacedCount} {unplacedCount === 1 ? 'memory is' : 'memories are'} waiting for a date
              </span>
              <span className="font-medium text-tide">Place</span>
            </Link>
          )}
          {!filtering && settings.birthYear && !chapters.some((c) => c.kind === 'home') && !settings.frameDismissed.includes('card-frame') && (
            <div className="mb-3 mt-2 flex items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5">
              <House size={18} className="mt-0.5 shrink-0 text-tide" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-ink">Where did you live growing up?</p>
                <p className="mt-0.5 text-graphite">
                  Homes, schools and jobs are some of the strongest memory cues. Add them to your life frame and they’ll show
                  alongside every year.
                </p>
                <Link to="/frame" className="mt-2 inline-block font-medium text-tide">Build my life frame</Link>
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => updateSettings({ frameDismissed: [...settings.frameDismissed, 'card-frame'] })}
                className="-mr-1 rounded-lg p-1.5 text-faint hover:bg-sunken hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!filtering && <PromptCard />}

          {filtering && sections.length === 0 && (
            <p className="py-16 text-center text-graphite">No memories match. Try another word or clear the filters.</p>
          )}

          {settings.birthYear && !filtering && sections[0] && (
            <Milestone year={settings.birthYear} label="Born" />
          )}

          {rows.map((row, i) => {
            const startYear = row.kind === 'year' ? row.year : row.from;
            const chapter = stageFor(chapters, startYear);
            const prev = rows[i - 1];
            const prevChapter = prev ? stageFor(chapters, prev.kind === 'year' ? prev.year : prev.from) : undefined;
            const heading = chapter && chapter.id !== prevChapter?.id && !filtering;
            return (
              <Fragment key={row.kind === 'year' ? row.year : `gap-${row.from}`}>
                {heading && <ChapterHeading chapter={chapter} />}
                {row.kind === 'gap' ? (
                  <GapRow
                    from={row.from}
                    to={row.to}
                    chapter={chapter}
                    context={contextForRange(row.from, row.to, chapters)}
                    birthYear={settings.birthYear}
                    onHelp={() => navigate(`/reflect?from=${row.from}&to=${row.to}`)}
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
                    context={filtering ? undefined : contextForYear(row.year, chapters, settings.birthYear, settings.showGrades)}
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

function GapRow({
  from,
  to,
  onAdd,
  onHelp,
  chapter,
  context,
  birthYear,
}: {
  from: number;
  to: number;
  onAdd: () => void;
  onHelp: () => void;
  chapter?: Chapter;
  context: { ongoing: Chapter[]; milestones: Chapter[] };
  birthYear: number | null;
}) {
  const years = from === to ? String(from) : `${from} to ${to}`;
  const grade = birthYear != null ? gradeSpan(from, to, birthYear) : null;
  return (
    <div className="relative flex">
      <div className="w-[var(--spine-x)] shrink-0 pr-3 pt-2">
        <div className="year-numeral text-base leading-none text-faint">{from}</div>
        {from !== to && <div className="year-numeral mt-0.5 text-base leading-none text-faint">{to}</div>}
      </div>
      <div
        className="min-w-0 flex-1 border-l-2 border-dashed pb-5 pl-5 pt-1"
        style={{ borderColor: chapter ? chapterVar(chapter.color) : 'var(--line)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-faint">Nothing here yet</p>
          <button
            onClick={onAdd}
            aria-label={`Add a memory from ${years}`}
            title={`Add a memory from ${years}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-tide hover:bg-tide-wash"
          >
            <Plus size={16} />
          </button>
        </div>
        <FrameContext ongoing={context.ongoing} milestones={context.milestones} grade={grade} className="mt-1" />
        <button
          onClick={onHelp}
          className="-ml-2.5 mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-tide hover:bg-tide-wash"
        >
          <Sparkles size={14} /> Help me remember
        </button>
      </div>
    </div>
  );
}

/** "1st–3rd grade" style label across a span of years. */
function gradeSpan(from: number, to: number, birthYear: number): string | null {
  const a = gradeLabel(from, birthYear);
  const b = gradeLabel(to, birthYear);
  if (!a || !b) return a ?? b;
  if (from === to) return a;
  const first = a.split('–')[0].replace(' grade', '');
  const last = b.includes('–') ? b.split('–')[1] : b;
  return `${first}–${last}`;
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
