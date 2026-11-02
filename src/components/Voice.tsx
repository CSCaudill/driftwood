import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { useBlobUrl } from '../hooks/data';
import {
  dictationSupported,
  formatDuration,
  pickAudioMime,
  recordingSupported,
  startDictation,
  type DictationSession,
  type VoiceClip,
} from '../lib/speech';
import { cx } from './ui';

// ------------------------------------------------------------------ Dictation

/**
 * Speak instead of typing. Finished phrases are handed to `onText`; the
 * in-progress phrase is shown live under the button.
 */
export function DictateButton({
  onText,
  onListeningChange,
  size = 'md',
  label = 'Speak',
}: {
  onText: (phrase: string) => void;
  onListeningChange?: (listening: boolean) => void;
  size?: 'md' | 'lg';
  label?: string;
}) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const session = useRef<DictationSession | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => session.current?.stop(), []);
  useEffect(() => onListeningChange?.(listening), [listening, onListeningChange]);

  if (!dictationSupported()) return null;

  const toggle = async () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setError(null);
    try {
      session.current = await startDictation({
        onPartial: setPartial,
        onFinal: (t) => onTextRef.current(t),
        onEnd: () => {
          setListening(false);
          setPartial('');
          session.current = null;
        },
        onError: setError,
      });
      setListening(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        className={cx(
          'inline-flex items-center gap-2 rounded-full font-medium transition-colors',
          size === 'md' ? 'h-9 px-3.5 text-sm' : 'h-11 px-4 text-[0.95rem]',
          listening ? 'bg-ink text-paper' : 'border border-line bg-paper text-ink hover:border-tide hover:text-tide',
        )}
      >
        {listening ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lantern opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lantern" />
            </span>
            Listening. Tap to stop
          </>
        ) : (
          <>
            <Mic size={size === 'md' ? 16 : 18} />
            {label}
          </>
        )}
      </button>
      {listening && partial && (
        <p className="reading mt-2 text-[0.95rem] italic text-graphite" aria-live="polite">
          {partial}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Recorder

/**
 * Record a voice note to keep with the memory. Hearing yourself tell a memory
 * can hold things the written version doesn't.
 */
export function VoiceRecorder({ onRecorded }: { onRecorded: (clip: VoiceClip) => void }) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [error, setError] = useState<string | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => () => cleanup.current(), []);

  if (!recordingSupported()) return null;

  const start = async () => {
    setError(null);
    setState('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('idle');
      setError('Microphone access is blocked. Allow it to record a voice note.');
      return;
    }
    const mime = pickAudioMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();

    // Live level meter.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bands = Array.from({ length: 7 }, (_, i) => data[2 + i * 3] / 255);
      setLevels(bands);
      setElapsed(Date.now() - startedAt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const limit = window.setTimeout(() => rec.state === 'recording' && rec.stop(), 10 * 60_000);

    cleanup.current = () => {
      cancelAnimationFrame(raf);
      clearTimeout(limit);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      if (rec.state === 'recording') rec.stop();
    };

    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const durationMs = Date.now() - startedAt;
      cleanup.current();
      cleanup.current = () => {};
      setState('idle');
      setElapsed(0);
      const type = rec.mimeType || mime || 'audio/webm';
      if (chunks.length && durationMs > 600) onRecorded({ blob: new Blob(chunks, { type }), mime: type, durationMs });
    };
    recorder.current = rec;
    rec.start(250);
    setState('recording');
  };

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();

  return (
    <div>
      {state === 'recording' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ink py-2 pl-4 pr-2 text-paper">
          <span className="flex h-6 items-center gap-[3px]" aria-hidden>
            {levels.map((l, i) => (
              <span key={i} className="w-[3px] rounded-full bg-lantern" style={{ height: `${Math.max(12, l * 100)}%` }} />
            ))}
          </span>
          <span className="flex-1 text-sm tabular-nums" aria-live="polite">
            Recording {formatDuration(elapsed)}
          </span>
          <button
            type="button"
            onClick={stop}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-paper/15 px-3 text-sm font-medium hover:bg-paper/25"
          >
            <Square size={13} className="fill-current" /> Stop
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={state === 'starting'}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-line px-3.5 text-sm font-medium text-graphite hover:border-tide hover:text-tide disabled:opacity-50"
        >
          <Mic size={16} /> Record a voice note
        </button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Player

export function VoicePlayer({
  blob,
  durationMs,
  onRemove,
}: {
  blob: Blob;
  durationMs: number;
  onRemove?: () => void;
}) {
  const url = useBlobUrl(blob);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const total = durationMs / 1000;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper py-2 pl-2 pr-3">
      <button
        type="button"
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        onClick={() => (playing ? audio.current?.pause() : audio.current?.play())}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tide text-paper hover:bg-tide-strong"
      >
        {playing ? <Pause size={15} className="fill-current" /> : <Play size={15} className="ml-0.5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-tide transition-[width]" style={{ width: `${total ? Math.min(100, (position / total) * 100) : 0}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-graphite">
          <span>Voice note</span>
          <span>{playing || position ? `${formatDuration(position * 1000)} / ` : ''}{formatDuration(durationMs)}</span>
        </div>
      </div>
      {onRemove && (
        <button type="button" aria-label="Remove voice note" onClick={onRemove} className="rounded-lg p-1.5 text-graphite hover:bg-sunken hover:text-ink">
          <Trash2 size={16} />
        </button>
      )}
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPosition(0);
          }}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        />
      )}
    </div>
  );
}
