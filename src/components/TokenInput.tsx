import { useState } from 'react';
import { RemoveButton, cx } from './ui';

/** Free-text tokens (people, tags) with suggestions from what's been used before. */
export function TokenInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  id?: string;
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText('');
  };
  const remaining = suggestions
    .filter((s) => !value.includes(s) && (!text || s.toLowerCase().includes(text.toLowerCase())))
    .slice(0, 6);

  return (
    <div>
      <div
        className={cx(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper px-2 py-1.5',
          'focus-within:border-tide focus-within:ring-3 focus-within:ring-tide-wash',
        )}
      >
        {value.map((v) => (
          <span key={v} className="inline-flex h-8 items-center gap-1 rounded-lg bg-sunken pl-2.5 pr-0.5 text-sm">
            {v}
            <RemoveButton
              label={`Remove ${v}`}
              onRemove={() => onChange(value.filter((x) => x !== v))}
              className="h-7 w-7 text-graphite hover:text-ink"
            />
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(text)}
          placeholder={value.length ? '' : placeholder}
          className="h-8 min-w-24 flex-1 bg-transparent px-1.5 text-[0.95rem] placeholder:text-faint focus:outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="h-7 rounded-lg border border-dashed border-line px-2.5 text-sm text-graphite hover:border-tide hover:text-tide"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
