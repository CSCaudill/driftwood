import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { PersonAvatar, PersonSheet } from '../components/People';
import { Button, EmptyState } from '../components/ui';
import { useMemories, usePeople } from '../hooks/data';
import { CIRCLE_LABELS, circleOf, type Circle } from '../lib/meta';
import type { Person } from '../types';

/** Everyone who appears in your memories, grouped into family, friends and others. */
export function PeopleScreen() {
  const people = usePeople();
  const memories = useMemories() ?? [];
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => {
    const s = new Map<string, { count: number; first?: number; last?: number }>();
    for (const m of memories) {
      for (const id of m.personIds) {
        const e = s.get(id) ?? { count: 0 };
        e.count++;
        if (m.groupYear != null) {
          e.first = Math.min(e.first ?? m.groupYear, m.groupYear);
          e.last = Math.max(e.last ?? m.groupYear, m.groupYear);
        }
        s.set(id, e);
      }
    }
    return s;
  }, [memories]);

  const groups = useMemo(() => {
    const g: Record<Circle, Person[]> = { family: [], friends: [], others: [] };
    for (const p of people ?? []) g[circleOf(p.relationship)].push(p);
    for (const k of Object.keys(g) as Circle[]) {
      g[k].sort((a, b) => (stats.get(b.id)?.count ?? 0) - (stats.get(a.id)?.count ?? 0) || a.name.localeCompare(b.name));
    }
    return g;
  }, [people, stats]);

  if (!people) return <div className="h-dvh" />;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-8">
      <header className="safe-top flex items-end justify-between gap-3 pb-2 pt-6">
        <div>
          <h1 className="display text-2xl font-semibold">People</h1>
          <p className="mt-1 text-graphite">The people in your story, and the memories you share.</p>
        </div>
        <Button variant="primary" size="sm" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>
          Add person
        </Button>
      </header>

      {people.length === 0 ? (
        <EmptyState
          title="No one here yet"
          action={<Button variant="secondary" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>Add someone</Button>}
        >
          Add family and friends here, or tag them when you write a memory. Each person gets a page with every memory you
          share.
        </EmptyState>
      ) : (
        (Object.keys(groups) as Circle[])
          .filter((k) => groups[k].length)
          .map((k) => (
            <section key={k} className="mt-7">
              <h2 className="mb-2 text-sm font-semibold text-graphite">{CIRCLE_LABELS[k]}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {groups[k].map((p) => {
                  const st = stats.get(p.id);
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/people/${p.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 hover:border-tide"
                      >
                        <PersonAvatar person={p} size={48} />
                        <span className="min-w-0 flex-1">
                          <span className="display block truncate text-[1.02rem] font-semibold">{p.name}</span>
                          <span className="block truncate text-sm text-graphite">
                            {[
                              p.relationship && p.relationship !== p.name ? p.relationship : '',
                              st ? `${st.count} ${st.count === 1 ? 'memory' : 'memories'}` : 'No memories yet',
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                          {st?.first != null && (
                            <span className="block text-xs tabular-nums text-faint">
                              {st.first === st.last ? st.first : `${st.first}–${st.last}`}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
      )}

      {adding && <PersonSheet person={{}} onClose={() => setAdding(false)} />}
    </div>
  );
}
