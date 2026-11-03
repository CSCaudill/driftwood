import { useMemo, useState } from 'react';
import { Briefcase, Diamond, Heart, House, Layers, Plus, Sparkles, X } from 'lucide-react';
import { Button, FieldLabel, Sheet, TextInput, cx } from '../components/ui';
import { deleteChapter, saveChapter, updateSettings } from '../db/repo';
import { useChapters, useMemories, useSettings } from '../hooks/data';
import { ANCHOR_KINDS, kindMeta, suggestFrame, type AnchorSuggestion } from '../lib/frame';
import { currentYear } from '../lib/fuzzyDate';
import { CHAPTER_COLORS, chapterVar } from '../lib/meta';
import type { Anchor, AnchorKind, ChapterColor } from '../types';

export const KIND_ICONS: Record<AnchorKind, typeof House> = {
  stage: Layers,
  home: House,
  work: Briefcase,
  relationship: Heart,
  milestone: Diamond,
};

/** Placeholder help for each kind, so empty sections teach what belongs there. */
const EMPTY_HINTS: Record<AnchorKind, string> = {
  stage: 'Stretches of life: school years, a city, a hard season, "the band years".',
  home: 'Every place you lived, even roughly. These are some of the strongest memory cues there are.',
  work: 'Jobs, roles and volunteering. Even a summer job helps place memories around it.',
  relationship: 'Partners, close friendships, or changes like a parent remarrying.',
  milestone: 'Single moments that anchor everything around them: a move, a graduation, a birth.',
};

/**
 * Life frame: the reference points memories hang on. Suggested from the birth
 * year, filled in by the person. Shown along the timeline and used to write
 * prompts for empty stretches.
 */
