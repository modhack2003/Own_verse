import Link from 'next/link';
import { Terminal, Shield } from 'lucide-react';
import type { ReactNode } from 'react';

export const shadowMetadata = { title: 'Restricted terminal | Bikram Dey', robots: { index: false, follow: false } };

export function ShadowShell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <main id="main-content" tabIndex={-1} className="grid-cross relative min-h-[85vh] bg-ink px-4 py-12 sm:px-8 sm:py-16">
      <header className="mx-auto mb-10 flex max-w-4xl items-center justify-between gap-4 border-b border-signal/30 pb-4">
        <Link href="/" className="flex items-center gap-2 monofont text-xs text-muted-foreground transition-colors hover:text-cyan"><Terminal size={16} /> /home</Link>
        <span className="flex items-center gap-2 monofont text-[10px] uppercase tracking-[0.2em] text-signal"><Shield size={14} /> {label}</span>
      </header>
      <div className="mx-auto max-w-4xl">{children}</div>
      <footer className="mx-auto mt-8 flex max-w-4xl justify-between gap-4 monofont text-[10px] uppercase tracking-widest text-muted-foreground"><span>境界 // perimeter terminal</span><span>signal encrypted</span></footer>
    </main>
  );
}
