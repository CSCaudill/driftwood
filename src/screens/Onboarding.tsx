import { useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarRange, PenLine, ShieldCheck, Sparkles } from 'lucide-react';
import { LanternScene } from '../components/LanternScene';
import { Button, FieldLabel, TextInput, cx } from '../components/ui';
import { saveChapter, suggestedChapters, updateSettings } from '../db/repo';
import { currentYear } from '../lib/fuzzyDate';
import { loadSampleLife } from '../lib/sample';

/**
 * First launch: a welcome, a short explanation, then a few optional details.
 * Everything can be skipped; nothing leaves the device.
 */
export function Onboarding() {
  const [step, setStep] = useState(0);

  return (
    <main className="safe-top safe-bottom flex min-h-dvh flex-col px-6 pb-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex h-12 items-center">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-graphite hover:text-ink"
            >
              <ArrowLeft size={18} /> Back
            </button>
          )}
        </div>

        {step === 0 && <Welcome onNext={() => setStep(1)} />}
        {step === 1 && <HowItWorks onNext={() => setStep(2)} />}
        {step === 2 && <AboutYou />}

        <div className="mt-6 flex justify-center gap-2" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-tide' : 'w-1.5 bg-line')}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center py-2">
        <LanternScene className="h-[min(34dvh,300px)] w-auto" />
      </div>
      <h1 className="display mt-4 text-[2.4rem] font-semibold leading-[1.04]">Bring your past back into the light.</h1>
      <p className="reading mt-3 text-[1.04rem] text-graphite">
        Lantern is a quiet place to gather the memories you have, find the ones you don’t, and see your life take shape
        again.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button variant="primary" size="lg" onClick={onNext}>Get started</Button>
        <Button variant="quiet" onClick={() => loadSampleLife()}>Look around with a sample life first</Button>
      </div>
    </section>
  );
}

function Point({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tide-wash text-tide">{icon}</span>
      <span>
        <span className="display block text-[1.08rem] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[0.95rem] leading-relaxed text-graphite">{children}</span>
      </span>
    </li>
  );
}

function HowItWorks({ onNext }: { onNext: () => void }) {
  return (
    <section className="flex flex-1 flex-col">
      <h1 className="display mt-4 text-[2rem] font-semibold leading-tight">Memory comes back in pieces.</h1>
      <p className="reading mt-3 text-[1.02rem] text-graphite">Lantern is built around that.</p>
      <ul className="mt-9 space-y-7">
        <Point icon={<PenLine size={20} />} title="Write it down when it surfaces">
          A smell, a name, a room. A single detail is enough, and you can say it out loud instead of typing.
        </Point>
        <Point icon={<CalendarRange size={20} />} title="Place it as well as you know">
          An exact day, a summer, “when I was about eight”, or not sure yet. You can rearrange as more comes back.
        </Point>
        <Point icon={<Sparkles size={20} />} title="Light up the quiet years">
          Lantern notices the stretches with nothing in them and offers gentle prompts, built from where you lived and
          who was there.
        </Point>
      </ul>
      <p className="mt-9 flex items-start gap-2.5 rounded-2xl bg-paper p-4 text-sm text-graphite">
        <ShieldCheck size={18} className="mt-px shrink-0 text-tide" />
        Private by design. Everything you write stays on this device. No account, no tracking.
      </p>
      <div className="mt-auto pt-8">
        <Button variant="primary" size="lg" className="w-full" onClick={onNext}>Continue</Button>
      </div>
    </section>
  );
}

function AboutYou() {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [frame, setFrame] = useState(true);
  const years: number[] = [];
  for (let y = currentYear(); y >= 1920; y--) years.push(y);

  const start = async () => {
    await updateSettings({ name: name.trim(), birthYear: birthYear || null, onboarded: true });
    if (birthYear && frame) for (const c of suggestedChapters(birthYear)) await saveChapter(c);
  };

  return (
    <section className="flex flex-1 flex-col">
      <h1 className="display mt-4 text-[2rem] font-semibold leading-tight">A little about you.</h1>
      <p className="reading mt-3 text-[1.02rem] text-graphite">Both are optional, and you can change them later.</p>

      <div className="mt-8 space-y-6">
        <div>
          <FieldLabel htmlFor="o-name">What should we call you?</FieldLabel>
          <TextInput id="o-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" autoComplete="given-name" />
        </div>
        <div>
          <FieldLabel htmlFor="o-year">What year were you born?</FieldLabel>
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
            Lets you date a memory as “when I was about eight”, and shows your age and school grade on every year.
          </p>
        </div>
        {birthYear && (
          <label className="flex items-start gap-3 rounded-2xl bg-paper p-4">
            <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--tide)]" />
            <span className="text-sm text-graphite">
              <span className="block font-medium text-ink">Start my life frame</span>
              Adds school years and stages of life as reference points on your timeline. You can add homes, work and
              milestones later.
            </span>
          </label>
        )}
      </div>

      <div className="mt-auto pt-8">
        <Button variant="primary" size="lg" className="w-full" onClick={start}>Start my timeline</Button>
      </div>
    </section>
  );
}
