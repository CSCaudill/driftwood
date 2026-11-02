import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CornerDownLeft } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';
import { DictateButton } from '../components/Voice';
import { createMemory, emptyDraft } from '../db/repo';
import { useMemories } from '../hooks/data';
import { useApp } from '../state/app';

/**
 * Unplaced: the inbox for memories that surfaced without a when. Capturing
 * should take seconds; placing can happen later.
 */
export function UnplacedScreen() {
  const memories = useMemories();
  const { openEditor, showToast } = useApp();
  const [text, setText] = useState('');
  const unplaced = (memories ?? []).filter((m) => m.groupYear == null).sort((a, b) => b.createdAt - a.createdAt);

  const capture = async () => {
    const title = text.trim();
    if (!title) return;
    await createMemory(emptyDraft({ title, clarity: 'faint' }));
    setText('');
    showToast('Saved. Place it on your timeline when you’re ready.');
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-8">
      <header className="safe-top">
        <div className="pb-2 pt-6">
          <h1 className="display text-2xl font-semibold">Unplaced</h1>
          <p className="mt-1 text-graphite">Memories waiting for a when. Not knowing yet is completely fine.</p>
        </div>
      </header>

      <form
        className="mt-4 rounded-3xl border border-line bg-paper p-2 pl-4 shadow-raise focus-within:border-tide"
        onSubmit={(e) => {
          e.preventDefault();
          capture();
        }}
      >
        <label htmlFor="quick" className="sr-only">Quick capture</label>
        <div className="flex items-center gap-2">
          <input
            id="quick"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Something just came back to you…"
            className="h-11 min-w-0 flex-1 bg-transparent text-[1rem] placeholder:text-faint focus:outline-none"
            maxLength={140}
          />
          <Button type="submit" variant="primary" size="md" disabled={!text.trim()} icon={<CornerDownLeft size={16} />}>
            Save
          </Button>
        </div>
      </form>
      <div className="mt-2 px-1">
        <DictateButton label="Say it instead" onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
      </div>

      {unplaced.length === 0 ? (
        <EmptyState title="Nothing waiting">
          When a memory comes back but you don’t know when it happened, jot it down above. It’ll wait here.
        </EmptyState>
      ) : (
        <ul className="mt-6 divide-y divide-line">
          {unplaced.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Link to={`/memory/${m.id}`} className="min-w-0 flex-1 rounded-xl py-1">
                <span className="block truncate text-[1rem] font-medium">{m.title}</span>
                <span className="text-xs text-faint">
                  Written {new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                icon={<CalendarPlus size={15} />}
                onClick={() => openEditor({ memoryId: m.id, focusDate: true })}
              >
                Place it
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
