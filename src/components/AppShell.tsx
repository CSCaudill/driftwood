import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Ellipsis, Feather, Inbox, Plus, Settings, Sun, Users, Waypoints } from 'lucide-react';
import { useMemories } from '../hooks/data';
import { useApp } from '../state/app';
import { cx } from './ui';

type NavItem = { to: string; label: string; icon: typeof Waypoints; end?: boolean };

/** Desktop sidebar. */
const NAV: NavItem[] = [
  { to: '/today', label: 'Today', icon: Sun },
  { to: '/', label: 'Timeline', icon: Waypoints, end: true },
  { to: '/reflect', label: 'Reflect', icon: Feather },
  { to: '/people', label: 'People', icon: Users },
  { to: '/unplaced', label: 'Unplaced', icon: Inbox },
  { to: '/frame', label: 'Life frame', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Phone tab bar: four tabs around the capture button; the rest live under More. */
const TABS_LEFT: NavItem[] = [NAV[1], NAV[2]];
const TABS_RIGHT: NavItem[] = [NAV[3], { to: '/more', label: 'More', icon: Ellipsis }];

/** Sidebar on wide screens, tab bar with a capture button on phones. */
export function AppShell({ children }: { children: ReactNode }) {
  const { openEditor, toast, dismissToast } = useApp();
  const memories = useMemories();
  const unplaced = memories?.filter((m) => m.groupYear == null).length ?? 0;
  // Reflect has its own sticky action bar on phones; lift toasts above it.
  const lifted = useLocation().pathname === '/reflect';

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-paper/60 px-4 py-6 lg:flex">
        <NavLink to="/today" className="flex items-center gap-2.5 rounded-xl px-2">
          <img src="./icon.svg" alt="" className="h-8 w-8 rounded-[9px]" />
          <span className="display text-lg font-semibold">Lantern</span>
        </NavLink>
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
          {TABS_LEFT.map((n) => <Tab key={n.to} {...n} badge={0} />)}
          <div className="flex justify-center">
            <button
              onClick={() => openEditor()}
              aria-label="New memory"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tide text-paper shadow-raise active:scale-95"
            >
              <Plus size={24} />
            </button>
          </div>
          {TABS_RIGHT.map((n) => <Tab key={n.to} {...n} badge={n.to === '/more' ? unplaced : 0} />)}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={cx(
            'anim-sheet fixed inset-x-0 z-40 flex justify-center px-4 lg:bottom-8 lg:pl-60',
            lifted ? 'bottom-[calc(9.75rem+var(--safe-bottom))]' : 'bottom-[calc(5.5rem+var(--safe-bottom))]',
          )}
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

function Tab({ to, label, icon: Icon, end, badge }: NavItem & { badge: number }) {
  const { pathname } = useLocation();
  const moreActive = ['/unplaced', '/frame', '/settings', '/today'].some((p) => pathname.startsWith(p));
  const peopleActive = pathname.startsWith('/people');
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'relative flex flex-col items-center gap-0.5 py-1 text-[0.68rem] font-medium',
          isActive || (to === '/more' && moreActive) || (to === '/people' && peopleActive) ? 'text-tide' : 'text-faint',
        )
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