export function FrameScreen() {
  const anchors = useChapters();
  const memories = useMemories() ?? [];
  const settings = useSettings();
  const [editing, setEditing] = useState<Partial<Anchor> | null>(null);

  const suggestions = useMemo(
    () => (settings.birthYear ? suggestFrame(settings.birthYear, anchors, settings.frameDismissed) : []),
    [settings.birthYear, anchors, settings.frameDismissed],
  );

  const accept = (s: AnchorSuggestion) =>
    saveChapter({ kind: s.kind, title: s.title, startYear: s.startYear, endYear: s.endYear, color: s.color });
  const dismiss = (s: AnchorSuggestion) =>
    updateSettings({ frameDismissed: [...settings.frameDismissed, s.key] });

  const count = (a: Anchor) =>
    memories.filter((m) => m.groupYear != null && m.groupYear >= a.startYear && m.groupYear <= a.endYear).length;
  const span = Math.max(1, currentYear() - (settings.birthYear ?? Math.min(...anchors.map((a) => a.startYear), currentYear())) + 1);
  const origin = settings.birthYear ?? Math.min(...anchors.map((a) => a.startYear), currentYear());

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-8">
      <header className="safe-top pb-2 pt-6">
        <h1 className="display text-2xl font-semibold">Life frame</h1>
        <p className="mt-1 text-graphite">
          Reference points that help memories find their place: where you lived, school, work, the big moments. They
          appear along your timeline, and they shape the prompts for years you haven’t filled in yet.
        </p>
      </header>

      {/* Parallel tracks, like a life history calendar. */}
      {anchors.length > 0 && settings.birthYear && (
        <section className="mt-6 rounded-3xl border border-line bg-paper p-4" aria-label="Overview">
          {(['stage', 'home', 'work', 'relationship'] as AnchorKind[]).map((k) => {
            const list = anchors.filter((a) => a.kind === k);
            if (!list.length) return null;
            const Icon = KIND_ICONS[k];
            return (
              <div key={k} className="flex items-center gap-3 py-1.5">
                <Icon size={15} className="shrink-0 text-graphite" aria-label={kindMeta(k).plural} />
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                  {list.map((a) => (
                    <span
                      key={a.id}
                      title={`${a.title} ${a.startYear}–${a.endYear}`}
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        left: `${((a.startYear - origin) / span) * 100}%`,
                        width: `${((a.endYear - a.startYear + 1) / span) * 100}%`,
                        background: chapterVar(a.color),
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex justify-between pl-7 text-xs tabular-nums text-faint">
            <span>{origin}</span>
            <span>{currentYear()}</span>
          </div>
        </section>
      )}

      {!settings.birthYear && (
        <p className="mt-6 rounded-2xl bg-sunken px-4 py-3 text-sm text-graphite">
          Add your birth year in Settings and Driftwood will suggest school years and milestones to start your frame.
        </p>
      )}

      {suggestions.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-graphite">
              <Sparkles size={15} className="text-lantern" /> Suggested from your birth year
            </h2>
            <Button size="sm" variant="secondary" onClick={async () => { for (const s of suggestions) await accept(s); }}>
              Add all
            </Button>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const Icon = KIND_ICONS[s.kind];
              return (
                <li key={s.key} className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-paper/60 py-2.5 pl-3 pr-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-graphite">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.title}</span>
                    <span className="block text-sm text-graphite">
                      {s.startYear === s.endYear ? s.startYear : `${s.startYear}–${s.endYear}`}. {s.note}
                    </span>
                  </span>
                  <Button size="sm" variant="primary" onClick={() => accept(s)} aria-label={`Add ${s.title}`}>Add</Button>
                  <button
                    onClick={() => dismiss(s)}
                    aria-label={`Not for me: ${s.title}`}
                    className="rounded-lg p-2 text-faint hover:bg-sunken hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ANCHOR_KINDS.map(({ kind, plural }) => {
        const list = anchors.filter((a) => a.kind === kind).sort((a, b) => a.startYear - b.startYear);
        const Icon = KIND_ICONS[kind];
        return (
          <section key={kind} className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-graphite">
                <Icon size={15} /> {plural}
              </h2>
              <button
                onClick={() => setEditing({ kind, color: kind === 'stage' ? 'sage' : 'sand' })}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-tide hover:bg-tide-wash"
                aria-label={`Add ${kindMeta(kind).label.toLowerCase()}`}
              >
                <Plus size={15} /> Add
              </button>
            </div>
            {list.length === 0 ? (
              <button
                onClick={() => setEditing({ kind, color: kind === 'stage' ? 'sage' : 'sand' })}
                className="w-full rounded-2xl border border-dashed border-line px-4 py-3.5 text-left text-sm text-graphite hover:border-tide"
              >
                {EMPTY_HINTS[kind]}
              </button>
            ) : (
              <ul className="space-y-2">
                {list.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setEditing(a)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-line bg-paper px-4 py-3 text-left hover:border-tide"
                    >
                      <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: chapterVar(a.color) }} />
                      <span className="min-w-0 flex-1">
                        <span className="display block truncate text-[1.02rem] font-semibold">{a.title}</span>
                        <span className="block truncate text-sm tabular-nums text-graphite">
                          {[
                            a.detail,
                            a.startYear === a.endYear ? String(a.startYear) : `${a.startYear}–${a.endYear}`,
                            settings.birthYear
                              ? a.startYear === a.endYear
                                ? `age ${a.startYear - settings.birthYear}`
                                : `ages ${a.startYear - settings.birthYear}–${a.endYear - settings.birthYear}`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </span>
                      {kind !== 'milestone' && (
                        <span className="shrink-0 text-sm text-graphite">
                          {count(a)} {count(a) === 1 ? 'memory' : 'memories'}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {editing && <AnchorSheet anchor={editing} birthYear={settings.birthYear} onClose={() => setEditing(null)} />}
    </div>
  );
}

const TITLE_PLACEHOLDERS: Record<AnchorKind, string> = {
  stage: 'College, Living in Denver, The band years…',
  home: 'Maple Street house, Grandma’s, First apartment…',
  work: 'Grocery store, First teaching job…',
  relationship: 'Dating Sam, Married to Alex…',
  milestone: 'Moved to Austin, Graduated, Dad got sick…',
};
const DETAIL_PLACEHOLDERS: Record<AnchorKind, string> = {
  stage: 'School name or place (optional)',
  home: 'Town or street (optional)',
  work: 'Role or place (optional)',
  relationship: 'Anything that helps you place it (optional)',
  milestone: 'Optional detail',
};

function AnchorSheet({ anchor, birthYear, onClose }: { anchor: Partial<Anchor>; birthYear: number | null; onClose: () => void }) {
  const thisYear = currentYear();
  const [kind, setKind] = useState<AnchorKind>(anchor.kind ?? 'stage');
  const [title, setTitle] = useState(anchor.title ?? '');
  const [detail, setDetail] = useState(anchor.detail ?? '');
  const [startYear, setStart] = useState(anchor.startYear ?? (birthYear ? birthYear + 5 : thisYear - 10));
  const [endYear, setEnd] = useState(anchor.endYear ?? Math.min(startYear + 3, thisYear));
  const [color, setColor] = useState<ChapterColor>(anchor.color ?? 'sage');
  const single = kind === 'milestone';
  const years: number[] = [];
  for (let y = thisYear; y >= (birthYear ?? 1920); y--) years.push(y);
  const sel = 'h-11 w-full rounded-xl border border-line bg-paper px-3.5 focus:border-tide focus:outline-none';
  const ageOf = (y: number) => (birthYear ? `  (age ${y - birthYear})` : '');

  const save = async () => {
    if (!title.trim()) return;
    await saveChapter({ id: anchor.id, kind, title, detail, startYear, endYear: single ? startYear : endYear, color });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="sm"
      title={anchor.id ? `Edit ${kindMeta(kind).label.toLowerCase()}` : `Add ${kindMeta(kind).label.toLowerCase()}`}
      footer={
        <div className="flex items-center gap-2">
          {anchor.id && (
            <Button variant="danger" onClick={async () => { await deleteChapter(anchor.id!); onClose(); }}>Delete</Button>
          )}
          <div className="flex-1" />
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim()}>Save</Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        {!anchor.id && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Kind">
            {ANCHOR_KINDS.map(({ kind: k, label }) => {
              const Icon = KIND_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cx(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium',
                    kind === k ? 'border-ink bg-ink text-paper' : 'border-line text-graphite hover:text-ink',
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              );
            })}
          </div>
        )}
        <div>
          <FieldLabel htmlFor="a-title">Name</FieldLabel>
          <TextInput id="a-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={TITLE_PLACEHOLDERS[kind]} />
        </div>
        <div>
          <FieldLabel htmlFor="a-detail">Details</FieldLabel>
          <TextInput id="a-detail" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={DETAIL_PLACEHOLDERS[kind]} />
        </div>
        {single ? (
          <div>
            <FieldLabel htmlFor="a-year" hint="Your best guess is fine">Year</FieldLabel>
            <select id="a-year" className={sel} value={startYear} onChange={(e) => setStart(+e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}{ageOf(y)}</option>)}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <FieldLabel htmlFor="a-start" hint="Best guesses are fine">From</FieldLabel>
              <select id="a-start" className={sel} value={startYear} onChange={(e) => setStart(+e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}{ageOf(y)}</option>)}
              </select>
            </div>
            <span className="pb-3 text-sm text-graphite">to</span>
            <div>
              <FieldLabel htmlFor="a-end">Until</FieldLabel>
              <select id="a-end" className={sel} value={endYear} onChange={(e) => setEnd(+e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}{ageOf(y)}</option>)}
              </select>
            </div>
          </div>
        )}
        {kind === 'stage' && (
          <div>
            <FieldLabel>Color on the timeline</FieldLabel>
            <div className="flex gap-3" role="radiogroup" aria-label="Color">
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
        )}
      </div>
    </Sheet>
  );
}
