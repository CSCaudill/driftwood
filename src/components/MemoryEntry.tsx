import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Images, Lock, MapPin, MessageCircle, Star } from 'lucide-react';
import { usePhotoThumb } from '../hooks/data';
import { formatFuzzyDateShort, resolveBounds, spanYears } from '../lib/fuzzyDate';
import { feelingMeta, sourceLabel } from '../lib/meta';
import type { Memory } from '../types';
import { AvatarStack } from './People';
import { useResolvedPeople } from '../state/people';
import { cx } from './ui';

/**
 * One memory on the timeline. Deliberately not a "card": text-first, sitting
 * on the spine, rendered at the clarity the person gave it.
 */
export function MemoryEntry({
  memory,
  birthYear,
  highlight,
}: {
  memory: Memory;
  birthYear: number | null;
  highlight?: boolean;
}) {
  const thumb = usePhotoThumb(memory.photoIds[0]);
  const people = useResolvedPeople(memory.personIds);
  const tellers = useResolvedPeople(memory.sourcePersonIds ?? []);
  const source = sourceLabel(memory.source, tellers.map((p) => p.name));
  const [revealed, setRevealed] = useState(false);
  const feeling = feelingMeta(memory.feeling);
  const bounds = resolveBounds(memory.date, birthYear);
  const span = bounds ? spanYears(bounds) : 0;
  const covered = memory.isPrivate && !revealed;

  return (
    <li
      id={`m-${memory.id}`}
      className={cx('relative rounded-2xl', highlight && 'anim-settle', `clarity-${memory.clarity}`)}
    >
      {/* Spine dot. Size and fill follow clarity. */}
      <span
        aria-hidden
        className={cx(
          'spine-dot absolute top-[1.15rem] -translate-x-1/2',
          memory.clarity === 'vivid' && 'h-3 w-3',
          memory.clarity === 'partial' && 'partial h-3 w-3',
          memory.clarity === 'faint' && 'faint h-3 w-3',
        )}
        style={{ left: 'calc(-1.25rem - 1px)' }}
      />
      {/* Span bar for memories covering several years. */}
      {span > 0 && (
        <span
          aria-hidden
          className="absolute top-[2.1rem] w-[3px] -translate-x-1/2 rounded-full bg-tide/25"
          style={{ left: 'calc(-1.25rem - 1px)', height: 'calc(100% - 2.4rem)' }}
        />
      )}

      {covered ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-paper"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunken text-graphite">
            <Lock size={16} />
          </span>
          <span>
            <span className="block text-[0.95rem] font-medium">Covered memory</span>
            <span className="text-sm text-graphite">{formatFuzzyDateShort(memory.date, birthYear)}. Tap to open.</span>
          </span>
        </button>
      ) : (
        <Link
          to={`/memory/${memory.id}`}
          className="group flex gap-4 rounded-2xl -mx-3 px-3 py-3 transition-colors hover:bg-paper focus-visible:bg-paper"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8rem] text-graphite">
              <span className="font-medium tabular-nums">{formatFuzzyDateShort(memory.date, birthYear)}</span>
              {span > 0 && <span className="text-faint">{span + 1} years</span>}
              {source && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-px text-[0.72rem] text-graphite">
                  <MessageCircle size={11} aria-hidden /> {source}
                </span>
              )}
              {feeling && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: feeling.color }} aria-hidden />
                  {feeling.label}
                </span>
              )}
              {memory.favorite && <Star size={13} className="fill-lantern text-lantern" aria-label="Favorite" />}
            </div>
            <h3 className="clarity-title display mt-1 text-[1.12rem] font-semibold leading-snug text-ink">
              {memory.title}
            </h3>
            {memory.notes && (
              <p className="reading mt-1 line-clamp-2 text-[0.93rem] leading-relaxed text-graphite">{memory.notes}</p>
            )}
            {(memory.location || people.length > 0) && (
              <p className="mt-2 flex items-center gap-2 text-[0.8rem] text-graphite">
                {people.length > 0 && <AvatarStack people={people} size={22} />}
                {people.length === 0 && memory.location && <MapPin size={12} className="shrink-0 text-faint" />}
                <span className="truncate">
                  {[people.length ? `With ${people.map((p) => p.name).join(', ')}` : '', memory.location]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </p>
            )}
          </div>
          {thumb && (
            <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-sunken sm:h-20 sm:w-20">
              <img src={thumb} alt="" className="clarity-media h-full w-full object-cover" loading="lazy" />
              {memory.photoIds.length > 1 && (
                <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-[var(--overlay)] px-1 py-0.5 text-[0.65rem] font-semibold text-white">
                  <Images size={10} /> {memory.photoIds.length}
                </span>
              )}
            </div>
          )}
        </Link>
      )}
    </li>
  );
}
