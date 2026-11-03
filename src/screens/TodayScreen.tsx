import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { FrameContext } from '../components/FrameContext';
import { SampleBanner } from '../components/SampleBanner';
import { Button, IconButton } from '../components/ui';
import { useChapters, useMemories, usePhotoThumb, useSettings } from '../hooks/data';
import { contextForRange } from '../lib/frame';
import { formatFuzzyDate } from '../lib/fuzzyDate';
import { biggestGap, spanLabel } from '../lib/gapPrompts';
import { dailyPrompt, PROMPT_THEMES } from '../lib/prompts';
import { greeting, partOfDay, resurface } from '../lib/today';
import { useApp } from '../state/app';
import type { Memory } from '../types';

/**
 * Today: what you see when you open Lantern. A greeting, one prompt, one
 * memory to revisit, and the quietest stretch of your timeline. Calm on
 * purpose: no streaks, no counts to beat.
 */
export function TodayScreen() {
  const memories = useMemories();
  const settings = useSettings();
  const anchors = useChapters();
  const { openEditor } = useApp();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const now = new Date();

  const placed = useMemo(() => (memories ?? []).filter((m) => m.groupYear != null), [memories]);
  const unplaced = (memories?.length ?? 0) - placed.length;
  const years = new Set(placed.map((m) => m.groupYear)).size;
  const revisit = useMemo(() => (memories ? resurface(memories, now) : null), [memories]); // eslint-disable-line react-hooks/exhaustive-deps
  const gap = useMemo(() => (memories?.length ? biggestGap(memories, settings.birthYear) : null), [memories, settings.birthYear]);
  const prompt = dailyPrompt(offset);

  if (!memories) return <div className="h-dvh" />;

  const name = settings.name ? `, ${settings.name}` : '';
  const summary =
    placed.length === 0
      ? 'Your timeline is ready for its first memory.'
      : `You’ve placed ${placed.length} ${placed.length === 1 ? 'memory' : 'memories'} across ${years} ${years === 1 ? 'year' : 'years'} of your life.`;

  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden px-5 pb-32 sm:px-8">
      {/* A soft lantern glow behind the greeting. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full opacity-70"
        style={{ background: 'radial-gradient(closest-side, var(--lantern-wash), transparent)' }}
      />

      <header className="safe-top relative pt-10">
        <p className="text-sm text-graphite">
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="display mt-2 text-[2.4rem] font-semibold leading-[1.05]">
          {greeting(now)}
          {name}.
        </h1>
        <p className="reading mt-3 text-[1.05rem] text-graphite">{summary}</p>
      </header>

      <SampleBanner className="relative mt-6" />

      {/* Prompt */}
      <section className="relative mt-8 rounded-3xl bg-tide-wash px-6 pb-5 pt-5" aria-label="Prompt">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-tide">
            {partOfDay(now)} prompt
            <span className="font-normal text-tide/80">. {PROMPT_THEMES[prompt.theme]}</span>
          </span>
          <IconButton label="Show another prompt" onClick={() => setOffset((o) => o + 1)} className="-mr-2 h-8 w-8 text-tide hover:bg-paper/50">
            <RefreshCw size={15} />
          </IconButton>
        </div>
        <p className="reading mt-2 text-[1.35rem] leading-snug text-ink">{prompt.text}</p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => navigate(`/reflect?prompt=${prompt.id}`)}>Reflect on this</Button>
        </div>
      </section>

      {/* A memory to revisit */}
      {revisit && <Revisit memory={revisit.memory} onThisDay={revisit.onThisDay} birthYear={settings.birthYear} />}

      {/* The quietest stretch */}
      {gap && settings.showGaps && (
        <section className="relative mt-8" aria-label="A quiet stretch">
          <h2 className="text-sm font-semibold text-graphite">A quiet stretch</h2>
          <div className="mt-3 rounded-3xl border border-dashed border-line px-5 py-4">
            <p className="display text-[1.15rem] font-semibold">
              Nothing yet from {spanLabel(gap[0], gap[1], settings.birthYear)}
            </p>
            {(() => {
              const ctx = contextForRange(gap[0], gap[1], anchors);
              return <FrameContext ongoing={ctx.ongoing} milestones={ctx.milestones} className="mt-2" />;
            })()}
            <button
              onClick={() => navigate(`/reflect?from=${gap[0]}&to=${gap[1]}`)}
              className="-ml-2.5 mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-tide hover:bg-tide-wash"
            >
              <Sparkles size={15} /> Help me remember
            </button>
          </div>
        </section>
      )}

      {unplaced > 0 && (
        <Link
          to="/unplaced"
          className="relative mt-6 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm hover:border-tide"
        >
          <span className="h-2 w-2 rounded-full bg-lantern" aria-hidden />
          <span className="flex-1">
            {unplaced} {unplaced === 1 ? 'memory is' : 'memories are'} waiting for a date
          </span>
          <span className="font-medium text-tide">Place</span>
        </Link>
      )}

      <div className="relative mt-10 flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="lg" className="sm:flex-1" onClick={() => navigate('/')}>
          Open my timeline
        </Button>
        <Button size="lg" icon={<Plus size={18} />} className="sm:flex-1" onClick={() => openEditor()}>
          New memory
        </Button>
      </div>
    </div>
  );
}

function Revisit({ memory, onThisDay, birthYear }: { memory: Memory; onThisDay: boolean; birthYear: number | null }) {
  const thumb = usePhotoThumb(memory.photoIds[0]);
  const yearsAgo = onThisDay && memory.date.year ? new Date().getFullYear() - memory.date.year : null;
  return (
    <section className="relative mt-8" aria-label="A memory to revisit">
      <h2 className="text-sm font-semibold text-graphite">
        {onThisDay ? `On this day, ${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago` : 'From your past'}
      </h2>
      <Link
        to={`/memory/${memory.id}`}
        className={`clarity-${memory.clarity} mt-3 flex gap-4 rounded-3xl border border-line bg-paper p-4 transition-colors hover:border-tide`}
      >
        {thumb && (
          <img src={thumb} alt="" className="clarity-media h-24 w-24 shrink-0 rounded-2xl object-cover" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8rem] font-medium text-graphite">{formatFuzzyDate(memory.date, birthYear)}</span>
          <span className="clarity-title display mt-1 block text-[1.15rem] font-semibold leading-snug">{memory.title}</span>
          {memory.notes && (
            <span className="reading mt-1 line-clamp-3 block text-[0.95rem] leading-relaxed text-graphite">{memory.notes}</span>
          )}
        </span>
      </Link>
    </section>
  );
}
