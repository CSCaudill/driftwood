import { db } from '../db/db';
import { createMemory, createPerson, emptyDraft, getSettings, saveChapter, suggestedChapters, updateSettings, type MemoryDraft } from '../db/repo';
import type { FuzzyDate, Settings } from '../types';

/**
 * A small, realistic sample life so people can see how the timeline works
 * before they add their own. Uses mixed date precision on purpose.
 */
export async function loadSampleLife() {
  const birthYear = 1988;
  // Keep the person's own settings so "Exit sample" can put them back.
  const before = await getSettings();
  if (!before.sampleActive) await db.meta.put({ key: 'sampleBackup', value: before });
  await updateSettings({ birthYear, onboarded: true, sampleActive: true });
  const cast: [string, string][] = [
    ['Mom', 'Mom'],
    ['Dad', 'Dad'],
    ['Grandpa', 'Grandpa'],
    ['Grandma', 'Grandma'],
    ['Danny', 'Neighbor and friend'],
    ['Priya', 'Best friend'],
    ['Mrs. Alvarez', 'Teacher'],
  ];
  const ids = new Map<string, string>();
  for (const [name, relationship] of cast) {
    const existing = (await db.people.toArray()).find((p) => p.name === name);
    if (existing) ids.set(name, existing.id);
    else {
      const p = await createPerson({ name, relationship, avatar: null, notes: '' });
      await db.people.update(p.id, { sample: true });
      ids.set(name, p.id);
    }
  }

  for (const [title, notes, date, { people = [], toldBy = [], ...extra }] of SAMPLE_ENTRIES) {
    const personIds = people.map((n) => ids.get(n)!).filter(Boolean);
    const sourcePersonIds = toldBy.map((n) => ids.get(n)!).filter(Boolean);
    const m = await createMemory(emptyDraft({ title, notes, date, personIds, sourcePersonIds, ...extra }));
    await db.memories.update(m.id, { sample: true });
  }
  if ((await db.chapters.count()) === 0) {
    for (const c of sampleFrame(birthYear)) {
      const saved = await saveChapter(c);
      await db.chapters.update(saved.id, { sample: true });
    }
  }
}

type SampleExtra = Partial<MemoryDraft> & { people?: string[]; toldBy?: string[] };

const SAMPLE_ENTRIES: [string, string, FuzzyDate, SampleExtra][] = [
    ['The yellow kitchen on Maple Street', 'Linoleum floor with little brown squares. Mom singing along to the radio while making pancakes on Sunday mornings.', { precision: 'age', age: 4, ageEnd: 6 }, { clarity: 'partial', feeling: 'tender', location: 'Maple Street house', people: ['Mom'], tags: ['home'], source: 'mixed', toldBy: ['Mom'] }],
    ['Lost tooth at the zoo', 'Bit into a caramel apple by the elephant enclosure. Dad wrapped the tooth in a napkin.', { precision: 'season', year: 1995, season: 'summer' }, { clarity: 'vivid', feeling: 'joyful', people: ['Dad'], location: 'City Zoo', source: 'told', toldBy: ['Dad'] }],
    ['Mrs. Alvarez’s classroom', 'Second grade. She let me feed the class hamster and read my story out loud to everyone.', { precision: 'year', year: 1996, circa: true }, { clarity: 'partial', feeling: 'proud', people: ['Mrs. Alvarez'], tags: ['school'] }],
    ['Fort in the backyard woods', 'Built with Danny from next door out of pallets and a tarp. We called it “the base.”', { precision: 'range', year: 1997, endYear: 1999 }, { clarity: 'faint', feeling: 'joyful', people: ['Danny'], tags: ['friends'] }],
    ['First snow day I remember', '', { precision: 'month', year: 1997, month: 1 }, { clarity: 'faint', feeling: 'calm' }],
    ['Grandpa’s workshop', 'Sawdust smell. He showed me how to hammer a nail without bending it.', { precision: 'decade', decade: 1990 }, { clarity: 'partial', feeling: 'bittersweet', people: ['Grandpa'], favorite: true }],
    ['Moving to Austin', 'Everything we owned in a U-Haul. I cried leaving Danny behind.', { precision: 'day', year: 2001, month: 6, day: 14 }, { clarity: 'vivid', feeling: 'bittersweet', location: 'Austin, TX', people: ['Mom', 'Dad', 'Danny'], tags: ['move'] }],
    ['First day at Lamar Middle', 'Didn’t know a single person. Sat alone at lunch, then met Priya in band.', { precision: 'month', year: 2001, month: 8 }, { clarity: 'vivid', feeling: 'difficult', people: ['Priya'], tags: ['school'] }],
    ['Marching band state finals', 'We placed fourth. The bus ride home was the best part.', { precision: 'season', year: 2005, season: 'fall' }, { clarity: 'vivid', feeling: 'proud', people: ['Priya'], tags: ['band'], favorite: true }],
    ['Learning to drive in the church parking lot', '', { precision: 'year', year: 2004 }, { clarity: 'partial', feeling: 'joyful', people: ['Dad'] }],
    ['Graduation', 'Hot gym, too-long gown. Grandma came even though it was hard for her to travel.', { precision: 'day', year: 2006, month: 5, day: 27 }, { clarity: 'vivid', feeling: 'proud', people: ['Grandma', 'Mom', 'Dad'], tags: ['milestone'] }],
    ['A song on the radio at the lake', 'Can’t remember what year — just the dock, the song, and feeling completely free.', { precision: 'unknown' }, { clarity: 'faint', feeling: 'calm' }],
];

