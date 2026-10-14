'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings2, Volume2, VolumeX, X } from 'lucide-react';
import {
  AUDIO_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS, SHARINGAN_AUDIO_EVENT, dialogueDelay,
  parseAudioSettings, type AudioSettings, type SharinganSound,
} from '@/lib/site-audio-library';
import { SiteAudioEngine, SILENT_AUDIO_STATUS } from '@/lib/site-audio';

const controlClass = 'inline-flex h-11 items-center justify-center gap-2 border border-signal/50 bg-ink/95 px-3 monofont text-[10px] uppercase tracking-wider text-bone transition-colors hover:bg-signal hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal';

export function SiteAudio() {
  const engine = useRef<SiteAudioEngine | null>(null);
  const container = useRef<HTMLElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState(SILENT_AUDIO_STATUS);
  const [settings, setSettings] = useState<AudioSettings>({ ...DEFAULT_AUDIO_SETTINGS });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const mixer = new SiteAudioEngine(setStatus);
    engine.current = mixer;
    let saved = { ...DEFAULT_AUDIO_SETTINGS };
    try { saved = parseAudioSettings(localStorage.getItem(AUDIO_STORAGE_KEY)); } catch {}
    mixer.setSettings(saved);
    setSettings(saved);
    const onEye = (event: Event) => {
      const phase = (event as CustomEvent<SharinganSound>).detail;
      if (phase === 'sharingan' || phase === 'mangekyo') void mixer.playSharingan(phase);
    };
    const onVisibility = () => { void mixer.visibilityChanged(); };
    window.addEventListener(SHARINGAN_AUDIO_EVENT, onEye);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(SHARINGAN_AUDIO_EVENT, onEye);
      document.removeEventListener('visibilitychange', onVisibility);
      mixer.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    if (!status.enabled || status.loading || !settings.randomDialogue) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        // Keep voice interludes away from typing and other media playback.
        const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
        const otherMedia = Array.from(document.querySelectorAll('audio, video'))
          .some((element) => !(element as HTMLMediaElement).paused);
        if (!document.hidden && !editing && !otherMedia) void engine.current?.playDialogue();
        schedule();
      }, dialogueDelay());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [status.enabled, status.loading, settings.randomDialogue]);

  useEffect(() => {
    if (!expanded) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        settingsButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [expanded]);

  const update = (next: AudioSettings) => {
    setSettings(next);
    engine.current?.setSettings(next);
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <aside ref={container} aria-label="Site audio" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[80] max-w-[calc(100vw-2rem)]">
      {expanded && (
        <div id="site-audio-settings" role="region" aria-label="Audio settings" className="mb-2 w-72 max-w-full border border-signal/50 bg-ink p-4 text-bone shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="monofont text-xs uppercase tracking-widest text-signal">Shinobi radio</h2>
            <button type="button" aria-label="Close audio settings" className="flex h-11 w-11 items-center justify-center text-bone hover:text-signal focus-visible:outline focus-visible:outline-signal" onClick={() => { setExpanded(false); settingsButton.current?.focus(); }}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Quiet music. Louder voices over the music. Sound starts when you enable it.</p>
          {(['music', 'dialogue', 'effects'] as const).map((channel) => (
            <label key={channel} className="mb-4 block text-xs">
              <span className="mb-2 flex justify-between capitalize">
                <span>{channel === 'effects' ? 'Sharingan effects' : channel}</span>
                <span>{Math.round(settings[channel] * 100)}%</span>
              </span>
              <input type="range" min="0" max="100" step="1" aria-label={channel + ' volume'} aria-valuetext={Math.round(settings[channel] * 100) + ' percent'} value={Math.round(settings[channel] * 100)} onChange={(event) => update({ ...settings, [channel]: Number(event.target.value) / 100 })} className="h-6 w-full cursor-pointer accent-[#e3140f]" />
            </label>
          ))}
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-xs">
            Random character dialogue
            <input type="checkbox" checked={settings.randomDialogue} onChange={(event) => update({ ...settings, randomDialogue: event.target.checked })} className="h-4 w-4 accent-[#e3140f]" />
          </label>
          <button type="button" disabled={!status.enabled || status.loading || settings.dialogue === 0} onClick={() => { void engine.current?.playDialogue(); }} className="mt-3 min-h-11 w-full border border-signal/40 px-3 text-xs text-signal hover:bg-signal/10 disabled:cursor-not-allowed disabled:opacity-40">
            Play a dialogue
          </button>
          <p className="mt-3 min-h-8 text-xs leading-relaxed text-muted-foreground" aria-live="polite">{status.quote ? status.quote.character + ' · ' + status.quote.text : 'Random interludes every 45–90 seconds while browsing.'}</p>
          <a href="/audio/CREDITS.txt" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block py-2 text-[10px] text-muted-foreground underline underline-offset-4 hover:text-bone">Audio credits</a>
        </div>
      )}
      {status.error && <p role="status" className="mb-2 max-w-72 border border-signal/40 bg-ink p-3 text-xs text-bone">{status.error}</p>}
      <div className="flex justify-end gap-1">
        <button type="button" aria-label={status.enabled ? 'Mute site audio' : 'Enable site audio'} aria-pressed={status.enabled} onClick={() => { if (status.enabled) engine.current?.disable(); else void engine.current?.enable(); }} className={controlClass}>
          {status.enabled ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          {status.loading ? 'Loading audio' : status.enabled ? 'Sound on' : 'Sound off'}
        </button>
        <button ref={settingsButton} type="button" aria-label="Audio settings" aria-expanded={expanded} aria-controls="site-audio-settings" onClick={() => setExpanded((value) => !value)} className={controlClass}>
          <Settings2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
