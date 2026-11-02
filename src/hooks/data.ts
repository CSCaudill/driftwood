import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getSettings } from '../db/repo';
import { DEFAULT_SETTINGS, type Chapter, type Memory, type Photo, type Settings } from '../types';

export function useSettings(): Settings & { loaded: boolean } {
  const s = useLiveQuery(() => getSettings(), [], null);
  return s ? { ...s, loaded: true } : { ...DEFAULT_SETTINGS, loaded: false };
}

export function useMemories(): Memory[] | undefined {
  return useLiveQuery(() => db.memories.toArray(), []);
}

export function useMemory(id: string | undefined): Memory | null | undefined {
  return useLiveQuery(async () => (id ? (await db.memories.get(id)) ?? null : null), [id]);
}

export function useChapters(): Chapter[] {
  return useLiveQuery(() => db.chapters.orderBy('startYear').toArray(), [], []) ?? [];
}

export function usePhotos(ids: string[]): Photo[] {
  const key = ids.join(',');
  const rows = useLiveQuery(async () => {
    if (!ids.length) return [];
    const found = await db.photos.bulkGet(ids);
    return found.filter((p): p is Photo => !!p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows ?? [];
}

/** Object URL for a blob, revoked automatically. */
export function useBlobUrl(blob: Blob | undefined | null): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

/** Thumbnail URL for a single photo id. */
export function usePhotoThumb(id: string | undefined, full = false): string | undefined {
  const photo = useLiveQuery(async () => (id ? db.photos.get(id) : undefined), [id]);
  return useBlobUrl(photo ? (full ? photo.blob : photo.thumb) : undefined);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
