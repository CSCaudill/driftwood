import { useMemo, useRef, useState } from 'react';
import { Camera, Check, Plus, Trash2 } from 'lucide-react';
import { createPerson, deletePerson, findOrCreatePerson, updatePerson } from '../db/repo';
import { useBlobUrl, useMemories, usePeople } from '../hooks/data';
import { processAvatar } from '../lib/images';
import { RELATIONSHIPS, chapterVar } from '../lib/meta';
import { useResolvedPeople } from '../state/people';
import type { Person } from '../types';
import { Button, FieldLabel, RemoveButton, Sheet, TextArea, TextInput, cx } from './ui';

// ------------------------------------------------------------------ Avatar

export function initials(name: string) {
  const parts = name.replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PersonAvatar({
  person,
  size = 32,
  ring,
  className,
}: {
  person: Pick<Person, 'name' | 'avatar' | 'color'>;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const url = useBlobUrl(person.avatar);
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-ink',
        ring && 'ring-2 ring-mist',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: url ? undefined : `color-mix(in srgb, ${chapterVar(person.color)} 55%, var(--paper))`,
      }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(person.name)}
    </span>
  );
}

/** Overlapping avatars for a compact "who was there" summary. */
export function AvatarStack({ people, size = 22, max = 4 }: { people: Person[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <PersonAvatar key={p.id} person={p} size={size} ring className={i > 0 ? '-ml-1.5' : ''} />
      ))}
      {people.length > max && (
        <span
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-sunken text-[0.65rem] font-semibold text-graphite ring-2 ring-mist"
          style={{ width: size, height: size }}
        >
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ Picker

/**
 * "Who was there?" — pick from people you've already added (most frequent
 * first) or type a new name to add someone.
 */
export function PeoplePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const people = usePeople() ?? [];
  const memories = useMemories() ?? [];
  const selected = useResolvedPeople(value);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const frequency = useMemo(() => {
    const f = new Map<string, number>();
    for (const m of memories) for (const id of m.personIds) f.set(id, (f.get(id) ?? 0) + 1);
    return f;
  }, [memories]);

  const q = text.trim().toLowerCase();
  const suggestions = people
    .filter((p) => !value.includes(p.id))
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.relationship.toLowerCase().includes(q))
    .sort((a, b) => (frequency.get(b.id) ?? 0) - (frequency.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, q ? 6 : 8);

  const add = async () => {
    if (!q) return;
    const match = people.find((p) => p.name.toLowerCase() === q);
    const person = match ?? (await findOrCreatePerson(text));
    if (!value.includes(person.id)) onChange([...value, person.id]);
    setText('');
    setAdding(false);
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((p) => (
            <span key={p.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-tide-wash py-1 pl-1 pr-1 text-sm text-tide">
              <PersonAvatar person={p} size={30} />
              <span className="font-medium">{p.name}</span>
              <RemoveButton
                label={`Remove ${p.name}`}
                onRemove={() => onChange(value.filter((id) => id !== p.id))}
                className="h-8 w-8 hover:bg-paper/60"
                iconSize={16}
              />
            </span>
          ))}
        </div>
      )}

      {(suggestions.length > 0 || !adding) && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
          {suggestions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange([...value, p.id]);
                setText('');
              }}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm text-ink hover:border-tide"
            >
              <PersonAvatar person={p} size={26} />
              {p.name}
              {p.relationship && p.relationship.toLowerCase() !== p.name.toLowerCase() && (
                <span className="text-faint">{p.relationship}</span>
              )}
            </button>
          ))}
          {!adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                requestAnimationFrame(() => input.current?.focus());
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-sm font-medium text-graphite hover:border-tide hover:text-tide"
            >
              <Plus size={15} /> {people.length ? 'Someone else' : 'Add a person'}
            </button>
          )}
        </div>
      )}

      {adding && (
        <div className="mt-2 flex gap-2">
          <TextInput
            ref={input}
            aria-label="Person’s name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                setAdding(false);
                setText('');
              }
            }}
            placeholder="Name, e.g. Grandma Rose"
          />
          <Button type="button" variant="primary" onClick={add} disabled={!q}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Person sheet

export function PersonSheet({
  person,
  onClose,
  onSaved,
  onDeleted,
}: {
  person: Partial<Person>;
  onClose: () => void;
  onSaved?: (p: Person) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(person.name ?? '');
  const [relationship, setRelationship] = useState(person.relationship ?? '');
  const [notes, setNotes] = useState(person.notes ?? '');
  const [avatar, setAvatar] = useState<Blob | null>(person.avatar ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const avatarUrl = useBlobUrl(avatar);

  const save = async () => {
    if (!name.trim()) return;
    const draft = { name, relationship, notes, avatar };
    const saved = person.id ? await updatePerson(person.id, draft) : await createPerson(draft);
    onSaved?.(saved);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="sm"
      title={person.id ? 'Edit person' : 'Add a person'}
      footer={
        confirmDelete ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-graphite">They’ll be removed from every memory. The memories stay.</p>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>Keep</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deletePerson(person.id!);
                onDeleted?.();
                onClose();
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {person.id && (
              <Button variant="quiet" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                Remove
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              {person.id ? 'Save changes' : 'Add person'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5 pt-1">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full"
            aria-label={avatar ? 'Change photo' : 'Add photo'}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <PersonAvatar person={{ name: name || '?', avatar: null, color: person.color ?? 'sage' }} size={80} />
            )}
            <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-[var(--overlay)] text-white">
              <Camera size={14} />
            </span>
          </button>
          <div className="min-w-0 flex-1 text-sm text-graphite">
            A photo helps you spot them on the timeline.
            {avatar && (
              <button type="button" onClick={() => setAvatar(null)} className="mt-1 block font-medium text-tide">
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setAvatar(await processAvatar(f));
                setError(null);
              } catch (err) {
                setError((err as Error).message);
              }
              e.target.value = '';
            }}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}

        <div>
          <FieldLabel htmlFor="p-name">Name</FieldLabel>
          <TextInput id="p-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Grandma Rose" />
        </div>
        <div>
          <FieldLabel htmlFor="p-rel" hint="Optional">Who are they to you?</FieldLabel>
          <TextInput id="p-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Grandmother, best friend, coach…" />
          <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {RELATIONSHIPS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelationship(r)}
                aria-pressed={relationship === r}
                className={cx(
                  'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm',
                  relationship === r ? 'border-tide bg-tide-wash text-tide' : 'border-line text-graphite hover:text-ink',
                )}
              >
                {relationship === r && <Check size={13} />}
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="p-notes" hint="Optional">About them</FieldLabel>
          <TextArea id="p-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="reading" placeholder="What you remember about them in general." />
        </div>
      </div>
    </Sheet>
  );
}
