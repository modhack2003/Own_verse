'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  AUDIO_SETTINGS_EVENT, SHARINGAN_AUDIO_EVENT, THEME_MUTE_KEY,
  parseAudioSettings, type SharinganSound,
} from '@/lib/site-audio-library';
import { SiteAudioEngine } from '@/lib/site-audio';

/** Public visitors control only their own theme mute preference. */
export function SiteAudio() {
  const engine = useRef<SiteAudioEngine | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const mixer = new SiteAudioEngine(() => {});
    engine.current = mixer;
    let saved = false;
    try { saved = localStorage.getItem(THEME_MUTE_KEY) === 'true'; } catch {}
    mixer.setThemeMuted(saved);
    setMuted(saved);
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/site-audio', {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok) throw new Error('Settings unavailable');
        const settings = parseAudioSettings(await response.json());
        if (!controller.signal.aborted) mixer.setSettings(settings);
      } catch { /* Defaults keep audio working if settings cannot load. */ }
    };
    // Never put the settings API (including its cold-start timeout) on the
    // audio startup path. Apply shared settings as soon as they arrive.
    void mixer.enable();
    void load();
    const refresh = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    const onSettings = () => { void load(); };
    const onGesture = () => mixer.unlock();
    const onEye = (event: Event) => {
      const phase = (event as CustomEvent<SharinganSound>).detail;
      if (phase === 'sharingan' || phase === 'mangekyo') void mixer.playSharingan(phase);
    };
    const onVisibility = () => { void mixer.visibilityChanged(); };
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onGesture, true);
    window.addEventListener(SHARINGAN_AUDIO_EVENT, onEye);
    window.addEventListener(AUDIO_SETTINGS_EVENT, onSettings);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort(); clearInterval(refresh);
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      window.removeEventListener(SHARINGAN_AUDIO_EVENT, onEye);
      window.removeEventListener(AUDIO_SETTINGS_EVENT, onSettings);
      document.removeEventListener('visibilitychange', onVisibility);
      mixer.dispose(); engine.current = null;
    };
  }, []);

  const toggle = () => {
    const next = !muted;
    engine.current?.setThemeMuted(next);
    setMuted(next);
    try { localStorage.setItem(THEME_MUTE_KEY, String(next)); } catch {}
  };

  return (
    <button type="button" aria-label={muted ? 'Unmute theme music' : 'Mute theme music'} aria-pressed={muted}
      title={muted ? 'Unmute theme music' : 'Mute theme music'} onClick={toggle}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[80] flex h-11 w-11 items-center justify-center border border-signal/50 bg-ink/95 text-bone transition-colors hover:bg-signal hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
      {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
    </button>
  );
}
