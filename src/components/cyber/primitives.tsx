'use client';

import { useCalmMotion } from '@/components/cyber/experience-gate';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Reveal — 3D flip/blur-in when scrolled into view                            */
/* -------------------------------------------------------------------------- */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 40,
  rotateX = 18,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  rotateX?: number;
  as?: 'div' | 'li' | 'article' | 'section';
}) {
  const reduce = useCalmMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y, rotateX, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1000, transformOrigin: '50% 100%' }}
    >
      {children}
    </Comp>
  );
}

/* -------------------------------------------------------------------------- */
/* GlitchText — RGB split layers                                                */
/* -------------------------------------------------------------------------- */
export function GlitchText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <span aria-hidden className="glitch-layer absolute inset-0">
        {text}
      </span>
      <span aria-hidden className="glitch-layer glitch-layer-2 absolute inset-0">
        {text}
      </span>
      {text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* ScrambleText — decodes the real text when it enters the viewport            */
/* -------------------------------------------------------------------------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*<>/\\アカサタナハマヤラワ';

export function ScrambleText({
  text,
  className,
  as: Comp = 'span',
  speed = 28,
}: {
  text: string;
  className?: string;
  as?: ElementType;
  speed?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useCalmMotion();
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (!inView || reduce) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = text.length;
    const id = setInterval(() => {
      frame += 1;
      const revealed = Math.floor(frame / 2);
      setOut(
        text
          .split('')
          .map((ch, i) => {
            if (ch === ' ' || i < revealed) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join('')
      );
      if (revealed >= total) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [inView, text, reduce, speed]);

  return (
    <Comp ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </Comp>
  );
}

/* -------------------------------------------------------------------------- */
/* Marquee                                                                      */
/* -------------------------------------------------------------------------- */
export function Marquee({
  items,
  className,
  itemClassName,
  reverse = false,
  separator = '•',
  pixelsPerSecond,
}: {
  items: string[];
  className?: string;
  itemClassName?: string;
  reverse?: boolean;
  separator?: ReactNode;
  pixelsPerSecond?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !pixelsPerSecond || pixelsPerSecond <= 0) return;
    const measure = () => setDuration(track.scrollWidth / 2 / pixelsPerSecond);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [pixelsPerSecond, items]);
  const list = [...items, ...items];
  return (
    <div className={cn('relative overflow-hidden', pixelsPerSecond && 'marquee-container', className)}>
      <div ref={trackRef} style={pixelsPerSecond ? { animationDuration: duration ? `${duration}s` : undefined, animationPlayState: duration ? undefined : 'paused' } : undefined} className={cn('marquee-track flex w-max items-center whitespace-nowrap', reverse ? 'animate-marquee-rev' : 'animate-marquee')}>
        {list.map((item, i) => (
          <span key={`${item}-${i}`} className={cn('flex items-center gap-6 px-3', itemClassName)}>
            {item}
            <span aria-hidden className="text-signal">
              {separator}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TiltCard — pointer-driven 3D tilt with glare                                 */
/* -------------------------------------------------------------------------- */
export function TiltCard({
  children,
  className,
  max = 12,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useCalmMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 180, damping: 18 });
  const gx = useTransform(px, (v) => `${v * 100}%`);
  const gy = useTransform(py, (v) => `${v * 100}%`);
  const glareOpacity = useSpring(0, { stiffness: 200, damping: 25 });
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, hsl(var(--bone) / 0.18), transparent 55%)`;

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    glareOpacity.set(1);
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    glareOpacity.set(0);
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: 'preserve-3d' }}
      className={cn('relative will-change-transform', className)}
    >
      {children}
      {glare && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-20" style={{ background: glareBg, opacity: glareOpacity }} />
      )}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* BracketLink / BracketButton — [ LABEL ] with animated corners               */
/* -------------------------------------------------------------------------- */
export function BracketLink({
  href,
  children,
  className,
  external,
  tone = 'red',
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  tone?: 'red' | 'ink' | 'bone';
}) {
  const tones = {
    red: 'text-signal bg-signal/10 hover:bg-signal hover:text-ink',
    ink: 'text-ink bg-ink/10 hover:bg-ink hover:text-signal',
    bone: 'text-bone bg-bone/5 hover:bg-bone hover:text-ink',
  };
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        'bracket inline-flex items-center gap-2 px-5 py-3 monofont text-xs uppercase tracking-[0.2em] transition-colors duration-300',
        tones[tone],
        className
      )}
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionHeader — giant index, JP label, solid/outline split title            */
/* -------------------------------------------------------------------------- */
export function SectionHeader({
  id,
  index,
  eyebrow,
  title,
  subtitle,
  jp,
}: {
  id?: string;
  index: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  jp?: string;
}) {
  const words = title.split(' ');
  const head = words.slice(0, Math.max(1, words.length - 1)).join(' ');
  const tail = words.length > 1 ? words[words.length - 1] : '';

  return (
    <header id={id} className="relative scroll-mt-24 border-b border-signal/40 pb-8">
      <div className="mb-6 flex items-center justify-between monofont text-[10px] uppercase tracking-[0.35em] text-signal">
        <span className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 bg-signal" />
          {eyebrow}
        </span>
        <span className="text-muted-foreground">[{index}]</span>
      </div>
      <div className="relative">
        <Reveal className="pr-16 md:pr-28">
          <h2 className="font-display text-5xl font-bold uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
            <span className="text-bone">{head}</span>
            {tail && (
              <>
                {' '}
                <span className="text-outline-red">{tail}</span>
              </>
            )}
          </h2>
        </Reveal>
        {jp && (
          <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 hidden font-jp text-4xl font-black text-outline-red opacity-70 md:block lg:text-5xl [writing-mode:vertical-rl]">
            {jp}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Tick ruler — the measurement bar under the hero mask                         */
/* -------------------------------------------------------------------------- */
export function TickRuler({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('relative flex h-8 items-end justify-between', className)} aria-hidden>
      {Array.from({ length: 41 }).map((_, i) => (
        <span key={i} className={cn('w-px bg-current', i % 5 === 0 ? 'h-6' : 'h-3')} />
      ))}
      {label && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-ink px-3 py-1 monofont text-[10px] tracking-widest text-signal">
          {label}
        </span>
      )}
    </div>
  );
}
