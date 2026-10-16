'use client';

import { useCalmMotion } from '@/components/cyber/experience-gate';

import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { GlitchText, Marquee, TickRuler } from '@/components/cyber/primitives';

const SharinganEye = dynamic(() => import('@/components/cyber/sharingan').then((m) => m.SharinganEye), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center monofont text-[10px] uppercase tracking-[0.3em] text-ink/60">
      opening eye…
    </div>
  ),
});

interface PersonalData {
  name: string;
  title: string;
  bio?: string;
  location?: string | null;
}

const TAGLINE = ['CYBERSEC.', 'PENTEST.', 'DEFEND.'];

const KEYWORD_STRIP = [
  'PENTEST',
  'REDACT',
  'FIREWALL',
  'PAYLOAD',
  'ZERO-DAY',
  'FOOTPRINT',
  'HARDEN',
  'ESCAPE',
  'PRIVESC',
  'ROOT',
  'SPECTRE',
  'PATCH',
];

const BOOT_LOG = [
  'handshake ........ ok',
  'tls 1.3 / x25519 .. ok',
  'ids signatures .... synced',
  'honeypots ......... armed',
];

const TICKER = 'Signals from the digital trenches · security through obscurity is not security · identity verified terminal';

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

export function HeroSection({ personalData }: { personalData: PersonalData | null }) {
  const name = personalData?.name || 'Bikram Dey';
  const title = personalData?.title || 'Cybersecurity Analyst & Penetration Tester';
  const bio = personalData?.bio;
  const location = personalData?.location?.trim();
  const [first, last] = splitName(name.toUpperCase());
  const letters = (first + last).length || 1;
  // fit the name to the viewport width regardless of its length
  const fontSize = `min(${(152 / letters).toFixed(2)}vw, 15rem)`;

  const ref = useRef<HTMLElement>(null);
  const reduce = useCalmMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const nameY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120]);
  const nameSkew = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -6]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 80]);
  // the dossier parallax only makes sense in the 3-column desktop layout
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <section id="hero" ref={ref} className="on-red relative overflow-hidden bg-signal pt-16 text-ink">
      <div aria-hidden className="grid-cross-ink pointer-events-none absolute inset-0 opacity-70" />

      <div className="relative mx-auto max-w-[1440px] px-3 sm:px-5">
        {/* coordinates row */}
        <div className="flex items-center justify-between border-b border-ink/60 py-3 monofont text-[10px] uppercase tracking-[0.3em]">
          <span>{location ? `LOC // ${location}` : '10.85° N / 78.69° E'}</span>
          <span className="hidden sm:inline">{'// operator profile · v2.0.0-rc.1'}</span>
          <span>{location ? 'ONLINE' : 'India'}</span>
        </div>

        {/* giant name */}
        <motion.h1
          style={{ y: nameY, skewY: nameSkew, fontSize }}
          className="relative select-none whitespace-nowrap py-2 font-display font-bold uppercase leading-[0.85] tracking-[-0.02em]"
          aria-label={name}
        >
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 60, rotateX: -60 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
            style={{ transformPerspective: 800 }}
          >
            <GlitchText text={first} />
          </motion.span>
          {last && (
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 60, rotateX: -60 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 1.1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="text-outline-ink inline-block"
              style={{ transformPerspective: 800, WebkitTextStrokeWidth: '2px' }}
            >
              {last}
            </motion.span>
          )}
        </motion.h1>

        {/* hairline grid */}
        <div className="grid border-t border-ink/60 lg:grid-cols-[1.15fr_1fr_1.25fr]">
          {/* tagline stack */}
          <div className="border-ink/60 lg:border-r">
            {TAGLINE.map((line, i) => (
              <motion.div
                key={line}
                initial={reduce ? false : { opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-ink/60 px-3 py-2 font-display text-5xl font-bold uppercase leading-none sm:text-6xl xl:text-7xl"
              >
                {line}
              </motion.div>
            ))}
            <div className="flex flex-wrap items-center gap-6 px-3 py-6">
              <a
                href="#vapt"
                className="bracket bg-ink/15 px-5 py-3 monofont text-xs uppercase tracking-[0.2em] transition-colors hover:bg-ink hover:text-signal"
              >
                &gt;_REQUEST_VAPT
              </a>
              <a
                href="#bounty"
                className="monofont text-xs uppercase tracking-[0.2em] underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
              >
                bug_bounty()
              </a>
              <a
                href="#contact"
                className="monofont text-xs uppercase tracking-[0.2em] underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
              >
                open_channel()
              </a>
            </div>
            <ul aria-hidden className="hidden space-y-1 border-t border-ink/60 px-3 py-4 monofont text-[10px] uppercase tracking-[0.2em] text-ink/70 lg:block">
              {BOOT_LOG.map((l, i) => (
                <motion.li
                  key={l}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.25 }}
                >
                  <span className="mr-2 text-ink">[{String(i).padStart(2, '0')}]</span>
                  {l}
                </motion.li>
              ))}
              <li className="text-ink">
                &gt; awaiting input<span className="animate-blink">_</span>
              </li>
            </ul>
          </div>

          {/* dossier */}
          <motion.div style={wide ? { y: panelY } : undefined} className="flex flex-col justify-end border-b border-ink/60 lg:border-b-0 lg:border-r">
            <div className="border-b border-ink/60 px-4 py-3 monofont text-[10px] uppercase tracking-[0.3em]">
              {'// designation'}
            </div>
            <div className="flex-1 px-4 py-5">
              <p className="font-display text-2xl font-semibold uppercase leading-tight">{title}</p>
              {bio && <p className="mt-4 line-clamp-6 text-sm font-medium leading-relaxed text-ink/80">{bio}</p>}
            </div>
            <div className="grid grid-cols-3 border-t border-ink/60 monofont text-[10px] uppercase tracking-widest">
              {[
                ['status', 'online'],
                ['clearance', 'lvl-5'],
                ['uplink', 'secure'],
              ].map(([k, v]) => (
                <div key={k} className="border-r border-ink/60 px-3 py-3 last:border-r-0">
                  <div className="opacity-60">{k}</div>
                  <div className="mt-1 font-bold">{v}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* 3D core */}
          <div className="relative flex min-h-[420px] flex-col lg:min-h-[560px]">
            <span className="absolute left-3 top-3 z-10 monofont text-[10px] uppercase tracking-[0.3em]">
              [<span className="font-jp">写輪眼</span>{' // sharingan]'}
            </span>
            <span aria-hidden className="absolute right-3 top-3 z-10 font-jp text-xs">
              監視中 · watching
            </span>
            <SharinganEye className="absolute inset-0" />
            <span className="pointer-events-none absolute bottom-14 left-3 z-10 monofont text-[10px] uppercase tracking-[0.3em] text-ink/70">
              [ tap the eye · <span className="font-jp">万華鏡</span> ]
            </span>
            <div className="relative mt-auto px-6 pb-4 text-ink">
              <TickRuler label="|||" />
            </div>
          </div>
        </div>
      </div>

      {/* keyword marquee band */}
      <div className="relative border-y border-ink bg-ink py-3 text-bone">
        <Marquee
          items={KEYWORD_STRIP}
          itemClassName="font-display text-lg font-semibold uppercase tracking-[0.25em]"
          separator="×"
        />
      </div>
      <div className="relative border-b border-ink/60 py-2 text-ink">
        <Marquee items={[TICKER, TICKER]} reverse itemClassName="monofont text-[10px] uppercase tracking-[0.3em]" />
      </div>
    </section>
  );
}
