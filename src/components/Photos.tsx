import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useBlobUrl } from '../hooks/data';
import { processImage, type ProcessedPhoto } from '../lib/images';
import { cx } from './ui';

/** A photo either already stored (id) or freshly picked and not yet saved. */
export type EditorPhoto =
  | { kind: 'stored'; id: string; thumb: Blob }
  | { kind: 'new'; key: string; data: ProcessedPhoto };

function Thumb({ blob, onRemove, label }: { blob: Blob; onRemove: () => void; label: string }) {
  const url = useBlobUrl(blob);
  return (
    <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-sunken">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--overlay)] text-white backdrop-blur"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function PhotoPicker({
  photos,
  onChange,
  onDateFound,
}: {
  photos: EditorPhoto[];
  onChange: (p: EditorPhoto[]) => void;
  /** Called with the earliest EXIF date found among newly added photos. */
  onDateFound?: (iso: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: EditorPhoto[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push({ kind: 'new', key: crypto.randomUUID?.() ?? String(Math.random()), data: await processImage(f) });
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setBusy(false);
    if (added.length) {
      onChange([...photos, ...added]);
      const dates = added
        .map((p) => (p.kind === 'new' ? p.data.takenAt : null))
        .filter((d): d is string => !!d)
        .sort();
      if (dates[0]) onDateFound?.(dates[0]);
    }
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        {photos.map((p, i) => (
          <Thumb
            key={p.kind === 'stored' ? p.id : p.key}
            blob={p.kind === 'stored' ? p.thumb : p.data.thumb}
            label={`Remove photo ${i + 1}`}
            onRemove={() => onChange(photos.filter((x) => x !== p))}
          />
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cx(
            'flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-graphite',
            'hover:border-tide hover:text-tide',
          )}
        >
          {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
          <span className="text-xs font-medium">{busy ? 'Adding' : 'Add photos'}</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
