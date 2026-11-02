import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { dailyPrompt, PROMPT_THEMES } from '../lib/prompts';
import { Button, IconButton } from './ui';

/**
 * A gentle cue to help memories surface. Starting from a concrete sense or
 * relationship tends to work better than "what happened in 1996?".
 */
export function PromptCard() {
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const prompt = dailyPrompt(offset);
  const start = () => navigate(`/reflect?prompt=${prompt.id}`);

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
          Reflect on this
        </Button>
      </div>
    </aside>
  );
}
