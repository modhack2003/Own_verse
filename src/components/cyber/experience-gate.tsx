'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';

export type ExperienceMode = 'safe' | 'glitch';
const STORAGE_KEY = 'nd-experience-mode';
export const EXPERIENCE_EVENT = 'nd:experience-mode';

export function getExperienceMode(): ExperienceMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'safe' || value === 'glitch' ? value : null;
  } catch { return null; }
}

function subscribeMotion(listener: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener(EXPERIENCE_EVENT, listener);
  media.addEventListener('change', listener);
  return () => { window.removeEventListener(EXPERIENCE_EVENT, listener); media.removeEventListener('change', listener); };
}
/** Safe on the server and before consent, and reactive to OS preference changes. */
export function useCalmMotion() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || getExperienceMode() !== 'glitch', () => true);
}

function applyMode(mode: ExperienceMode) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effective = reduced ? 'safe' : mode;
  document.documentElement.classList.toggle('safe-mode', effective === 'safe');
  window.dispatchEvent(new CustomEvent(EXPERIENCE_EVENT, { detail: effective }));
}

/** Static before consent; Radix traps focus, hides background content and restores focus. */
export function ExperienceGate() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduced(media.matches);
      applyMode(getExperienceMode() ?? 'safe');
    };
    sync();
    media.addEventListener('change', sync);
    setOpen(pathname === '/' && !getExperienceMode());
    return () => media.removeEventListener('change', sync);
  }, [pathname]);

  const choose = (mode: ExperienceMode) => {
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* Private browsing still works. */ }
    applyMode(mode);
    setOpen(false);
    // There is no trigger button: move focus to the document's main content.
    requestAnimationFrame(() => {
      const main = document.querySelector('main');
      main?.setAttribute('tabindex', '-1');
      main?.focus({ preventScroll: true });
    });
  };

  return <Dialog.Root open={open} onOpenChange={value => { if (!value) choose('safe'); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[200] bg-ink" />
      <Dialog.Content
        className="fixed left-1/2 top-1/2 z-[201] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-signal bg-ink px-6 py-10 text-center text-bone sm:px-12"
        onCloseAutoFocus={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
        aria-describedby="experience-description"
      >
        <Dialog.Title className="font-display text-4xl font-bold uppercase text-signal sm:text-5xl">Choose your experience</Dialog.Title>
        <Dialog.Description id="experience-description" className="mt-6 text-sm leading-relaxed text-muted-foreground">
          This site includes high-contrast effects and 3D motion. Safe mode keeps browsing calm. Glitch effects may trigger photosensitive seizures.
          {reduced && ' Your reduced-motion preference is active; safe mode will remain enabled.'}
        </Dialog.Description>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <button type="button" onClick={() => choose('safe')} className="bracket bg-signal px-5 py-3 monofont text-xs uppercase tracking-widest text-ink">Use safe mode</button>
          <button type="button" disabled={reduced} onClick={() => choose('glitch')} className="bracket border border-signal px-5 py-3 monofont text-xs uppercase tracking-widest text-signal disabled:opacity-40">Enable glitch effect</button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Escape selects safe mode.</p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
