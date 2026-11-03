import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Inbox, Settings } from 'lucide-react';
import { useChapters, useMemories } from '../hooks/data';

/** Phone-only hub for the screens that don't fit in the tab bar. */
export function MoreScreen() {
  const memories = useMemories() ?? [];
  const chapters = useChapters();
  const unplaced = memories.filter((m) => m.groupYear == null).length;
  const rows = [
    { to: '/unplaced', icon: Inbox, label: 'Unplaced', detail: unplaced ? `${unplaced} waiting for a date` : 'Nothing waiting', badge: unplaced },
    { to: '/frame', icon: BookOpen, label: 'Life frame', detail: chapters.length ? `${chapters.length} reference points` : 'Homes, school, work, milestones', badge: 0 },
    { to: '/settings', icon: Settings, label: 'Settings', detail: 'Profile, appearance, backups', badge: 0 },
  ];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-8">
      <header className="safe-top pb-2 pt-6">
        <h1 className="display text-2xl font-semibold">More</h1>
      </header>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">
        {rows.map(({ to, icon: Icon, label, detail, badge }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-4 px-4 py-4 hover:bg-sunken">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tide-wash text-tide">
                <Icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-sm text-graphite">{detail}</span>
              </span>
              {badge > 0 && <span className="rounded-full bg-lantern-wash px-2 text-xs font-semibold tabular-nums">{badge}</span>}
              <ChevronRight size={18} className="text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
