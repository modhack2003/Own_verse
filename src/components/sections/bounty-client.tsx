'use client';

import { useCalmMotion } from '@/components/cyber/experience-gate';

import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Award, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/cyber/primitives';
import { SEVERITIES, formatMoney, type PublicFinding, type Severity } from '@/lib/bounty';

export const SEVERITY_STYLE: Record<Severity, { badge: string; bar: string }> = {
  critical: { badge: 'bg-signal text-ink shadow-[0_0_18px_hsl(var(--red)/0.55)]', bar: 'bg-signal' },
  high: { badge: 'bg-destructive text-ink', bar: 'bg-destructive' },
  medium: { badge: 'bg-amber-400 text-ink', bar: 'bg-amber-400' },
  low: { badge: 'bg-cyan text-ink', bar: 'bg-cyan' },
  info: { badge: 'border border-muted-foreground/50 text-muted-foreground', bar: 'bg-muted-foreground/60' },
};

const label = (s: Severity) => SEVERITIES.find((x) => x.id === s)?.label ?? s;

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 monofont text-[10px] font-bold uppercase tracking-[0.2em]', SEVERITY_STYLE[severity].badge)}>
      {label(severity)}
    </span>
  );
}

/** Segmented bar showing how many findings fall in each severity. */
export function SeverityBar({ bySeverity, total }: { bySeverity: Record<Severity, number>; total: number }) {
  const reduce = useCalmMotion();
  const present = SEVERITIES.filter((s) => bySeverity[s.id] > 0);
  if (!total) return null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between monofont text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        <span className="text-signal">{'// severity_distribution'}</span>
        <span>{total} total</span>
      </div>
      <div className="flex h-4 w-full gap-[3px] overflow-hidden" role="img" aria-label={present.map((s) => `${bySeverity[s.id]} ${s.label}`).join(', ')}>
        {present.map((s, i) => (
          <motion.span
            key={s.id}
            className={cn('h-full origin-left', SEVERITY_STYLE[s.id].bar)}
            style={{ width: `${(bySeverity[s.id] / total) * 100}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {SEVERITIES.map((s) => (
          <li key={s.id} className={cn('flex items-center gap-2 monofont text-[11px] uppercase tracking-[0.2em]', bySeverity[s.id] ? 'text-bone' : 'text-muted-foreground/50')}>
            <span aria-hidden className={cn('h-2.5 w-2.5', SEVERITY_STYLE[s.id].bar)} />
            {s.label}
            <span className="text-muted-foreground">{String(bySeverity[s.id]).padStart(2, '0')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const INITIAL = 6;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;

function Redacted() {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-block h-2.5 w-14 bg-bone/80" />
      <span>redacted</span>
    </span>
  );
}

export function FindingsList({ findings }: { findings: PublicFinding[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? findings : findings.slice(0, INITIAL);

  return (
    <div>
      <ol className="border-t border-signal/40">
        {visible.map((f, i) => (
          <Reveal as="li" key={f.id} delay={(i % INITIAL) * 0.05} rotateX={24}>
            <article className="group grid gap-x-6 gap-y-3 border-b border-signal/40 py-6 pl-3 transition-colors duration-500 hover:bg-signal/5 md:grid-cols-[150px_1fr_auto] md:items-center">
              <div className="flex items-center gap-3 md:block">
                <SeverityBadge severity={f.severity} />
                {fmtDate(f.date) && (
                  <p className="monofont text-[10px] uppercase tracking-[0.3em] text-muted-foreground md:mt-3">{fmtDate(f.date)}</p>
                )}
              </div>

              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 monofont text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {f.privateProgram ? (
                    <span aria-label="Private program">
                      <Redacted />
                    </span>
                  ) : (
                    <span className="text-bone/90">{f.program}</span>
                  )}
                  {f.platform && <span>· {f.platform}</span>}
                  {f.vulnType && <span className="text-signal">· {f.vulnType}</span>}
                </p>
                <h3 className="mt-2 font-display text-xl font-bold uppercase leading-tight text-bone sm:text-2xl">{f.title}</h3>
                {f.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{f.description}</p>}
                {(f.cve || f.hallOfFame || f.privateProgram) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {f.cve && (
                      <span className="inline-flex items-center gap-1 border border-cyan/50 px-2 py-0.5 monofont text-[10px] uppercase tracking-wider text-cyan">
                        <ShieldAlert className="h-3 w-3" /> {f.cve}
                      </span>
                    )}
                    {f.hallOfFame && (
                      <span className="inline-flex items-center gap-1 border border-signal/50 px-2 py-0.5 monofont text-[10px] uppercase tracking-wider text-signal">
                        <Award className="h-3 w-3" /> hall of fame
                      </span>
                    )}
                    {f.privateProgram && (
                      <span className="border border-muted-foreground/40 px-2 py-0.5 monofont text-[10px] uppercase tracking-wider text-muted-foreground">
                        private program
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-5 md:flex-col md:items-end md:pr-3">
                {f.bounty != null && f.bounty > 0 && (
                  <span className="font-display text-2xl font-bold text-signal">{formatMoney(f.bounty, f.currency)}</span>
                )}
                {f.link && (
                  <a
                    href={f.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 monofont text-[11px] uppercase tracking-[0.2em] text-bone/80 underline decoration-signal/40 underline-offset-4 hover:text-signal"
                  >
                    report <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </ol>

      {findings.length > INITIAL && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="bracket bg-signal/10 px-6 py-3 monofont text-xs uppercase tracking-[0.2em] text-signal transition-colors hover:bg-signal hover:text-ink"
          >
            {showAll ? 'Show fewer' : `Show all ${findings.length} findings (+${findings.length - INITIAL})`}
          </button>
        </div>
      )}
    </div>
  );
}
