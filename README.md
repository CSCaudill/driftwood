# Lifeline

Capture memories as they surface and place them on a timeline of your life.

Lifeline is for people who want to rebuild a picture of their past, including people who don't remember much of it. Memories often come back as fragments with no date. The app lets you write them down in seconds, file them as precisely or loosely as you actually know, and rearrange them as more comes back.

One codebase runs **on the web** and **on iOS** (wrapped with Capacitor).

<p>
  <img src="docs/screenshots/phone-timeline.jpg" width="200" alt="Timeline on a phone" />
  <img src="docs/screenshots/phone-memory.jpg" width="200" alt="A memory" />
  <img src="docs/screenshots/phone-fuzzy-date.jpg" width="200" alt="Dating a memory by age" />
  <img src="docs/screenshots/phone-dark.jpg" width="200" alt="Dark theme" />
</p>
<img src="docs/screenshots/desktop-timeline.jpg" width="820" alt="Timeline on desktop" />

---

## What's in it

| Area | What it does |
| --- | --- |
| **Timeline** | Year-by-year spine with sticky year numerals, your age in each year, chapter colors, "Born" and "Today" markers, and a decade jump bar. |
| **Fuzzy dates** | Exact day, month, season, year, *my age* ("ages 8–10"), between years, decade, or *not sure yet*. Plus a **Roughly** toggle for "around…". |
| **Clarity** | Each memory is marked vivid, partial or faint, and drawn that way: faint memories are lighter, with an open dashed dot and a softened photo. |
| **Rearrange** | Drag memories into the order you remember them. Dropping one into another year re-dates it, with **Undo**. Exact-day memories are pinned. "Sort by date" resets a year. |
| **Unplaced** | An inbox for memories with no date yet. One-line quick capture, then **Place it** later. |
| **Empty years** | Gaps in the timeline show as gentle "Nothing here yet · Add one" rows, pre-filled with that year range. You can turn these off. |
| **Reflection prompts** | 35 concrete prompts about places, people, senses, firsts, everyday life and milestones. Some suggest an age range. |
| **Chapters** | Named eras ("High school", "The Denver years") that color the spine. School-year chapters are generated from your birth year as a starting point. |
| **Photos** | Downscaled on the device, with the capture date read from the photo's EXIF data and offered as the memory's date. |
| **Details** | Place, people and tags (autocompleted from what you've used before), feeling, favorites, and **Keep it covered** for memories you don't want shown on the timeline. |
| **Search** | Full-text search across titles, notes, places, people and tags, with favorite and feeling filters. |
| **Privacy and data** | Everything is stored on the device (IndexedDB). Back up and restore as a single JSON file, including photos. |
| **Polish** | Light and dark themes, iOS safe areas, a bottom sheet on phones and a dialog on desktop, keyboard-accessible drag and drop, reduced-motion support. |

## Tech stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4**, with design tokens in `src/index.css`
- **Dexie** (IndexedDB) for local-first storage, plus `dexie-react-hooks` for live queries
- **@dnd-kit** for touch, mouse and keyboard drag and drop
- **Capacitor 8** for the iOS app
- **Vitest** + `fake-indexeddb` for unit tests
- Fonts are bundled, so the app works offline: Bricolage Grotesque (interface and year numerals) and Literata (memory text)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (date model, ordering, storage)
npm run build      # production build into dist/
```

On first launch, choose **Look around with a sample life first** to see a populated timeline.

## Running on iOS

Requirements: a Mac with Xcode 16+ and an Apple Developer account (needed for devices and the App Store).

```bash
# one time
npm run ios:add          # generates the native ios/ project. Commit it.

# every time you change web code
npm run ios:sync         # builds and copies into the iOS project
npm run ios:open         # opens Xcode, then press Run
```

Before you ship:

1. Change `appId` in `capacitor.config.ts` to your own bundle id (e.g. `com.yourname.lifeline`).
2. In Xcode, set your team under *Signing & Capabilities*.
3. Add `NSPhotoLibraryUsageDescription` and `NSCameraUsageDescription` to `ios/App/App/Info.plist`. Photo picking uses the system picker, and iOS requires these strings for the camera option.
4. Replace `public/icon.svg` with a 1024×1024 PNG app icon in the asset catalog.

## Project structure

```
src/
  types.ts                 Domain model: Memory, FuzzyDate, Chapter, Settings
  db/
    db.ts                  Dexie schema
    repo.ts                All writes. Keeps derived sort fields consistent.
  lib/
    fuzzyDate.ts           Resolve, format and shift fuzzy dates
    ordering.ts            Year sections, manual ranks, gap detection
    images.ts              Downscale, thumbnail, EXIF date
    backup.ts              Export and import (JSON, photos as base64)
    prompts.ts             Reflection prompts
    sample.ts              Sample life for first-run exploration
  components/              UI building blocks, editor, date picker, rearrange list
  screens/                 Timeline, Memory, Unplaced, Chapters, Settings, Onboarding
```

## How uncertain dates and reordering work

Every memory stores its `FuzzyDate` as you entered it. From that the app derives:

- `sortStart` / `sortEnd`: concrete ISO bounds. "Summer 1998" becomes Jun 1 to Aug 31; "age 8" becomes birth year + 8 to + 9.
- `groupYear`: the year section it's filed under (the start year), or `null` if unplaced.
- `rank`: an optional manual position within its year.

Within a year, memories are ordered by date until you rearrange them. Then every memory in that year gets a spaced numeric rank, and later moves write a single midpoint rank. New memories added to an arranged year are merged in by date, so your manual order is never lost. Dragging a memory into another year shifts its date while keeping its precision: a "season" stays a season, an age range shifts by the same number of years, and dropping a range onto a year inside it narrows the range. Changing your birth year re-files age-based memories automatically.

## Ideas for expanding it

**Near term**
- **Voice capture with transcription.** Memories often surface while driving or falling asleep, when typing isn't practical. Use `@capacitor-community/speech-recognition` or the Web Speech API.
- **Face ID lock** (`capacitor-native-biometric`) and an encrypted database option for an app that may hold sensitive material.
- **"On this day" and gentle reminders.** Optional local notifications with a prompt, at a time you choose.
- **Photo-first capture.** Pick a batch of old photos and get one draft memory per photo, pre-dated from EXIF.
- **Native share and export** through `@capacitor/share` and `@capacitor/filesystem`, plus a PDF "life story" export arranged by chapter.

**Bigger features**
- **Optional encrypted sync** across devices (CloudKit on iOS, or Supabase with client-side encryption). The JSON backup format is already the migration path.
- **Ask family.** Send a link so a parent or sibling can add a memory or a photo from their side, which then shows up as a suggestion to accept.
- **Share with a therapist.** A read-only, time-limited link to selected memories or a chapter.
- **Map view** of places, and a **people view** that collects every memory involving one person.
- **Memory threads** that link related memories ("the lake house" across many summers), shown as connected dots on the timeline.
- **AI-assisted recall (opt-in).** Follow-up questions about a memory you've written, or prompts drawn from the gaps in your timeline. Keep this strictly opt-in and transparent, given how personal the content is.
- **Home-screen widget** with a daily prompt.

**Product and launch**
- Write the App Store privacy label as "Data not collected": the app has no analytics or network calls.
- Get a clinician's review of prompt wording and of how difficult memories are handled. Consider an optional "If this brings up something hard" resources screen.
