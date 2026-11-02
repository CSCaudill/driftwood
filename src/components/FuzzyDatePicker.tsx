import { useMemo } from 'react';
import { MONTHS, SEASONS, currentYear, daysInMonth, formatFuzzyDate, resolveBounds } from '../lib/fuzzyDate';
import type { DatePrecision, FuzzyDate, Season } from '../types';
import { Toggle, cx } from './ui';

/**
 * Pick a date at whatever precision the person actually remembers.
 * The question is framed as "how well do you know when?" rather than
 * demanding a calendar date.
 */

const MODES: { value: DatePrecision; label: string; needsBirthYear?: boolean }[] = [
  { value: 'day', label: 'Exact day' },
  { value: 'month', label: 'Month' },
  { value: 'season', label: 'Season' },
  { value: 'year', label: 'Year' },
  { value: 'age', label: 'My age', needsBirthYear: true },
  { value: 'range', label: 'Between years' },
  { value: 'decade', label: 'Decade' },
  { value: 'unknown', label: 'Not sure yet' },
];

const selectCls =
  'h-11 w-full appearance-none rounded-xl border border-line bg-paper px-3.5 text-[0.95rem] focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash';

export function FuzzyDatePicker({
  value,
  onChange,
  birthYear,
}: {
  value: FuzzyDate;
  onChange: (d: FuzzyDate) => void;
  birthYear: number | null;
}) {
  const thisYear = currentYear();
  const firstYear = birthYear ?? 1920;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = thisYear; y >= firstYear; y--) out.push(y);
    return out;
  }, [thisYear, firstYear]);
  const decades = useMemo(() => {
    const out: number[] = [];
    for (let d = Math.floor(thisYear / 10) * 10; d >= Math.floor(firstYear / 10) * 10; d -= 10) out.push(d);
    return out;
  }, [thisYear, firstYear]);
  const maxAge = birthYear ? thisYear - birthYear : 100;

  // Keep whatever the person already entered when switching modes.
  const guessYear = () => {
    const b = resolveBounds(value, birthYear);
    return b?.groupYear ?? value.year ?? (birthYear ? birthYear + 8 : thisYear - 20);
  };

  const setMode = (precision: DatePrecision) => {
    const y = guessYear();
    const circa = value.circa;
    switch (precision) {
      case 'day':
        return onChange({ precision, year: y, month: value.month ?? 1, day: value.day ?? 1, circa });
      case 'month':
        return onChange({ precision, year: y, month: value.month ?? 1, circa });
      case 'season':
        return onChange({ precision, year: y, season: value.season ?? 'summer', circa });
      case 'year':
        return onChange({ precision, year: y, circa });
      case 'age': {
        const age = birthYear ? Math.max(0, y - birthYear) : 8;
        return onChange({ precision, age, circa });
      }
      case 'range':
        return onChange({ precision, year: y, endYear: Math.min(y + 2, thisYear), circa });
      case 'decade':
        return onChange({ precision, decade: Math.floor(y / 10) * 10, circa });
      default:
        return onChange({ precision: 'unknown' });
    }
  };

  const set = (patch: Partial<FuzzyDate>) => onChange({ ...value, ...patch });
  const yearSelect = ({ v, onPick, label }: { v?: number; onPick: (y: number) => void; label: string }) => (
    <select aria-label={label} className={selectCls} value={v ?? ''} onChange={(e) => onPick(Number(e.target.value))}>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
          {birthYear ? `  (age ${y - birthYear})` : ''}
        </option>
      ))}
    </select>
  );

  const preview = value.precision === 'unknown' ? null : formatFuzzyDate(value, birthYear);

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {MODES.map((m) => {
          const disabled = m.needsBirthYear && !birthYear;
          return (
            <button
              key={m.value}
              type="button"
              disabled={disabled}
              title={disabled ? 'Add your birth year in Settings to date memories by age' : undefined}
              onClick={() => setMode(m.value)}
              aria-pressed={value.precision === m.value}
              className={cx(
                'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-40',
                value.precision === m.value
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-paper text-graphite hover:text-ink',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2">
        {value.precision === 'day' && (
          <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2">
            <select aria-label="Month" className={selectCls} value={value.month} onChange={(e) => set({ month: +e.target.value })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select aria-label="Day" className={selectCls} value={value.day} onChange={(e) => set({ day: +e.target.value })}>
              {Array.from({ length: daysInMonth(value.year ?? 2000, value.month ?? 1) }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
            {yearSelect({ label: "Year", v: value.year, onPick: (year) => set({ year }) })}
          </div>
        )}
        {value.precision === 'month' && (
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Month" className={selectCls} value={value.month} onChange={(e) => set({ month: +e.target.value })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            {yearSelect({ label: "Year", v: value.year, onPick: (year) => set({ year }) })}
          </div>
        )}
        {value.precision === 'season' && (
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Season" className={selectCls} value={value.season} onChange={(e) => set({ season: e.target.value as Season })}>
              {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {yearSelect({ label: "Year", v: value.year, onPick: (year) => set({ year }) })}
          </div>
        )}
        {value.precision === 'year' && yearSelect({ label: 'Year', v: value.year, onPick: (year) => set({ year }) })}
        {value.precision === 'range' && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {yearSelect({ label: "From year", v: value.year, onPick: (year) => set({ year }) })}
            <span className="text-sm text-graphite">to</span>
            {yearSelect({ label: "To year", v: value.endYear, onPick: (endYear) => set({ endYear }) })}
          </div>
        )}
        {value.precision === 'decade' && (
          <select aria-label="Decade" className={selectCls} value={value.decade} onChange={(e) => set({ decade: +e.target.value })}>
            {decades.map((d) => <option key={d} value={d}>The {d}s</option>)}
          </select>
        )}
        {value.precision === 'age' && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <select aria-label="Age" className={selectCls} value={value.age} onChange={(e) => {
              const age = +e.target.value;
              set({ age, ageEnd: value.ageEnd != null && value.ageEnd < age ? undefined : value.ageEnd });
            }}>
              {Array.from({ length: maxAge + 1 }, (_, i) => <option key={i} value={i}>Age {i}</option>)}
            </select>
            <span className="text-sm text-graphite">to</span>
            <select aria-label="Up to age (optional)" className={selectCls} value={value.ageEnd ?? ''} onChange={(e) => set({ ageEnd: e.target.value === '' ? undefined : +e.target.value })}>
              <option value="">Just that age</option>
              {Array.from({ length: maxAge + 1 }, (_, i) => i).filter((i) => i > (value.age ?? 0)).map((i) => (
                <option key={i} value={i}>Age {i}</option>
              ))}
            </select>
          </div>
        )}
        {value.precision === 'unknown' && (
          <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-graphite">
            That’s fine. It’ll wait in <span className="font-medium text-ink">Unplaced</span> until you remember more, and you
            can place it on the timeline any time.
          </p>
        )}
      </div>

      {value.precision !== 'unknown' && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-2.5">
          <span className="text-sm text-graphite">
            Shows as <span className="font-medium text-ink">{preview}</span>
          </span>
          <div className="shrink-0">
            <Toggle checked={!!value.circa} onChange={(circa) => set({ circa })} label={<span className="text-sm">Roughly</span>} />
          </div>
        </div>
      )}
    </div>
  );
}
