/**
 * StatCard.tsx
 * Animated statistic display card with count-up animation.
 * Used in all dashboard overview pages.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { scrollRevealVariants, scrollViewport } from '@/shared/constants/motion';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color?: string;
  suffix?: string;
  delay?: number;
}

function useCountUp(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'var(--ember-orange)',
  suffix = '',
  delay = 0,
}: StatCardProps) {
  const count = useCountUp(value, 1200);

  return (
    <motion.div
      variants={scrollRevealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={scrollViewport}
      transition={{ delay }}
      className="rounded-2xl border p-6 flex items-start gap-4"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p
          className="text-2xl font-headline font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {count.toLocaleString()}{suffix}
        </p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </p>
      </div>
    </motion.div>
  );
}
