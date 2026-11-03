import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EyeOff, Shuffle, Target, X } from 'lucide-react';
import { Button, cx } from '../components/ui';
import { DictateButton } from '../components/Voice';
import { getReflection, saveReflection, type ReflectionState } from '../db/repo';
import { useChapters, useMemories, useSettings } from '../hooks/data';
import { biggestGap, generateGapPrompts, spanLabel, type GapPrompt } from '../lib/gapPrompts';
import { usePeopleLookup } from '../state/people';
import { PROMPTS, PROMPT_THEMES, pickPrompt, promptById, suggestTitle, type PromptTheme, type ReflectionPrompt } from '../lib/prompts';
import { appendDictation } from '../lib/speech';
import type { FuzzyDate } from '../types';
import { useApp } from '../state/app';

/**
 * Reflect: one prompt, a quiet page to write on, and a way to turn what you
 * wrote into a memory. Writing is saved as a draft per prompt, so shuffling
 * never loses anything.
 *
 * Focus mode narrows prompts to an empty stretch of the timeline, using what's
 * known about those years (age, homes, school, people, neighbouring memories).
 */
export function ReflectScreen() {
  const memories = useMemories();
  const { birthYear } = useSettings();
  const anchors = useChapters();
  const people = usePeopleLookup();
  const { openEditor, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<ReflectionState | null>(null);
  const [theme, setTheme] = useState<PromptTheme | null>(null);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const answered = useMemo(
    () => new Set((memories ?? []).map((m) => m.promptId).filter((x): x is string => !!x)),
    [memories],
  );

  // Prompts for the focused gap, regenerated as the timeline changes.
  const focus = state?.focus ?? null;
  const gapPool: GapPrompt[] = useMemo(
    () =>
      focus && memories
        ? generateGapPrompts({ from: focus.from, to: focus.to, birthYear, anchors, memories, people })
        : [],
    [focus, memories, birthYear, anchors, people],
  );
  const findPrompt = useCallback(
    (id: string | null | undefined): (ReflectionPrompt & Partial<GapPrompt>) | undefined =>
      id ? (promptById(id) ?? gapPool.find((p) => p.id === id)) : undefined,
    [gapPool],
  );
  const suggestedGap = useMemo(() => (memories && !focus ? biggestGap(memories, birthYear) : null), [memories, focus, birthYear]);

  const pickFromGap = (pool: GapPrompt[], s: ReflectionState, exclude: string | null) => {
    const fresh = pool.filter((p) => p.id !== exclude && !s.skipped.includes(p.id) && !answered.has(p.id));
    const unseen = fresh.filter((p) => !s.recent.includes(p.id));
    const list = unseen.length ? unseen : fresh.length ? fresh : pool.filter((p) => p.id !== exclude);
    // Lean towards the most specific prompts (they come first) without always repeating them.
    const top = list.slice(0, Math.max(4, Math.ceil(list.length / 2)));
    return top[Math.floor(Math.random() * top.length)] ?? null;
  };

  // Load saved state once (not live, so typing never fights the database).
  // A ?from=&to= link from the timeline starts focus mode for that gap.
  useEffect(() => {
    if (!memories) return;
    if (state) return;
    getReflection().then(async (s) => {
      const requested = params.get('prompt');
      const from = Number(params.get('from'));
      const to = Number(params.get('to'));
      let next: ReflectionState = s;
      if (from && to) {
        const f = { from: Math.min(from, to), to: Math.max(from, to) };
        const pool = generateGapPrompts({ ...f, birthYear, anchors, memories, people });
        next = { ...s, focus: f, promptId: pickFromGap(pool, s, null)?.id ?? null };
      } else if (requested && promptById(requested)) {
        next = { ...s, focus: null, promptId: requested };
      } else if (s.focus) {
        const pool = generateGapPrompts({ ...s.focus, birthYear, anchors, memories, people });
        if (!pool.some((p) => p.id === s.promptId)) next = { ...s, promptId: pickFromGap(pool, s, null)?.id ?? null };
      } else if (!s.promptId || !promptById(s.promptId)) {
        next = { ...s, promptId: pickPrompt({ theme: null, skipped: s.skipped, answered: new Set(), recent: s.recent })?.id ?? null };
      }
      if (requested || from) setParams({}, { replace: true });
      setState(next);
      setText(next.promptId ? (next.drafts[next.promptId] ?? '') : '');
      await saveReflection({ promptId: next.promptId, focus: next.focus });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories]);

  const persist = useCallback((patch: Partial<ReflectionState>) => {
    setState((s) => (s ? { ...s, ...patch } : s));
    return saveReflection(patch);
  }, []);

  // Debounced draft saving.
  const onTextChange = (value: string) => {
    setText(value);
    if (!state?.promptId) return;
    const pid = state.promptId;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const latest = await getReflection();
      const drafts = { ...latest.drafts };
      const promptTexts = { ...latest.promptTexts };
      if (value.trim()) {
        drafts[pid] = value;
        if (!promptById(pid)) promptTexts[pid] = findPrompt(pid)?.text ?? promptTexts[pid] ?? '';
      } else {
        delete drafts[pid];
        delete promptTexts[pid];
      }
      persist({ drafts, promptTexts });
    }, 350);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const goTo = async (promptId: string | null, extra: Partial<ReflectionState> = {}) => {
    if (!state) return;
    window.clearTimeout(saveTimer.current);
    const drafts = { ...state.drafts, ...(extra.drafts ?? {}) };
    const promptTexts = { ...state.promptTexts };
    if (state.promptId && !extra.drafts) {
      if (text.trim()) {
        drafts[state.promptId] = text;
        if (!promptById(state.promptId)) promptTexts[state.promptId] = findPrompt(state.promptId)?.text ?? '';
      } else delete drafts[state.promptId];
    }
    const recent = state.promptId ? [state.promptId, ...state.recent.filter((r) => r !== state.promptId)].slice(0, 10) : state.recent;
    await persist({ ...extra, drafts, promptTexts, recent, promptId });
    setText(promptId ? (drafts[promptId] ?? '') : '');
  };

  const shuffle = async (nextTheme = theme, skippedOverride?: string[]) => {
    if (!state) return;
    if (state.focus) {
      const s2 = skippedOverride ? { ...state, skipped: skippedOverride } : state;
      const nextGap = pickFromGap(gapPool, s2, state.promptId);
      const hadText = !!text.trim();
      await goTo(nextGap?.id ?? null, skippedOverride ? { skipped: skippedOverride } : {});
      if (hadText) showToast('Your writing is saved as a draft');
      return;
    }
    const next = pickPrompt({
      theme: nextTheme,
      skipped: skippedOverride ?? state.skipped,
      answered,
      recent: state.recent,
      exclude: state.promptId,
    });
    const hadText = !!text.trim();
    await goTo(next?.id ?? null, skippedOverride ? { skipped: skippedOverride } : {});
    if (hadText) showToast('Your writing is saved as a draft');
  };

  const skip = async () => {
    if (!state?.promptId) return;
    const skipped = [...state.skipped, state.promptId];
    await shuffle(theme, skipped);
    showToast('You won’t see that prompt again', {
      label: 'Undo',
      run: () => persist({ skipped: skipped.filter((id) => id !== state.promptId) }),
    });
  };

  const chooseTheme = (t: PromptTheme | null) => {
    setTheme(t);
    const current = state?.promptId ? promptById(state.promptId) : null;
    if (t && current?.theme !== t) shuffle(t);
  };

  const startFocus = async (from: number, to: number) => {
    if (!state || !memories) return;
    const f = { from, to };
    const pool = generateGapPrompts({ ...f, birthYear, anchors, memories, people });
    await goTo(pickFromGap(pool, state, null)?.id ?? null, { focus: f });
  };
  const endFocus = async () => {
    if (!state) return;
    const next = pickPrompt({ theme, skipped: state.skipped, answered, recent: state.recent });
    await goTo(next?.id ?? null, { focus: null });
  };

  // A generated prompt whose gap has since changed still shows, from its saved text.
  const prompt: (ReflectionPrompt & Partial<GapPrompt>) | undefined =
    findPrompt(state?.promptId) ??
    (state?.promptId && state.promptTexts[state.promptId]
      ? { id: state.promptId, text: state.promptTexts[state.promptId], theme: 'milestones' }
      : undefined);

  const saveAsMemory = () => {
    if (!prompt || !text.trim()) return;
    let date: FuzzyDate = { precision: 'unknown' };
    if (prompt.date) date = prompt.date;
    else if (prompt.ages && birthYear) date = { precision: 'age', age: prompt.ages[0], ageEnd: prompt.ages[1] };
    const pid = prompt.id;
    const generated = !promptById(pid);
    openEditor({
      heading: 'Save as a memory',
      promptText: prompt.text,
      initial: { title: suggestTitle(text), notes: text.trim(), promptId: pid, promptText: generated ? prompt.text : null, date },
      onSaved: async () => {
        const latest = await getReflection();
        const drafts = { ...latest.drafts };
        delete drafts[pid];
        setState((s) => (s ? { ...s, drafts } : s));
        const recent = [pid, ...latest.recent].slice(0, 10);
        // Stay focused on the gap if there was one; it may have just been filled.
        const next = latest.focus
          ? pickFromGap(gapPool, { ...latest, recent, skipped: [...latest.skipped, pid] }, pid)
          : pickPrompt({ theme, skipped: latest.skipped, answered: new Set([...answered, pid]), recent, exclude: pid });
        await saveReflection({ drafts, promptId: next?.id ?? null, recent });
        setState((s) => (s ? { ...s, drafts, promptId: next?.id ?? null } : s));
        setText(next ? (drafts[next.id] ?? '') : '');
      },
    });
  };

  const draftEntries = Object.entries(state?.drafts ?? {}).filter(
    ([id, t]) => id !== state?.promptId && t.trim() && (promptById(id) || state?.promptTexts[id]),
  );
  const draftPromptText = (id: string) => promptById(id)?.text ?? state?.promptTexts[id] ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const answeredCount = PROMPTS.filter((p) => answered.has(p.id)).length;

  if (!state) return <div className="h-dvh" />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-40 sm:px-8 lg:pb-16">
      <header className="safe-top pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="display text-2xl font-semibold">Reflect</h1>
          <span className="text-xs tabular-nums text-faint">
            {answeredCount} of {PROMPTS.length} prompts answered
          </span>
        </div>
        {focus ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-tide-wash py-2.5 pl-4 pr-2 text-sm text-tide">
            <Target size={16} className="shrink-0" />
            <span className="flex-1">
              Focusing on <span className="font-semibold">{spanLabel(focus.from, focus.to, birthYear)}</span>
            </span>
            <button onClick={endFocus} aria-label="Stop focusing on these years" className="rounded-lg p-1.5 hover:bg-paper/60">
              <X size={16} />
            </button>
          </div>
        ) : (
        <>
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Prompt theme">
          {[null, ...(Object.keys(PROMPT_THEMES) as PromptTheme[])].map((t) => (
            <button
              key={t ?? 'any'}
              role="radio"
              aria-checked={theme === t}
              onClick={() => chooseTheme(t)}
              className={cx(
                'h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors',
                theme === t ? 'bg-ink text-paper' : 'text-graphite hover:bg-sunken hover:text-ink',
              )}
            >
              {t ? PROMPT_THEMES[t] : 'Any'}
            </button>
          ))}
        </div>
        {suggestedGap && (
          <button
            onClick={() => startFocus(suggestedGap[0], suggestedGap[1])}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left text-sm hover:border-tide"
          >
            <Target size={16} className="shrink-0 text-tide" />
            <span className="flex-1 text-graphite">
              Your timeline is quiet for <span className="font-medium text-ink">{spanLabel(suggestedGap[0], suggestedGap[1], birthYear)}</span>
            </span>
            <span className="shrink-0 font-medium text-tide">Focus there</span>
          </button>
        )}
        </>
        )}
      </header>

      {!prompt ? (
        <div className="py-20 text-center">
          <p className="reading text-lg text-graphite">You’ve set aside every prompt in this theme.</p>
          <Button className="mt-5" onClick={() => persist({ skipped: [] }).then(() => shuffle(theme, []))}>
            Bring them back
          </Button>
        </div>
      ) : (
        <>
          <section className="mt-10" aria-live="polite">
            <p className="text-sm font-semibold text-tide">
              {PROMPT_THEMES[prompt.theme]}
              {prompt.because ? (
                <span className="font-normal text-graphite">. {prompt.because}</span>
              ) : (
                prompt.ages && !focus && <span className="font-normal text-graphite">, often from ages {prompt.ages[0]}–{prompt.ages[1]}</span>
              )}
            </p>
            <h2 key={prompt.id} className="reading anim-fade mt-3 text-[1.7rem] leading-[1.35] text-ink sm:text-[2rem]">
              {prompt.text}
            </h2>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Shuffle size={15} />} onClick={() => shuffle()}>
                Another prompt
              </Button>
              <Button size="sm" variant="quiet" icon={<EyeOff size={15} />} onClick={skip}>
                Not for me
              </Button>
              {answered.has(prompt.id) && <span className="text-xs text-faint">You’ve written about this before</span>}
            </div>
          </section>

          <section className="mt-8 flex-1">
            <label htmlFor="reflect-text" className="sr-only">Your writing</label>
            <textarea
              id="reflect-text"
              ref={area}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Start writing. Anything that comes back counts, even a single detail."
              rows={8}
              className="reading min-h-[14rem] w-full resize-none rounded-3xl border border-line bg-paper px-5 py-4 text-[1.08rem] leading-[1.75] placeholder:text-faint focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash"
              style={{ fieldSizing: 'content' } as CSSProperties}
            />
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <DictateButton
                onText={(t) => onTextChange(appendDictation(area.current?.value ?? text, t))}
                onListeningChange={setListening}
              />
              {words > 0 && !listening && (
                <span className="pt-2 text-xs tabular-nums text-faint">
                  {words} {words === 1 ? 'word' : 'words'}, saved as you go
                </span>
              )}
            </div>
          </section>

          {draftEntries.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold text-graphite">Drafts in progress</h2>
              <ul className="mt-2 space-y-2">
                {draftEntries.map(([id, t]) => (
                  <li key={id}>
                    <button
                      onClick={() => goTo(id)}
                      className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left hover:border-tide"
                    >
                      <span className="block truncate text-sm font-medium">{draftPromptText(id)}</span>
                      <span className="reading mt-0.5 block truncate text-sm text-graphite">{t}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Primary action: sticky above the tab bar on phones. */}
          <div className="fixed inset-x-0 bottom-[calc(4rem+var(--safe-bottom))] z-20 border-t border-line bg-mist/92 px-5 py-3 backdrop-blur-md lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
              <p className="hidden text-sm text-graphite sm:block">
                Next you’ll add a date, people and photos.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                disabled={!text.trim()}
                onClick={saveAsMemory}
              >
                Save as a memory
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
