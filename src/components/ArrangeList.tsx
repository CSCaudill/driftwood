import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock } from 'lucide-react';
import { moveMemory, resetSectionOrder, restoreMemories } from '../db/repo';
import { formatFuzzyDateShort } from '../lib/fuzzyDate';
import { buildSections } from '../lib/ordering';
import { useApp } from '../state/app';
import type { Memory } from '../types';
import { cx } from './ui';

/**
 * Rearrange mode. Memories are listed flat with year headers between them.
 * Drag within a year to set the order you remember things happening; drag
 * into another year to re-date a fuzzy memory. Exact-day memories are pinned.
 */

type Item = { id: string; kind: 'year'; year: number; ranked: boolean } | { id: string; kind: 'memory'; memory: Memory };

export function ArrangeList({ memories, birthYear }: { memories: Memory[]; birthYear: number | null }) {
  const { showToast, setLastTouched } = useApp();
  const fromProps = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const s of buildSections(memories)) {
      out.push({ id: `year-${s.year}`, kind: 'year', year: s.year, ranked: s.items.some((m) => m.rank != null) });
      for (const m of s.items) out.push({ id: m.id, kind: 'memory', memory: m });
    }
    return out;
  }, [memories]);

  // Local copy so the list doesn't snap back while the database write lands.
  const [items, setItems] = useState(fromProps);
  useEffect(() => setItems(fromProps), [fromProps]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    let to = items.findIndex((i) => i.id === over.id);
    if (to === 0) to = 1; // can't go above the first year header
    const next = arrayMove(items, from, to);

    // Work out which year section it landed in, and where inside it.
    let year: number | null = null;
    let index = 0;
    for (let i = 0; i < next.length; i++) {
      const it = next[i];
      if (it.kind === 'year') {
        year = it.year;
        index = 0;
      } else if (it.id === active.id) break;
      else index++;
    }
    if (year == null) return;
    const moving = items[from] as Extract<Item, { kind: 'memory' }>;
    const changedYear = moving.memory.groupYear !== year;

    setItems(next);
    const res = await moveMemory(String(active.id), year, index);
    if (!res) {
      setItems(fromProps);
      showToast('Memories with an exact date stay in their year. Edit the date to move it.');
      return;
    }
    setLastTouched(res.moved.id);
    if (changedYear) {
      showToast(`Moved to ${formatFuzzyDateShort(res.moved.date, birthYear)}`, {
        label: 'Undo',
        run: () => restoreMemories(res.undo),
      });
    }
  };

  return (
    <div className="select-none pb-32 pt-2">
      <p className="mb-4 rounded-2xl bg-sunken px-4 py-3 text-sm leading-relaxed text-graphite">
        Drag memories into the order you remember them. Dropping one into another year updates its date.
        Memories with an exact day are <Lock size={12} className="inline -translate-y-px" /> pinned.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {items.map((it) =>
              it.kind === 'year' ? (
                <YearHeader key={it.id} item={it} birthYear={birthYear} />
              ) : (
                <SortableMemory key={it.id} memory={it.memory} birthYear={birthYear} />
              ),
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function YearHeader({ item, birthYear }: { item: Extract<Item, { kind: 'year' }>; birthYear: number | null }) {
  // Registered as sortable (so items can be dropped around it) but never draggable.
  const { setNodeRef, transform, transition } = useSortable({ id: item.id, disabled: true });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-end justify-between px-1 pb-1 pt-5 first:pt-1"
    >
      <span className="flex items-baseline gap-2.5">
        <span className="year-numeral text-2xl leading-none">{item.year}</span>
        {birthYear != null && item.year >= birthYear && (
          <span className="text-xs text-graphite">Age {item.year - birthYear}</span>
        )}
      </span>
      {item.ranked && (
        <button
          onClick={() => resetSectionOrder(item.year)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-tide hover:bg-tide-wash"
        >
          Sort by date
        </button>
      )}
    </li>
  );
}

function SortableMemory({ memory, birthYear }: { memory: Memory; birthYear: number | null }) {
  const pinned = memory.date.precision === 'day';
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: memory.id,
    disabled: pinned,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        'relative flex items-center gap-3 rounded-2xl border bg-paper py-2.5 pl-2 pr-4',
        isDragging ? 'z-10 border-tide shadow-raise' : 'border-line',
      )}
    >
      {pinned ? (
        <span className="flex h-10 w-9 items-center justify-center text-faint" title="Exact date, pinned">
          <Lock size={16} />
        </span>
      ) : (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag ${memory.title}`}
          className="flex h-10 w-9 touch-none items-center justify-center rounded-lg text-graphite hover:bg-sunken active:cursor-grabbing"
          style={{ cursor: 'grab' }}
        >
          <GripVertical size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.95rem] font-medium">{memory.title}</div>
        <div className="text-xs text-graphite">{formatFuzzyDateShort(memory.date, birthYear)}</div>
      </div>
    </li>
  );
}
