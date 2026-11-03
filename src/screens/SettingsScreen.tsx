import { useRef, useState, type ReactNode } from 'react';
import { Download, ShieldCheck, Upload } from 'lucide-react';
import { Button, FieldLabel, Segmented, Sheet, TextInput, Toggle } from '../components/ui';
import { updateSettings, wipeEverything } from '../db/repo';
import { useMemories, useSettings } from '../hooks/data';
import { downloadBackup, parseBackup, restoreBackup, type BackupFile } from '../lib/backup';
import { currentYear } from '../lib/fuzzyDate';
import { useApp } from '../state/app';
import { useExitSample } from '../components/SampleBanner';
import type { ThemePreference } from '../types';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-graphite">{title}</h2>
      <div className="space-y-5 rounded-3xl border border-line bg-paper p-5">{children}</div>
    </section>
  );
}

export function SettingsScreen() {
  const settings = useSettings();
  const memories = useMemories();
  const { showToast } = useApp();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [wiping, setWiping] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const exitSample = useExitSample();

  const years: number[] = [];
  for (let y = currentYear(); y >= 1920; y--) years.push(y);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
    } catch (e) {
      showToast((e as Error).message);
    }
    if (file.current) file.current.value = '';
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const n = await restoreBackup(pending, mode);
    setPending(null);
    showToast(`Restored ${n} ${n === 1 ? 'memory' : 'memories'}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 sm:px-8">
      <header className="safe-top pb-2 pt-6">
        <h1 className="display text-2xl font-semibold">Settings</h1>
      </header>

      <Group title="About you">
        <div>
          <FieldLabel htmlFor="s-name">Your name</FieldLabel>
          <TextInput
            id="s-name"
            value={name ?? settings.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name != null) updateSettings({ name: name.trim() }); }}
            placeholder="Optional"
          />
        </div>
        <div>
          <FieldLabel htmlFor="s-birth" hint="Lets you date memories by age">Birth year</FieldLabel>
          <select
            id="s-birth"
            className="h-11 w-full rounded-xl border border-line bg-paper px-3.5 focus:border-tide focus:outline-none"
            value={settings.birthYear ?? ''}
            onChange={(e) => updateSettings({ birthYear: e.target.value ? +e.target.value : null })}
          >
            <option value="">Not set</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </Group>

      <Group title="Timeline">
        <div>
          <FieldLabel>Appearance</FieldLabel>
          <Segmented<ThemePreference>
            label="Appearance"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <Toggle
          checked={settings.showGaps}
          onChange={(showGaps) => updateSettings({ showGaps })}
          label="Show empty years"
          description="Marks stretches with no memories yet, with prompts to help fill them."
        />
        <Toggle
          checked={settings.showGrades}
          onChange={(showGrades) => updateSettings({ showGrades })}
          label="Show school grades"
          description="Adds the U.S. school grade to each childhood year, worked out from your birth year."
        />
      </Group>

      <Group title="Your data">
        <div className="flex gap-3 rounded-2xl bg-tide-wash p-4 text-sm text-tide">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>
            Everything you write stays on this device. Nothing is uploaded. Export a backup regularly so you can restore your
            timeline on a new phone or computer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Download size={16} />}
            onClick={async () => {
              const n = await downloadBackup();
              if (n) showToast(`Exported ${n} ${n === 1 ? 'memory' : 'memories'}`);
            }}
          >
            Export backup
          </Button>
          <Button icon={<Upload size={16} />} onClick={() => file.current?.click()}>
            Restore from backup
          </Button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          {settings.sampleActive && <Button onClick={exitSample.open}>Exit sample life</Button>}
          <Button variant="danger" onClick={() => setWiping(true)}>Delete everything</Button>
        </div>
      </Group>

      {exitSample.sheet}
      <p className="mt-8 text-center text-xs text-faint">Lantern 0.1.0</p>

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        size="sm"
        title="Restore backup"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="quiet" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => restore('merge')}>Add to current</Button>
            <Button variant="primary" onClick={() => restore('replace')}>Replace current</Button>
          </div>
        }
      >
        <p className="text-graphite">
          This backup has {pending?.memories.length ?? 0} memories from{' '}
          {pending ? new Date(pending.exportedAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : ''}. You currently
          have {memories?.length ?? 0}. Add them to what’s here, or replace everything on this device with the backup.
        </p>
      </Sheet>

      <Sheet
        open={wiping}
        onClose={() => setWiping(false)}
        size="sm"
        title="Delete everything?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setWiping(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await wipeEverything();
                setWiping(false);
              }}
            >
              Delete all memories
            </Button>
          </div>
        }
      >
        <p className="text-graphite">
          All {memories?.length ?? 0} memories, photos and chapters will be permanently removed from this device. Export a
          backup first if you might want them back.
        </p>
      </Sheet>
    </div>
  );
}
