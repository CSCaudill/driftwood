import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSettings } from '../hooks/data';
import { dailyPrompt, PROMPT_THEMES } from '../lib/prompts';
import { useApp } from '../state/app';
import type { FuzzyDate } from '../types';
import { Button, IconButton } from './ui';

/**
 * A gentle cue to help memories surface. Starting from a concrete sense or
 * relationship tends to work better than "what happened in 1996?".
 */
export function PromptCard() {
  const [offset, setOffset] = useState(0);
  const { openEditor } = useApp();
  const { birthYear } = useSettings();
  const prompt = dailyPrompt(offset);

  const start = () => {
    let date: FuzzyDate = { precision: 'unknown' };
    if (prompt.ages && birthYear) date = { precision: 'age', age: prompt.ages[0], ageEnd: prompt.ages[1] };
    openEditor({ initial: { promptId: prompt.id, date }, promptText: prompt.text });
  };

  return (
    <aside className="mb-6 mt-2 rounded-3xl bg-tide-wash px-5 pb-4 pt-4" aria-label="Reflection prompt">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-tide">{PROMPT_THEMES[prompt.theme]}</span>
        <IconButton label="Show another prompt" onClick={() => setOffset((o) => o + 1)} className="-mr-2 -mt-1 h-8 w-8 text-tide hover:bg-paper/50">
          <RefreshCw size={15} />
        </IconButton>
      </div>
      <p className="reading mt-1 text-[1.08rem] leading-relaxed text-ink">{prompt.text}</p>
      <div className="mt-3">
        <Button size="sm" variant="primary" onClick={start}>
          Write it down
        </Button>
      </div>
    </aside>
  );
}
