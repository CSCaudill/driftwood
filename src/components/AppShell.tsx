import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Inbox, Plus, Settings, Waypoints } from 'lucide-react';
import { useMemories } from '../hooks/data';
import { useApp } from '../state/app';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Timeline', icon: Waypoints, end: true },
  { to: '/unplaced', label: 'Unplaced', icon: Inbox },
  { to: '/chapters', label: 'Chapters', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Sidebar on wide screens, tab bar with a capture button on phones. */
export function AppShell({ children }: { children: ReactNode }) {
  const { openEditor, toast, dismissToast } = useApp();
  const memories = useMemories();
  const unplaced = memories?.filter((m) => m.groupYear == null).length ?? 0;

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-paper/60 px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <img src="./icon.svg" alt="" className="h-8 w-8 rounded-[9px]" />
          <span className="display text-lg font-semibold">Lifeline</span>
        </div>
        <button
          onClick={() => openEditor()}
          className="mt-7 flex h-11 items-center justify-center gap-2 rounded-xl bg-tide font-medium text-paper hover:bg-tide-strong"
        >
          <Plus size={18} /> New memory
        </button>
        <nav className="mt-6 space-y-0.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors',
                  isActive ? 'bg-tide-wash font-semibold text-tide' : 'text-graphite hover:bg-sunken hover:text-ink',
                )
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {to === '/unplaced' && unplaced > 0 && (
                <span className="rounded-full bg-lantern-wash px-2 text-xs font-semibold tabular-nums text-ink">{unplaced}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs leading-relaxed text-faint">Stored privately on this device.</p>
      </aside>

      <main>{children}</main>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/92 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {NAV.slice(0, 2).map((n) => <Tab key={n.to} {...n} badge={n.to === '/unplaced' ? unplaced : 0} />)}
          <div className="flex justify-center">
            <button
              onClick={() => openEditor()}
              aria-label="New memory"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tide text-paper shadow-raise active:scale-95"
            >
              <Plus size={24} />
            </button>
          </div>
          {NAV.slice(2).map((n) => <Tab key={n.to} {...n} badge={0} />)}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="anim-sheet fixed inset-x-0 bottom-[calc(5.5rem+var(--safe-bottom))] z-40 flex justify-center px-4 lg:bottom-8 lg:pl-60"
        >
          <div className="flex max-w-md items-center gap-3 rounded-2xl bg-ink py-2.5 pl-4 pr-2 text-sm text-paper shadow-sheet">
            <span className="flex-1">{toast.message}</span>
            {toast.action ? (
              <button
                onClick={() => { toast.action!.run(); dismissToast(); }}
                className="rounded-lg px-3 py-1.5 font-semibold text-lantern hover:bg-white/10"
              >
                {toast.action.label}
              </button>
            ) : (
              <span className="w-2" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tab({ to, label, icon: Icon, end, badge }: (typeof NAV)[number] & { badge: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('relative flex flex-col items-center gap-0.5 py-1 text-[0.68rem] font-medium', isActive ? 'text-tide' : 'text-faint')
      }
    >
      <Icon size={21} />
      {label}
      {badge > 0 && (
        <span className="absolute right-[calc(50%-1.1rem)] top-0 h-2 w-2 rounded-full bg-lantern" aria-label={`${badge} unplaced`} />
      )}
    </NavLink>
  );
}
