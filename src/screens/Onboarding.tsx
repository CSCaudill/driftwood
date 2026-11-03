import { useState } from 'react';
import { Button, FieldLabel, TextInput } from '../components/ui';
import { saveChapter, suggestedChapters, updateSettings } from '../db/repo';
import { currentYear } from '../lib/fuzzyDate';
import { loadSampleLife } from '../lib/sample';

/** First launch. One screen, everything optional. */
export function Onboarding() {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [chapters, setChapters] = useState(true);
  const years: number[] = [];
  for (let y = currentYear(); y >= 1920; y--) years.push(y);

  const start = async () => {
    await updateSettings({ name: name.trim(), birthYear: birthYear || null, onboarded: true });
    if (birthYear && chapters) for (const c of suggestedChapters(birthYear)) await saveChapter(c);
  };

  return (
    <main className="safe-top safe-bottom flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <img src="./icon.svg" alt="Driftwood" className="h-16 w-16 rounded-[18px] shadow-raise" />
        <h1 className="display mt-8 text-[2.4rem] font-semibold leading-[1.05]">
          Collect the pieces as they wash up.
        </h1>
        <p className="reading mt-4 text-[1.05rem] text-graphite">
          Memories come back a piece at a time, often without a date. Write each one down, even the faint ones. Driftwood
          keeps them in order, so a picture of your life slowly takes shape.
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <FieldLabel htmlFor="o-name" hint="Optional">What should we call you?</FieldLabel>
            <TextInput id="o-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" autoComplete="given-name" />
          </div>
          <div>
            <FieldLabel htmlFor="o-year" hint="Optional">What year were you born?</FieldLabel>
            <select
              id="o-year"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value ? +e.target.value : '')}
              className="h-11 w-full rounded-xl border border-line bg-paper px-3.5 focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash"
            >
              <option value="">Prefer not to say</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <p className="mt-2 text-sm text-graphite">
              With it you can date a memory as “when I was about eight” instead of guessing the year.
            </p>
          </div>
          {birthYear && (
            <label className="flex items-start gap-3 rounded-2xl bg-paper p-4">
              <input type="checkbox" checked={chapters} onChange={(e) => setChapters(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--tide)]" />
              <span className="text-sm text-graphite">
                <span className="block font-medium text-ink">Start my life frame</span>
                Adds school years and stages of life as reference points on your timeline. You can rename, adjust or remove
                them, and add homes, work and milestones later.
              </span>
            </label>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={start}>Start my timeline</Button>
          <Button variant="quiet" onClick={() => loadSampleLife()}>Look around with a sample life first</Button>
        </div>
        <p className="mt-6 text-center text-xs text-faint">Your memories stay on this device.</p>
      </div>
    </main>
  );
}
