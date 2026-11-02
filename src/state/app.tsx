import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MemoryDraft } from '../db/repo';

/**
 * App-wide UI state: the memory editor (opened from anywhere) and toasts with
 * an optional Undo action.
 */

export interface EditorRequest {
  /** Existing memory to edit; omit to create. */
  memoryId?: string;
  /** Pre-filled values for a new memory (e.g. from a prompt or a gap). */
  initial?: Partial<MemoryDraft>;
  /** Placeholder text for the title, e.g. the prompt that inspired it. */
  promptText?: string;
  /** Open straight to the date picker (used by "Place it" in Unplaced). */
  focusDate?: boolean;
}

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface AppState {
  editor: EditorRequest | null;
  openEditor: (req?: EditorRequest) => void;
  closeEditor: () => void;
  toast: Toast | null;
  showToast: (message: string, action?: Toast['action']) => void;
  dismissToast: () => void;
  /** The memory most recently saved/moved, highlighted briefly on the timeline. */
  lastTouched: string | null;
  setLastTouched: (id: string | null) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastTouched, setLastTouched] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message: string, action?: Toast['action']) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action });
    timer.current = window.setTimeout(() => setToast(null), action ? 6000 : 3200);
  }, []);
  const openEditor = useCallback((req: EditorRequest = {}) => setEditor(req), []);
  const closeEditor = useCallback(() => setEditor(null), []);

  const value = useMemo(
    () => ({ editor, openEditor, closeEditor, toast, showToast, dismissToast, lastTouched, setLastTouched }),
    [editor, openEditor, closeEditor, toast, showToast, dismissToast, lastTouched],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