const SAMPLE_PEOPLE = ['Mom', 'Dad', 'Grandpa', 'Grandma', 'Danny', 'Priya', 'Mrs. Alvarez'];

function sampleFrame(birthYear: number) {
  return [
    ...suggestedChapters(birthYear),
    { kind: 'home' as const, title: 'Maple Street house', detail: 'Columbus, OH', startYear: 1988, endYear: 2001, color: 'sand' as const },
    { kind: 'home' as const, title: 'Oak Hill house', detail: 'Austin, TX', startYear: 2001, endYear: 2006, color: 'sand' as const },
    { kind: 'milestone' as const, title: 'Moved to Austin', detail: '', startYear: 2001, endYear: 2001, color: 'sand' as const },
    { kind: 'work' as const, title: 'H-E-B bagger', detail: 'After school', startYear: 2004, endYear: 2006, color: 'sand' as const },
  ];
}

/**
 * Sample lives loaded before sample data was tagged: recognise them by their
 * memory titles and tag them, so "Exit sample" works. Runs once at startup.
 */
export async function adoptUntaggedSample(): Promise<boolean> {
  const settings = await getSettings();
  if (settings.sampleActive) return false;
  const titles = new Set(SAMPLE_ENTRIES.map(([t]) => t));
  const memories = await db.memories.toArray();
  const matches = memories.filter((m) => titles.has(m.title) && !m.sample);
  if (matches.length < 8) return false;

  await db.transaction('rw', [db.memories, db.people, db.chapters, db.meta], async () => {
    await db.memories.bulkPut(matches.map((m) => ({ ...m, sample: true })));
    const matchIds = new Set(matches.map((m) => m.id));
    const ownRefs = new Set(
      memories.filter((m) => !matchIds.has(m.id)).flatMap((m) => [...m.personIds, ...(m.sourcePersonIds ?? [])]),
    );
    const people = (await db.people.toArray()).filter((p) => SAMPLE_PEOPLE.includes(p.name) && !ownRefs.has(p.id));
    await db.people.bulkPut(people.map((p) => ({ ...p, sample: true })));
    const frameTitles = new Set(sampleFrame(1988).map((c) => c.title));
    const chapters = (await db.chapters.toArray()).filter((c) => frameTitles.has(c.title));
    await db.chapters.bulkPut(chapters.map((c) => ({ ...c, sample: true })));
    await db.meta.put({ key: 'settings', value: { ...settings, sampleActive: true } });
  });
  return true;
}

/**
 * Leave the sample life: remove its memories (with their photos and voice
 * notes), people and life-frame entries, keep anything the person added
 * themselves, and restore their own settings. Returns how many of the
 * person's own memories were kept.
 */
export async function exitSampleLife(): Promise<number> {
  const tables = [db.memories, db.photos, db.recordings, db.people, db.chapters, db.meta];
  return db.transaction('rw', tables, async () => {
    const memories = await db.memories.toArray();
    const sampleMemoryIds = memories.filter((m) => m.sample).map((m) => m.id);
    const samplePeople = new Set((await db.people.toArray()).filter((p) => p.sample).map((p) => p.id));

    await db.photos.where('memoryId').anyOf(sampleMemoryIds).delete();
    await db.recordings.where('memoryId').anyOf(sampleMemoryIds).delete();
    await db.memories.bulkDelete(sampleMemoryIds);

    // Keep the person's own memories, minus any sample people tagged on them.
    const own = memories.filter((m) => !m.sample);
    const cleaned = own
      .filter((m) => m.personIds.some((id) => samplePeople.has(id)) || (m.sourcePersonIds ?? []).some((id) => samplePeople.has(id)))
      .map((m) => ({
        ...m,
        personIds: m.personIds.filter((id) => !samplePeople.has(id)),
        sourcePersonIds: (m.sourcePersonIds ?? []).filter((id) => !samplePeople.has(id)),
      }));
    if (cleaned.length) await db.memories.bulkPut(cleaned);
    await db.people.bulkDelete([...samplePeople]);
    await db.chapters.bulkDelete((await db.chapters.toArray()).filter((c) => c.sample).map((c) => c.id));

    // Restore the person's own settings, keeping the appearance they picked meanwhile.
    // With no earlier setup and nothing of their own, this returns to the welcome screen.
    const backup = (await db.meta.get('sampleBackup'))?.value as Settings | undefined;
    const current = await getSettings();
    await db.meta.delete('sampleBackup');
    const restored: Settings = {
      ...(backup ?? { ...current, onboarded: false, birthYear: null, name: '' }),
      theme: current.theme,
      sampleActive: false,
    };
    if (!restored.onboarded && own.length > 0) restored.onboarded = true;
    // Through updateSettings so age-based memories are re-filed if the birth year changes.
    await updateSettings(restored);
    return own.length;
  });
}
