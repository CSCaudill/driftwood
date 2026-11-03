import { Link } from 'react-router-dom';
import { Diamond, GraduationCap } from 'lucide-react';
import { anchorLabel } from '../lib/frame';
import { KIND_ICONS } from '../screens/FrameScreen';
import type { Anchor } from '../types';
import { cx } from './ui';

/**
 * A quiet line of reference points for a year or a gap: where you lived,
 * which grade you were in, what you were doing, milestones that year.
 */
export function FrameContext({
  ongoing,
  milestones,
  grade,
  className,
}: {
  ongoing: Anchor[];
  milestones: Anchor[];
  grade?: string | null;
  className?: string;
}) {
  if (!ongoing.length && !milestones.length && !grade) return null;
  return (
    <div className={cx('flex flex-col gap-1.5 text-[0.78rem] text-graphite', className)}>
      {milestones.map((m) => (
        <Link key={m.id} to="/frame" className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-tide">
          <Diamond size={12} className="fill-lantern text-lantern" aria-hidden />
          {anchorLabel(m)}
        </Link>
      ))}
      {(ongoing.length > 0 || grade) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ongoing.map((a) => {
            const Icon = KIND_ICONS[a.kind];
            return (
              <span key={a.id} className="inline-flex items-center gap-1.5">
                <Icon size={12} className="shrink-0 text-faint" aria-label={a.kind} />
                {anchorLabel(a)}
              </span>
            );
          })}
          {grade && (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap size={13} className="shrink-0 text-faint" aria-hidden />
              {grade}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
