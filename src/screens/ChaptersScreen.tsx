import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, EmptyState, FieldLabel, Sheet, TextInput, cx } from '../components/ui';
import { deleteChapter, saveChapter, suggestedChapters } from '../db/repo';
import { useChapters, useMemories, useSettings } from '../hooks/data';
import { currentYear } from '../lib/fuzzyDate';
import { CHAPTER_COLORS, chapterVar } from '../lib/meta';
import type { Chapter, ChapterColor } from '../types';

/**
 * Chapters are named stretches of life ("High school", "The Denver years").
 * They color the spine of the timeline and help people think in eras when
 * exact years are hard to recall.
 */
export function ChaptersScreen() {
  const chapters = useChapters();
  const memories = useMemories() ?? [];
  const { birthYear } = useSettings();
  const [editing, setEditing] = useState<Partial<Chapter> | null>(null);

  const count = (c: Chapter) => memories.filter((m) => m.groupYear != null && m.groupYear >= c.startYear && m.groupYear <= c.endYear).length;
  const minYear = Math.min(...chapters.map((c) => c.startYear), currentYear());
  const span = Math.max(1, currentYear() - (birthYear ?? minYear));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-8">
      <header className="safe-top flex items-end justify-between gap-3 pb-2 pt-6">
        <div>
          <h1 className="display text-2xl font-semibold">Chapters</h1>
          <p className="mt-1 text-graphite">Name the eras of your life. They shape the timeline.</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setEditing({ color: 'sage' })}>
          New chapter
        </Button>
      </header>

      {chapters.length === 0 ? (
        <EmptyState
          title="No chapters yet"
          action={
            birthYear ? (
              <Button variant="secondary" onClick={async () => { for (const c of suggestedChapters(birthYear)) await saveChapter(c); }}>
                Start with school years
              </Button>
            ) : undefined
          }
        >
          A chapter can be a school, a city, a relationship, a job. Anything that marks a stretch of time.
        </EmptyState>
      ) : (
        <>
          {/* Life bar: a proportional overview of chapters from birth to now. */}
          {birthYear && (
            <div className="mt-6" aria-hidden>
              <div className="relative h-3 overflow-hidden rounded-full bg-sunken">
                {chapters.map((c) => (
                  <span
                    key={c.id}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${((c.startYear - birthYear) / span) * 100}%`,
                      width: `${((c.endYear - c.startYear + 1) / span) * 100}%`,
                      background: chapterVar(c.color),
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-faint">
                <span>{birthYear}</span>
                <span>{currentYear()}</span>
              </div>
            </div>
          )}

          <ul className="mt-6 space-y-2">
            {chapters.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setEditing(c)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-line bg-paper px-4 py-3.5 text-left hover:border-tide"
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: chapterVar(c.color) }} />
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-[1.05rem] font-semibold">{c.title}</span>
                    <span className="text-sm tabular-nums text-graphite">
                      {c.startYear}–{c.endYear}
                      {birthYear ? `, ages ${c.startYear - birthYear}–${c.endYear - birthYear}` : ''}
                    </span>
                  </span>
                  <span className="text-sm text-graphite">
                    {count(c)} {count(c) === 1 ? 'memory' : 'memories'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && <ChapterSheet chapter={editing} onClose={() => setEditing(null)} birthYear={birthYear} />}
    </div>
  );
}

function ChapterSheet({ chapter, onClose, birthYear }: { chapter: Partial<Chapter>; onClose: () => void; birthYear: number | null }) {
  const thisYear = currentYear();
  const [title, setTitle] = useState(chapter.title ?? '');
  const [startYear, setStart] = useState(chapter.startYear ?? (birthYear ? birthYear + 18 : thisYear - 10));
  const [endYear, setEnd] = useState(chapter.endYear ?? Math.min(startYear + 3, thisYear));
  const [color, setColor] = useState<ChapterColor>(chapter.color ?? 'sage');
  const years: number[] = [];
  for (let y = thisYear; y >= (birthYear ?? 1920); y--) years.push(y);
  const sel = 'h-11 w-full rounded-xl border border-line bg-paper px-3.5 focus:border-tide focus:outline-none';

  const save = async () => {
    if (!title.trim()) return;
    await saveChapter({ id: chapter.id, title, startYear, endYear, color });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="sm"
      title={chapter.id ? 'Edit chapter' : 'New chapter'}
      footer={
        <div className="flex items-center gap-2">
          {chapter.id && (
            <Button variant="danger" size="md" onClick={async () => { await deleteChapter(chapter.id!); onClose(); }}>
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim()}>Save chapter</Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        <div>
          <FieldLabel htmlFor="c-title">Name</FieldLabel>
          <TextInput id="c-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="College, Living in Denver, First job…" />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <FieldLabel htmlFor="c-start">From</FieldLabel>
            <select id="c-start" className={sel} value={startYear} onChange={(e) => setStart(+e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <span className="pb-3 text-sm text-graphite">to</span>
          <div>
            <FieldLabel htmlFor="c-end">Until</FieldLabel>
            <select id="c-end" className={sel} value={endYear} onChange={(e) => setEnd(+e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel>Color</FieldLabel>
          <div className="flex gap-3" role="radiogroup" aria-label="Chapter color">
            {CHAPTER_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.label}
                onClick={() => setColor(c.value)}
                className={cx('h-9 w-9 rounded-full ring-offset-2 ring-offset-paper transition', color === c.value && 'ring-2 ring-ink')}
                style={{ background: chapterVar(c.value) }}
              />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
