import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { PersonAvatar, PersonSheet } from '../components/People';
import { YearBlock } from '../components/YearBlock';
import { Button, IconButton } from '../components/ui';
import { useMemories, usePerson, useSettings } from '../hooks/data';
import { buildSections } from '../lib/ordering';
import { useApp } from '../state/app';

/** One person's page: who they are, and every memory you share, in order. */
export function PersonScreen() {
  const { id } = useParams();
  const person = usePerson(id);
  const memories = useMemories();
  const { birthYear } = useSettings();
  const { openEditor } = useApp();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const theirs = useMemo(() => (memories ?? []).filter((m) => id && m.personIds.includes(id)), [memories, id]);
  const sections = useMemo(() => buildSections(theirs), [theirs]);
  const unplaced = theirs.filter((m) => m.groupYear == null);

  if (person === undefined) return <div className="h-dvh" />;
  if (person === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-graphite">This person was removed.</p>
        <Link to="/people" className="mt-4 inline-block font-medium text-tide">Back to People</Link>
      </div>
    );
  }

  const first = sections[0]?.year;
  const last = sections[sections.length - 1]?.year;
  const addWith = () => openEditor({ initial: { personIds: [person.id] } });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 sm:px-8">
      <header className="safe-top sticky top-0 z-20 -mx-4 bg-mist/90 px-2 backdrop-blur-md sm:-mx-8 sm:px-4">
        <div className="flex h-14 items-center gap-1">
          <IconButton label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/people'))}>
            <ArrowLeft size={20} />
          </IconButton>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </header>

      <section className="flex flex-col items-center pb-8 pt-2 text-center">
        <PersonAvatar person={person} size={104} />
        <h1 className="display mt-4 text-3xl font-semibold">{person.name}</h1>
        {person.relationship && person.relationship !== person.name && (
          <p className="mt-1 text-graphite">{person.relationship}</p>
        )}
        <p className="mt-3 text-sm text-graphite">
          {theirs.length === 0
            ? 'No shared memories yet'
            : `${theirs.length} shared ${theirs.length === 1 ? 'memory' : 'memories'}${first ? `, ${first === last ? first : `${first}–${last}`}` : ''}`}
        </p>
        {person.notes && <p className="reading mt-4 max-w-md text-[1rem] text-ink">{person.notes}</p>}
        <Button className="mt-5" variant="primary" icon={<Plus size={16} />} onClick={addWith}>
          Add a memory with {person.name.split(' ')[0]}
        </Button>
      </section>

      {sections.length > 0 && (
        <div className="relative" style={{ ['--spine-x' as string]: '4.75rem' }}>
          {sections.map((s) => (
            <YearBlock key={s.year} year={s.year} birthYear={birthYear} items={s.items} anchor={false} />
          ))}
        </div>
      )}

      {unplaced.length > 0 && (
        <section className="mt-4 rounded-3xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold text-graphite">Not placed yet</h2>
          <ul className="mt-2 divide-y divide-line">
            {unplaced.map((m) => (
              <li key={m.id}>
                <Link to={`/memory/${m.id}`} className="block py-2.5 font-medium hover:text-tide">{m.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <PersonSheet person={person} onClose={() => setEditing(false)} onDeleted={() => navigate('/people', { replace: true })} />}
    </div>
  );
}
