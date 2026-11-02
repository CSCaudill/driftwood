import { db, type LifelineDB } from '../db/db';
import { getSettings } from '../db/repo';
import { newId } from './id';
import type { Chapter, Memory, Person, Photo, Recording, Settings } from '../types';

/**
 * Backups are a single JSON file containing every memory, chapter, setting and
 * photo (base64). Keeps the user in control of their data and is the
 * migration path to any future sync service.
 */

export const BACKUP_FORMAT = 'lifeline-backup';
export const BACKUP_VERSION = 2;

interface SerializedPerson extends Omit<Person, 'avatar'> {
  avatar: string | null;
  avatarMime: string | null;
}

interface SerializedRecording extends Omit<Recording, 'blob'> {
  blob: string;
}

interface SerializedPhoto extends Omit<Photo, 'blob' | 'thumb'> {
  blob: string;
  thumb: string;
  mime: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  memories: Memory[];
  chapters: Chapter[];
  photos: SerializedPhoto[];
  /** v2+ */
  people?: SerializedPerson[];
  /** v2+ */
  recordings?: SerializedRecording[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function createBackup(store: LifelineDB = db): Promise<BackupFile> {
  const [settings, memories, chapters, photos, people, recordings] = await Promise.all([
    getSettings(store),
    store.memories.toArray(),
    store.chapters.toArray(),
    store.photos.toArray(),
    store.people.toArray(),
    store.recordings.toArray(),
  ]);
  const serialized: SerializedPhoto[] = [];
  for (const p of photos) {
    serialized.push({
      ...p,
      mime: p.blob.type || 'image/jpeg',
      blob: await blobToBase64(p.blob),
      thumb: await blobToBase64(p.thumb),
    });
  }
  const serializedPeople: SerializedPerson[] = [];
  for (const p of people) {
    serializedPeople.push({
      ...p,
      avatar: p.avatar ? await blobToBase64(p.avatar) : null,
      avatarMime: p.avatar?.type || (p.avatar ? 'image/jpeg' : null),
    });
  }
  const serializedRecordings: SerializedRecording[] = [];
  for (const r of recordings) serializedRecordings.push({ ...r, blob: await blobToBase64(r.blob) });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    memories,
    chapters,
    photos: serialized,
    people: serializedPeople,
    recordings: serializedRecordings,
  };
}

export async function downloadBackup() {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const filename = `lifeline-backup-${backup.exportedAt.slice(0, 10)}.json`;

  // On iOS (Safari and the Capacitor shell) the share sheet is the natural way
  // to save to Files / iCloud Drive; <a download> is unreliable there.
  const file = new File([blob], filename, { type: 'application/json' });
  const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Lifeline backup' });
      return backup.memories.length;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 0;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return backup.memories.length;
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a Lifeline backup.');
  }
  const b = data as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT || !Array.isArray(b.memories)) {
    throw new Error('That file isn’t a Lifeline backup.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Lifeline.');
  }
  return upgradeBackup(b as BackupFile);
}

/** v1 backups stored people as plain names on each memory. */
function upgradeBackup(b: BackupFile): BackupFile {
  if ((b.version ?? 1) >= 2) return b;
  const byName = new Map<string, SerializedPerson>();
  const now = Date.now();
  const memories = b.memories.map((m) => {
    const legacy = (m as unknown as { people?: string[] }).people ?? [];
    const personIds = legacy.map((name) => {
      const key = name.trim().toLowerCase();
      let p = byName.get(key);
      if (!p) {
        p = { id: newId(), name: name.trim(), relationship: '', avatar: null, avatarMime: null, color: 'sage', notes: '', createdAt: now, updatedAt: now };
        byName.set(key, p);
      }
      return p.id;
    });
    const { people: _drop, ...rest } = m as Memory & { people?: string[] };
    return { ...rest, personIds };
  });
  return { ...b, version: 2, memories, people: [...byName.values()], recordings: [] };
}

/**
 * Restore a backup. `merge` keeps existing data and adds/overwrites by id;
 * `replace` wipes the device first.
 */
export async function restoreBackup(backup: BackupFile, mode: 'merge' | 'replace', store: LifelineDB = db) {
  const tables = [store.memories, store.photos, store.chapters, store.people, store.recordings, store.meta];
  await store.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all([
        store.memories.clear(),
        store.photos.clear(),
        store.chapters.clear(),
        store.people.clear(),
        store.recordings.clear(),
      ]);
      await store.meta.put({ key: 'settings', value: { ...backup.settings, onboarded: true } });
    }
    // When merging, match people by name so "Mom" isn't duplicated.
    let people = backup.people ?? [];
    let memories = backup.memories;
    if (mode === 'merge') {
      const existing = new Map((await store.people.toArray()).map((p) => [p.name.toLowerCase(), p.id]));
      const remap = new Map<string, string>();
      people = people.filter((p) => {
        const match = existing.get(p.name.toLowerCase());
        if (match && match !== p.id) {
          remap.set(p.id, match);
          return false;
        }
        return true;
      });
      if (remap.size) {
        memories = memories.map((m) => ({ ...m, personIds: m.personIds.map((id) => remap.get(id) ?? id) }));
      }
    }
    await store.memories.bulkPut(memories);
    await store.chapters.bulkPut(backup.chapters ?? []);
    await store.photos.bulkPut(
      (backup.photos ?? []).map(({ mime, blob, thumb, ...rest }) => ({
        ...rest,
        blob: base64ToBlob(blob, mime),
        thumb: base64ToBlob(thumb, mime),
      })),
    );
    await store.people.bulkPut(
      people.map(({ avatar, avatarMime, ...rest }) => ({
        ...rest,
        avatar: avatar ? base64ToBlob(avatar, avatarMime ?? 'image/jpeg') : null,
      })),
    );
    await store.recordings.bulkPut(
      (backup.recordings ?? []).map(({ blob, ...rest }) => ({ ...rest, blob: base64ToBlob(blob, rest.mime) })),
    );
  });
  return backup.memories.length;
}
