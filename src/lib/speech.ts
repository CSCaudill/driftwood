import { Capacitor } from '@capacitor/core';

/**
 * Dictation: speak and it types.
 *
 * - Web (Chrome, Edge, Safari): the Web Speech API.
 * - iOS app: @capacitor-community/speech-recognition, which uses Apple's
 *   on-device Speech framework. WKWebView doesn't expose the Web Speech API,
 *   so the native plugin is required there.
 *
 * Both are wrapped in the same small interface.
 */

export interface DictationHandlers {
  /** Text still being recognised (replace, don't append). */
  onPartial: (text: string) => void;
  /** A finished phrase to append to what the user is writing. */
  onFinal: (text: string) => void;
  /** Listening stopped (by the user, silence or an error). */
  onEnd: () => void;
  onError: (message: string) => void;
}

export interface DictationSession {
  stop: () => void;
}

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRConstructor = new () => SpeechRecognitionLike;

function webRecognizer(): SRConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const isNativeApp = () => Capacitor.isNativePlatform();

export function dictationSupported(): boolean {
  return isNativeApp() || !!webRecognizer();
}

const language = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

export async function startDictation(h: DictationHandlers): Promise<DictationSession> {
  return isNativeApp() ? startNative(h) : startWeb(h);
}

function startWeb(h: DictationHandlers): DictationSession {
  const SR = webRecognizer();
  if (!SR) throw new Error('Dictation isn’t available in this browser. Try Chrome or Safari.');
  let stopped = false;
  let startedAt = Date.now();
  let quickEnds = 0;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = language();

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0].transcript;
      if (r.isFinal) h.onFinal(text.trim());
      else interim += text;
    }
    h.onPartial(interim.trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    stopped = true;
    h.onError(
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone access is blocked. Allow it in your browser’s site settings to dictate.'
        : e.error === 'network'
          ? 'Dictation needs an internet connection in this browser.'
          : 'Dictation stopped unexpectedly. Try again.',
    );
  };
  rec.onend = () => {
    // Browsers end recognition after a pause; keep going until the user stops,
    // but give up if it keeps ending immediately (e.g. no mic).
    if (!stopped) {
      quickEnds = Date.now() - startedAt < 1500 ? quickEnds + 1 : 0;
      if (quickEnds < 3) {
        startedAt = Date.now();
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
    }
    h.onPartial('');
    h.onEnd();
  };
  rec.start();
  return {
    stop: () => {
      stopped = true;
      rec.stop();
    },
  };
}

async function startNative(h: DictationHandlers): Promise<DictationSession> {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('Dictation isn’t available on this device.');

  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') {
    throw new Error('Allow Speech Recognition and Microphone for Lifeline in the Settings app to dictate.');
  }

  // iOS reports the whole utterance so far on every partial result; commit it
  // as one final phrase when listening ends.
  let current = '';
  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    if (current.trim()) h.onFinal(current.trim());
    h.onPartial('');
    await SpeechRecognition.removeAllListeners();
    h.onEnd();
  };

  await SpeechRecognition.addListener('partialResults', (data) => {
    current = data.matches?.[0] ?? current;
    h.onPartial(current);
  });
  await SpeechRecognition.addListener('listeningState', (data) => {
    if (data.status === 'stopped') void finish();
  });

  SpeechRecognition.start({ language: language(), partialResults: true, popup: false }).catch((e: Error) => {
    h.onError(e.message || 'Dictation stopped unexpectedly.');
    void finish();
  });

  return {
    stop: () => {
      SpeechRecognition.stop()
        .catch(() => {})
        .finally(() => void finish());
    },
  };
}

/** Append dictated text to what's already written, with sensible spacing and capitals. */
export function appendDictation(existing: string, phrase: string): string {
  const p = phrase.trim();
  if (!p) return existing;
  const base = existing.replace(/\s+$/, '');
  const startsSentence = !base || /[.!?\n]$/.test(base);
  let piece = startsSentence ? p[0].toUpperCase() + p.slice(1) : p;
  if (!/[.!?,;:]$/.test(piece)) piece += '.';
  if (!base) return piece;
  return `${base}${base.endsWith('\n') ? '' : ' '}${piece}`;
}

// ------------------------------------------------------------------ recording

export interface VoiceClip {
  blob: Blob;
  mime: string;
  durationMs: number;
}

export function recordingSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

/** Pick a container the current browser can both record and play back. */
export function pickAudioMime(): string {
  const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const m of options) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return '';
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
