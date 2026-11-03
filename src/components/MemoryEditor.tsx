import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { db } from '../db/db';
import {
  createMemory,
  emptyDraft,
  prunePhotos,
  pruneRecordings,
  savePhotos,
  saveRecordings,
  updateMemory,
  type MemoryDraft,
} from '../db/repo';
import { useMemories, useSettings } from '../hooks/data';
import { formatFuzzyDate, fuzzyFromIso } from '../lib/fuzzyDate';
import { appendDictation, type VoiceClip } from '../lib/speech';
import { CLARITY, FEELINGS, SOURCES } from '../lib/meta';
import { useApp } from '../state/app';
import { FuzzyDatePicker } from './FuzzyDatePicker';
import { PeoplePicker } from './People';
import { PhotoPicker, type EditorPhoto } from './Photos';
import { DictateButton, VoicePlayer, VoiceRecorder } from './Voice';
import { TokenInput } from './TokenInput';
import { Button, Chip, FieldLabel, Segmented, Sheet, TextArea, TextInput, Toggle, cx } from './ui';

interface EditorClip {
  key: string;
  /** Set when the recording already exists in the database. */
  storedId?: string;
  clip: VoiceClip;
}

export function MemoryEditorHost() {
  const { editor, closeEditor } = useApp();
  if (!editor) return null;
  // Key on the request so state resets between openings.
  return <MemoryEditor key={editor.memoryId ?? JSON.stringify(editor.initial ?? {})} onClose={closeEditor} />;
}

