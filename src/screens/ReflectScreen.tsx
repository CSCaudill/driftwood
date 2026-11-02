import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EyeOff, Shuffle } from 'lucide-react';
import { Button, cx } from '../components/ui';
import { DictateButton } from '../components/Voice';
import { getReflection, saveReflection, type ReflectionState } from '../db/repo';
import { useMemories, useSettings } from '../hooks/data';
import { PROMPTS, PROMPT_THEMES, pickPrompt, promptById, suggestTitle, type PromptTheme } from '../lib/prompts';
import { appendDictation } from '../lib/speech';
import type { FuzzyDate } from '../types';
import { useApp } from '../state/app';

/**
 * Reflect: one prompt, a quiet page to write on, and a way to turn what you
 * wrote into a memory. Writing is saved as a draft per prompt, so shuffling
 * never loses anything.
 */
export function ReflectScreen() {
  const memories = useMemories();
  const { birthYear } = useSettings();
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

  // Load saved state once (not live, so typing never fights the database).
  useEffect(() => {
    getReflection().then(async (s) => {
      const requested = params.get('prompt');
      let promptId = requested && promptById(requested) ? requested : s.promptId;
      if (!promptId || !promptById(promptId)) {
        promptId = pickPrompt({ theme: null, skipped: s.skipped, answered: new Set(), recent: s.recent })?.id ?? null;
      }
      if (requested) setParams({}, { replace: true });
      const next = { ...s, promptId };
      setState(next);
      setText(promptId ? (s.drafts[promptId] ?? '') : '');
      await saveReflection({ promptId });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (value.trim()) drafts[pid] = value;
      else delete drafts[pid];
      persist({ drafts });
    }, 350);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const goTo = async (promptId: string | null, extra: Partial<ReflectionState> = {}) => {
    if (!state) return;
    window.clearTimeout(saveTimer.current);
    const drafts = { ...state.drafts, ...(extra.drafts ?? {}) };
    if (state.promptId && !extra.drafts) {
      if (text.trim()) drafts[state.promptId] = text;
      else delete drafts[state.promptId];
    }
    const recent = state.promptId ? [state.promptId, ...state.recent.filter((r) => r !== state.promptId)].slice(0, 10) : state.recent;
    await persist({ ...extra, drafts, recent, promptId });
    setText(promptId ? (drafts[promptId] ?? '') : '');
  };

  const shuffle = async (nextTheme = theme, skippedOverride?: string[]) => {
    if (!state) return;
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

  const prompt = state?.promptId ? promptById(state.promptId) : null;

  const saveAsMemory = () => {
    if (!prompt || !text.trim()) return;
    let date: FuzzyDate = { precision: 'unknown' };
    if (prompt.ages && birthYear) date = { precision: 'age', age: prompt.ages[0], ageEnd: prompt.ages[1] };
    const pid = prompt.id;
    openEditor({
      heading: 'Save as a memory',
      promptText: prompt.text,
      initial: { title: suggestTitle(text), notes: text.trim(), promptId: pid, date },
      onSaved: async () => {
        const latest = await getReflection();
        const drafts = { ...latest.drafts };
        delete drafts[pid];
        setState((s) => (s ? { ...s, drafts } : s));
        const next = pickPrompt({ theme, skipped: latest.skipped, answered: new Set([...answered, pid]), recent: [pid, ...latest.recent], exclude: pid });
        await saveReflection({ drafts, promptId: next?.id ?? null, recent: [pid, ...latest.recent].slice(0, 10) });
        setState((s) => (s ? { ...s, drafts, promptId: next?.id ?? null } : s));
        setText(next ? (drafts[next.id] ?? '') : '');
      },
    });
  };

  const draftEntries = Object.entries(state?.drafts ?? {}).filter(([id, t]) => id !== state?.promptId && t.trim() && promptById(id));
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
              {prompt.ages && <span className="font-normal text-graphite">, often from ages {prompt.ages[0]}–{prompt.ages[1]}</span>}
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
                      <span className="block truncate text-sm font-medium">{promptById(id)!.text}</span>
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
