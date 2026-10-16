'use client';

import { useCalmMotion } from '@/components/cyber/experience-gate';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/** Red field with an ink circle that expands as the section scrolls into view. */
export function ScrollCircle({ children, id }: { children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useCalmMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start start'] });
  const radius = useTransform(scrollYProgress, [0, 1], reduce ? ['76%', '76%'] : ['16%', '76%']);
  const clip = useTransform(radius, (r) => `circle(${r} at 50% 50%)`);

  return (
    <div id={id} ref={ref} className="relative scroll-mt-16 overflow-hidden bg-signal">
      <motion.div style={{ clipPath: clip }} className="relative bg-ink">
        {children}
      </motion.div>
    </div>
  );
}