function MemoryEditor({ onClose }: { onClose: () => void }) {
  const { editor, showToast, setLastTouched } = useApp();
  const settings = useSettings();
  const all = useMemories();
  const isEdit = !!editor?.memoryId;

  const [draft, setDraft] = useState<MemoryDraft>(() => emptyDraft(editor?.initial));
  const [photos, setPhotos] = useState<EditorPhoto[]>([]);
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);
  const [showMore, setShowMore] = useState(false);
  const [photoDate, setPhotoDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dateSection = useRef<HTMLElement>(null);

  useEffect(() => {
    if (loaded && editor?.focusDate) {
      requestAnimationFrame(() => dateSection.current?.scrollIntoView({ block: 'start' }));
    }
  }, [loaded, editor?.focusDate]);

  useEffect(() => {
    if (!editor?.memoryId) return;
    (async () => {
      const m = await db.memories.get(editor.memoryId!);
      if (!m) return onClose();
      const { id: _id, sortStart: _s, sortEnd: _e, groupYear: _g, rank: _r, createdAt: _c, updatedAt: _u, ...rest } = m;
      setDraft(rest);
      const stored = await db.photos.bulkGet(m.photoIds);
      setPhotos(stored.filter((p) => !!p).map((p) => ({ kind: 'stored', id: p!.id, thumb: p!.thumb })));
      const recs = await db.recordings.where('memoryId').equals(m.id).sortBy('createdAt');
      setClips(recs.map((r) => ({ key: r.id, storedId: r.id, clip: { blob: r.blob, mime: r.mime, durationMs: r.durationMs } })));
      setShowMore(!!(m.location || m.tags.length || m.isPrivate));
      setLoaded(true);
    })();
  }, [editor?.memoryId, onClose]);

  const tagSuggestions = useMemo(() => {
    const tags = new Map<string, number>();
    for (const m of all ?? []) m.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1));
    return [...tags].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [all]);

  const set = <K extends keyof MemoryDraft>(k: K, v: MemoryDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onPhotoDate = (iso: string) => {
    const fd = fuzzyFromIso(iso);
    if (!fd) return;
    if (draft.date.precision === 'unknown') {
      set('date', fd);
      showToast(`Date set from photo: ${formatFuzzyDate(fd, null)}`);
    } else {
      setPhotoDate(iso);
    }
  };

  const canSave = draft.title.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let id = editor?.memoryId;
      if (!id) id = (await createMemory({ ...draft, photoIds: [] })).id;

      const newOnes = photos.filter((p): p is Extract<EditorPhoto, { kind: 'new' }> => p.kind === 'new');
      const newIds = await savePhotos(id, newOnes.map((p) => p.data));
      let n = 0;
      const photoIds = photos.map((p) => (p.kind === 'stored' ? p.id : newIds[n++]));
      await prunePhotos(id, photoIds);

      // Drop recordings removed in the editor, then add the new ones.
      await pruneRecordings(id, clips.filter((c) => c.storedId).map((c) => c.storedId!));
      await saveRecordings(id, clips.filter((c) => !c.storedId).map((c) => c.clip));
      const saved = await updateMemory(id, { ...draft, photoIds });
      editor?.onSaved?.(saved);

      setLastTouched(id);
      showToast(
        saved.groupYear == null
          ? 'Saved to Unplaced'
          : isEdit
            ? 'Changes saved'
            : `Added to ${saved.groupYear}`,
      );
      onClose();
    } catch (e) {
      showToast((e as Error).message || 'Couldn’t save this memory. Try again.');
      setSaving(false);
    }
  };

  const titlePlaceholder = editor?.promptText ? 'Give it a short title' : 'What do you remember?';
  const addClip = (clip: VoiceClip) => setClips((c) => [...c, { key: crypto.randomUUID?.() ?? String(Math.random()), clip }]);

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={editor?.heading ?? (isEdit ? 'Edit memory' : 'New memory')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {isEdit ? 'Save changes' : 'Save memory'}
          </Button>
        </div>
      }
    >
      {!loaded ? (
        <div className="h-64" />
      ) : (
        <form
          className="space-y-7 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            {editor?.promptText && (
              <p className="reading mb-3 rounded-2xl bg-tide-wash px-4 py-3 text-[0.95rem] italic text-tide">
                {editor.promptText}
              </p>
            )}
            <input
              data-autofocus={editor?.focusDate ? undefined : true}
              aria-label="Title"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={titlePlaceholder}
              className="display w-full bg-transparent text-2xl font-semibold placeholder:font-normal placeholder:text-faint focus:outline-none"
              maxLength={140}
            />
            <TextArea
              aria-label="Notes"
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Write what comes back: where you were, who was there, what you saw, heard or felt. Fragments are fine."
              rows={5}
              className="reading mt-3 text-[1.02rem]"
            />
            <div className="mt-2">
              <DictateButton label="Speak instead" onText={(t) => setDraft((d) => ({ ...d, notes: appendDictation(d.notes, t) }))} />
            </div>
          </div>

          <section ref={dateSection}>
            <FieldLabel hint="Choose how well you know it">When was it?</FieldLabel>
            <FuzzyDatePicker value={draft.date} onChange={(d) => set('date', d)} birthYear={settings.birthYear} />
            {photoDate && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 text-sm">
                <span className="text-graphite">
                  Photo was taken {formatFuzzyDate(fuzzyFromIso(photoDate)!, null)}
                </span>
                <Button size="sm" variant="secondary" type="button" onClick={() => { set('date', fuzzyFromIso(photoDate)!); setPhotoDate(null); }}>
                  Use this date
                </Button>
              </div>
            )}
          </section>

          <section>
            <FieldLabel hint="Family, friends, anyone who was part of it">Who was there?</FieldLabel>
            <PeoplePicker value={draft.personIds} onChange={(ids) => set('personIds', ids)} />
          </section>

          <section>
            <FieldLabel>Photos</FieldLabel>
            <PhotoPicker photos={photos} onChange={setPhotos} onDateFound={onPhotoDate} />
          </section>

          <section>
            <FieldLabel hint="Tell it out loud, in your own voice">Voice notes</FieldLabel>
            {clips.length > 0 && (
              <div className="mb-2 space-y-2">
                {clips.map((c) => (
                  <VoicePlayer
                    key={c.key}
                    blob={c.clip.blob}
                    durationMs={c.clip.durationMs}
                    onRemove={() => setClips((all) => all.filter((x) => x !== c))}
                  />
                ))}
              </div>
            )}
            <VoiceRecorder onRecorded={addClip} />
          </section>

          <section>
            <FieldLabel hint={CLARITY.find((c) => c.value === draft.clarity)?.description}>How clear is it?</FieldLabel>
            <Segmented
              label="Clarity"
              value={draft.clarity}
              onChange={(v) => set('clarity', v)}
              options={CLARITY.map((c) => ({ value: c.value, label: c.label }))}
            />
          </section>

          <section>
            <FieldLabel hint={SOURCES.find((x) => x.value === (draft.source ?? 'remembered'))?.description}>
              Where does this come from?
            </FieldLabel>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where this memory comes from">
              {SOURCES.map((o) => {
                const on = (draft.source ?? 'remembered') === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set('source', o.value)}
                    className={cx(
                      'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
                      on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-graphite hover:text-ink',
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {(draft.source === 'told' || draft.source === 'mixed') && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-ink">Who told you?</p>
                <PeoplePicker value={draft.sourcePersonIds ?? []} onChange={(ids) => set('sourcePersonIds', ids)} />
              </div>
            )}
          </section>

          <section>
            <FieldLabel>How does it feel?</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {FEELINGS.map((f) => (
                <Chip key={f.value} selected={draft.feeling === f.value} onClick={() => set('feeling', draft.feeling === f.value ? null : f.value)}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} aria-hidden />
                  {f.label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line">
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              aria-expanded={showMore}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span>
                <span className="block text-[0.95rem] font-semibold">Place, tags and privacy</span>
                <span className="text-sm text-graphite">Helps you find and connect memories later</span>
              </span>
              <ChevronDown size={18} className={cx('text-graphite transition-transform', showMore && 'rotate-180')} />
            </button>
            {showMore && (
              <div className="space-y-5 border-t border-line px-4 pb-4 pt-4">
                <div>
                  <FieldLabel htmlFor="m-place">Place</FieldLabel>
                  <TextInput id="m-place" value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="Grandma’s house, Lake Travis, Room 12…" />
                </div>
                <div>
                  <FieldLabel htmlFor="m-tags">Tags</FieldLabel>
                  <TokenInput id="m-tags" value={draft.tags} onChange={(v) => set('tags', v)} placeholder="school, summer, music…" suggestions={tagSuggestions} />
                </div>
                <Toggle
                  checked={draft.isPrivate}
                  onChange={(v) => set('isPrivate', v)}
                  label={<span className="inline-flex items-center gap-1.5"><Lock size={14} /> Keep it covered</span>}
                  description="Hides the details on the timeline until you tap to open it."
                />
              </div>
            )}
          </section>
          <button type="submit" hidden />
        </form>
      )}
    </Sheet>
  );
}
