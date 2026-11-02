import { db } from '../db/db';
import { createMemory, createPerson, emptyDraft, saveChapter, suggestedChapters, updateSettings, type MemoryDraft } from '../db/repo';
import type { FuzzyDate } from '../types';

/**
 * A small, realistic sample life so people can see how the timeline works
 * before they add their own. Uses mixed date precision on purpose.
 */
export async function loadSampleLife() {
  const birthYear = 1988;
  await updateSettings({ birthYear, onboarded: true });
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
    ids.set(name, existing?.id ?? (await createPerson({ name, relationship, avatar: null, notes: '' })).id);
  }

  type Extra = Partial<MemoryDraft> & { people?: string[] };
  const entries: [string, string, FuzzyDate, Extra][] = [
    ['The yellow kitchen on Maple Street', 'Linoleum floor with little brown squares. Mom singing along to the radio while making pancakes on Sunday mornings.', { precision: 'age', age: 4, ageEnd: 6 }, { clarity: 'partial', feeling: 'tender', location: 'Maple Street house', people: ['Mom'], tags: ['home'] }],
    ['Lost tooth at the zoo', 'Bit into a caramel apple by the elephant enclosure. Dad wrapped the tooth in a napkin.', { precision: 'season', year: 1995, season: 'summer' }, { clarity: 'vivid', feeling: 'joyful', people: ['Dad'], location: 'City Zoo' }],
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
  for (const [title, notes, date, { people = [], ...extra }] of entries) {
    const personIds = people.map((n) => ids.get(n)!).filter(Boolean);
    await createMemory(emptyDraft({ title, notes, date, personIds, ...extra }));
  }
  if ((await db.chapters.count()) === 0) {
    for (const c of suggestedChapters(birthYear)) await saveChapter(c);
  }
}
