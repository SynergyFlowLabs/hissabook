'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Volume2, VolumeX } from 'lucide-react';
import { sounds, setSoundState, getSoundState, subscribeSoundState, DEFAULT_SOUND_STATE, type SoundState } from '@/lib/sounds';
import { vibrate } from '@/lib/haptics';

const VOLUME_STEPS: Array<{ value: SoundState['volume']; label: string }> = [
  { value: 0, label: 'Low' },
  { value: 1, label: 'Medium' },
  { value: 2, label: 'Full' },
];

/** Compact sounds & haptics control. Opens a small glass popover; persisted per device. */
export default function SoundControl({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SoundState>(DEFAULT_SOUND_STATE);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState(getSoundState());
    return subscribeSoundState(setState);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleEnabled = () => {
    const next = !state.enabled;
    setSoundState({ enabled: next });
    if (next) sounds.toggleOn();
  };
  const toggleHaptics = () => {
    const next = !state.haptics;
    setSoundState({ haptics: next });
    if (next) vibrate('success', true);
  };

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        className="ghost-icon-button"
        aria-label={state.enabled ? 'Sounds on — open sound settings' : 'Sounds off — open sound settings'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Sounds & haptics"
        onClick={() => setOpen((v) => !v)}
      >
        {state.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Sounds and haptics"
            className="glass-menu absolute bottom-full left-0 z-50 mb-2 w-64 p-3"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-tight text-[var(--ink)]">Sounds &amp; haptics</span>
            </div>

            <div className="flex items-center justify-between gap-2 py-1.5">
              <label htmlFor="hissabook-sound-toggle" className="text-[10.5px] font-semibold text-[var(--ink-soft)]">Interface sounds</label>
              <button
                id="hissabook-sound-toggle"
                role="switch"
                aria-checked={state.enabled}
                className={`sound-switch ${state.enabled ? 'on' : ''}`}
                onClick={toggleEnabled}
              ><span className="sound-switch-thumb" /></button>
            </div>

            <div className="py-1.5">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">Volume</span>
              <div className="sound-volume" role="radiogroup" aria-label="Sound volume">
                {VOLUME_STEPS.map((step) => (
                  <button
                    key={step.value}
                    role="radio"
                    aria-checked={state.volume === step.value}
                    disabled={!state.enabled}
                    className={state.volume === step.value ? 'active' : ''}
                    onClick={() => { setSoundState({ volume: step.value }); sounds.tap(); }}
                  >{step.label}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 py-1.5">
              <label htmlFor="hissabook-haptics-toggle" className="text-[10.5px] font-semibold text-[var(--ink-soft)]">Haptics (Android)</label>
              <button
                id="hissabook-haptics-toggle"
                role="switch"
                aria-checked={state.haptics}
                className={`sound-switch ${state.haptics ? 'on' : ''}`}
                onClick={toggleHaptics}
              ><span className="sound-switch-thumb" /></button>
            </div>

            <button
              type="button"
              className="subtle-button mt-1 w-full justify-center !text-[10px]"
              onClick={() => sounds.success()}
            ><Check size={12} /> Preview chime</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
