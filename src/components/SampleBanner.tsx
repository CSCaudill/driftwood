import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/data';
import { exitSampleLife } from '../lib/sample';
import { useApp } from '../state/app';
import { Button, Sheet, cx } from './ui';

/** Confirm, then remove the sample life and keep everything the person added. */
export function useExitSample() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useApp();

  const exit = async () => {
    setBusy(true);
    const kept = await exitSampleLife();
    setBusy(false);
    setConfirming(false);
    navigate('/');
    showToast(
      kept > 0
        ? `Sample removed. Your ${kept} ${kept === 1 ? 'memory is' : 'memories are'} still here.`
        : 'Sample removed',
    );
  };

  const sheet = (
    <Sheet
      open={confirming}
      onClose={() => setConfirming(false)}
      size="sm"
      title="Exit the sample life?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setConfirming(false)}>Keep exploring</Button>
          <Button variant="primary" onClick={exit} disabled={busy}>Exit sample</Button>
        </div>
      }
    >
      <p className="text-graphite">
        The sample’s memories, people and life frame will be removed. Anything you added yourself stays, and your own
        settings come back.
      </p>
    </Sheet>
  );
  return { open: () => setConfirming(true), sheet };
}

export function SampleBanner({ className }: { className?: string }) {
  const { sampleActive } = useSettings();
  const { open, sheet } = useExitSample();
  if (!sampleActive) return null;
  return (
    <>
      <div
        className={cx(
          'flex items-center gap-3 rounded-2xl border border-lantern/40 bg-lantern-wash py-2.5 pl-4 pr-2 text-sm',
          className,
        )}
        role="status"
      >
        <span className="flex-1 text-ink">You’re exploring a sample life.</span>
        <Button size="sm" variant="secondary" onClick={open}>Exit sample</Button>
      </div>
      {sheet}
    </>
  );
}
