import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Pencil, Star, Trash2, Users } from 'lucide-react';
import { Button, IconButton, Sheet, cx } from '../components/ui';
import { db } from '../db/db';
import { deleteMemory, toggleFavorite, restoreMemories } from '../db/repo';
import { useChapters, useMemories, useMemory, usePhotos, useBlobUrl, useSettings } from '../hooks/data';
import { formatFuzzyDate, precisionLabel } from '../lib/fuzzyDate';
import { CLARITY, chapterVar, feelingMeta } from '../lib/meta';
import { buildSections } from '../lib/ordering';
import { promptById } from '../lib/prompts';
import { useApp } from '../state/app';
import type { Photo } from '../types';

export function MemoryScreen() {
  const { id } = useParams();
  const memory = useMemory(id);
  const memories = useMemories();
  const settings = useSettings();
  const chapters = useChapters();
  const photos = usePhotos(memory?.photoIds ?? []);
  const navigate = useNavigate();
  const { openEditor, showToast } = useApp();
  const [confirming, setConfirming] = useState(false);

  // Chronological neighbours (unplaced memories are browsed among themselves).
  const { prev, next } = useMemo(() => {
    if (!memories || !memory) return { prev: undefined, next: undefined };
    const ordered =
      memory.groupYear == null
        ? memories.filter((m) => m.groupYear == null).sort((a, b) => b.createdAt - a.createdAt)
        : buildSections(memories).flatMap((s) => s.items);
    const i = ordered.findIndex((m) => m.id === memory.id);
    return { prev: ordered[i - 1], next: ordered[i + 1] };
  }, [memories, memory]);

  if (memory === undefined) return <div className="h-dvh" />;
  if (memory === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-graphite">This memory was deleted.</p>
        <Link to="/" className="mt-4 inline-block font-medium text-tide">Back to timeline</Link>
      </div>
    );
  }

  const feeling = feelingMeta(memory.feeling);
  const clarity = CLARITY.find((c) => c.value === memory.clarity)!;
  const chapter =
    memory.groupYear != null
      ? chapters.find((c) => memory.groupYear! >= c.startYear && memory.groupYear! <= c.endYear)
      : undefined;
  const prompt = promptById(memory.promptId);

  const remove = async () => {
    const snapshot = memory;
    const photoRows = await db.photos.where('memoryId').equals(memory.id).toArray();
    await deleteMemory(memory.id);
    navigate(-1);
    showToast('Memory deleted', {
      label: 'Undo',
      run: async () => {
        await restoreMemories([snapshot]);
        await db.photos.bulkPut(photoRows);
      },
    });
  };

  return (
    <article className="mx-auto w-full max-w-2xl pb-28">
      <header className="safe-top sticky top-0 z-20 bg-mist/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-1 px-2 sm:px-4">
          <IconButton label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <ArrowLeft size={20} />
          </IconButton>
          <div className="flex-1" />
          <IconButton label={memory.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => toggleFavorite(memory.id)}>
            <Star size={19} className={memory.favorite ? 'fill-lantern text-lantern' : ''} />
          </IconButton>
          <IconButton label="Delete memory" onClick={() => setConfirming(true)}>
            <Trash2 size={19} />
          </IconButton>
          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEditor({ memoryId: memory.id })} className="ml-1">
            Edit
          </Button>
        </div>
      </header>

      {photos.length > 0 && <Gallery photos={photos} faint={memory.clarity === 'faint'} />}

      <div className="px-5 sm:px-8">
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink">{formatFuzzyDate(memory.date, settings.birthYear)}</span>
          <span className="rounded-md bg-sunken px-1.5 py-0.5 text-xs text-graphite">{precisionLabel(memory.date)}</span>
          {chapter && (
            <span className="inline-flex items-center gap-1.5 text-graphite">
              <span className="h-2 w-2 rounded-full" style={{ background: chapterVar(chapter.color) }} aria-hidden />
              {chapter.title}
            </span>
          )}
        </div>

        <h1 className="display mt-2 text-3xl font-semibold leading-tight">{memory.title}</h1>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-graphite">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Clarity</dt>
            <ClarityMeter level={memory.clarity} />
            <dd>{clarity.label}</dd>
          </div>
          {feeling && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Feeling</dt>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: feeling.color }} aria-hidden />
              <dd>{feeling.label}</dd>
            </div>
          )}
          {memory.location && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Place</dt>
              <MapPin size={14} />
              <dd>{memory.location}</dd>
            </div>
          )}
          {memory.people.length > 0 && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">People</dt>
              <Users size={14} />
              <dd>{memory.people.join(', ')}</dd>
            </div>
          )}
        </dl>

        {prompt && (
          <p className="reading mt-6 border-l-2 border-tide pl-4 text-[0.95rem] italic text-graphite">{prompt.text}</p>
        )}

        {memory.notes ? (
          <div className="reading mt-6 whitespace-pre-wrap text-[1.08rem] text-ink">{memory.notes}</div>
        ) : (
          <button
            onClick={() => openEditor({ memoryId: memory.id })}
            className="mt-6 w-full rounded-2xl border border-dashed border-line px-5 py-6 text-left text-graphite hover:border-tide hover:text-tide"
          >
            Add notes as more comes back to you.
          </button>
        )}

        {memory.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {memory.tags.map((t) => (
              <span key={t} className="rounded-lg bg-sunken px-2.5 py-1 text-sm text-graphite">{t}</span>
            ))}
          </div>
        )}

        <p className="mt-10 text-xs text-faint">
          Written {new Date(memory.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          {memory.updatedAt - memory.createdAt > 60_000 &&
            `, last edited ${new Date(memory.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
        </p>

        <nav className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5" aria-label="Neighbouring memories">
          {prev ? (
            <Link to={`/memory/${prev.id}`} replace className="group rounded-2xl p-3 hover:bg-paper">
              <span className="flex items-center gap-1 text-xs text-graphite"><ChevronLeft size={14} /> Earlier</span>
              <span className="mt-1 block truncate font-medium">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/memory/${next.id}`} replace className="group rounded-2xl p-3 text-right hover:bg-paper">
              <span className="flex items-center justify-end gap-1 text-xs text-graphite">Later <ChevronRight size={14} /></span>
              <span className="mt-1 block truncate font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title="Delete this memory?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button variant="danger" onClick={remove}>Delete memory</Button>
          </div>
        }
      >
        <p className="text-graphite">“{memory.title}” and its photos will be removed from this device.</p>
      </Sheet>
    </article>
  );
}

function ClarityMeter({ level }: { level: 'vivid' | 'partial' | 'faint' }) {
  const n = level === 'vivid' ? 3 : level === 'partial' ? 2 : 1;
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cx('w-1 rounded-full', i <= n ? 'bg-tide' : 'bg-line')} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}

function Gallery({ photos, faint }: { photos: Photo[]; faint: boolean }) {
  return (
    <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:px-8">
      {photos.map((p) => (
        <GalleryImage key={p.id} photo={p} single={photos.length === 1} faint={faint} />
      ))}
    </div>
  );
}

function GalleryImage({ photo, single, faint }: { photo: Photo; single: boolean; faint: boolean }) {
  const url = useBlobUrl(photo.blob);
  return (
    <figure
      className={cx('shrink-0 snap-center overflow-hidden rounded-3xl bg-sunken', single ? 'w-full' : 'w-[85%] sm:w-[70%]')}
      style={{ aspectRatio: `${photo.width} / ${photo.height}`, maxHeight: '62dvh' }}
    >
      {url && <img src={url} alt="" className={cx('h-full w-full object-cover', faint && 'saturate-50')} />}
    </figure>
  );
}
