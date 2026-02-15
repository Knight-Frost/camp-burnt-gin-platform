import { useEffect, useState, useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { AmbientParticles } from './AmbientParticles';

const campImages = [
  'https://images.unsplash.com/photo-1699811250891-1366dc5701d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1wZmlyZSUyMG5pZ2h0JTIwa2lkcyUyMGNpcmNsZSUyMHRvZ2V0aGVyfGVufDF8fHx8MTc3MDM0NTU2Mnww&ixlib=rb-4.1.0&q=80&w=1080',
  'https://images.unsplash.com/photo-1625705791861-6d729eef7597?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW1tZXIlMjBjYW1wJTIwY2FtcGZpcmUlMjBldmVuaW5nJTIwa2lkc3xlbnwxfHx8fDE3NzAzNDM5MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
  'https://images.unsplash.com/photo-1615909340810-3ec0e50f9e4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRzJTIwY3JhZnRzJTIwY2hpbGRyZW4lMjBtYWtpbmclMjBwYWludGluZ3xlbnwxfHx8fDE3NzAzNDQwNTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
  'https://images.unsplash.com/photo-1701834951900-b31c99da66f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwa2lkcyUyMGdyb3VwJTIwc21pbGluZyUyMGhhcHB5fGVufDF8fHx8MTc3MDM0MTkyMXww&ixlib=rb-4.1.0&q=80&w=1080',
];

function interpolateColor(color1: number[], color2: number[], factor: number): number[] {
  return color1.map((c1, i) => {
    const c2 = color2[i];
    return Math.round(c1 + (c2 - c1) * factor);
  });
}

export function LivingBackground() {
  const { isDark } = useTheme();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [previousImageIndex, setPreviousImageIndex] = useState(0);
  const [gradientPhase, setGradientPhase] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { scrollYProgress } = useScroll();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const imageInterval = setInterval(() => {
      setPreviousImageIndex(currentImageIndex);
      setCurrentImageIndex((prev) => (prev + 1) % campImages.length);
    }, 12000);

    return () => clearInterval(imageInterval);
  }, [currentImageIndex, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let animationFrame: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      setGradientPhase((elapsed / 40000) % 1);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [prefersReducedMotion]);

  const imageY = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? ['0%', '0%'] : ['0%', '15%']
  );
  const gradientY = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? ['0%', '0%'] : ['0%', '8%']
  );

  // Memoize expensive gradient color calculations to improve performance
  const gradientColors = useMemo(() => {
    const scrollProgress = scrollYProgress.get() || 0;
    const timePhase = prefersReducedMotion ? 0 : gradientPhase;

    if (isDark) {
      const color1 = interpolateColor(
        interpolateColor([0, 0, 0], [5, 8, 12], scrollProgress),
        interpolateColor([8, 5, 5], [12, 8, 6], scrollProgress),
        timePhase
      );
      const color2 = interpolateColor(
        interpolateColor([0, 0, 0], [8, 12, 18], scrollProgress),
        interpolateColor([10, 8, 8], [15, 12, 10], scrollProgress),
        timePhase
      );
      const color3 = interpolateColor(
        interpolateColor([5, 5, 5], [12, 15, 22], scrollProgress),
        interpolateColor([10, 10, 12], [18, 20, 28], scrollProgress),
        (timePhase + 0.5) % 1
      );

      return {
        color1: `rgb(${color1.join(',')})`,
        color2: `rgb(${color2.join(',')})`,
        color3: `rgb(${color3.join(',')})`,
      };
    } else {
      const color1 = interpolateColor(
        interpolateColor([235, 220, 195], [195, 165, 130], scrollProgress),
        interpolateColor([220, 190, 155], [175, 140, 105], scrollProgress),
        timePhase
      );
      const color2 = interpolateColor(
        interpolateColor([245, 230, 205], [210, 180, 145], scrollProgress),
        interpolateColor([230, 200, 165], [190, 155, 120], scrollProgress),
        timePhase
      );
      const color3 = interpolateColor(
        interpolateColor([250, 235, 210], [205, 175, 140], scrollProgress),
        interpolateColor([225, 200, 170], [180, 150, 115], scrollProgress),
        (timePhase + 0.5) % 1
      );

      return {
        color1: `rgb(${color1.join(',')})`,
        color2: `rgb(${color2.join(',')})`,
        color3: `rgb(${color3.join(',')})`,
      };
    }
  }, [gradientPhase, isDark, prefersReducedMotion, scrollYProgress]);

  const { color1, color2, color3 } = gradientColors;

  const imageOpacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    isDark ? [0.45, 0.5, 0.55, 0.6] : [0.08, 0.1, 0.12, 0.14]
  );

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        style={{ y: gradientY }}
        animate={
          prefersReducedMotion
            ? {}
            : {
                background: `radial-gradient(ellipse at ${20 + gradientPhase * 30}% ${
                  30 + gradientPhase * 40
                }%, ${color1}, ${color2}, ${color3})`,
              }
        }
        transition={{
          duration: 8,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />

      {!isMobile && (
        <motion.div className="absolute inset-0" style={{ opacity: imageOpacity } as any}>
          <motion.div
            key={`prev-${previousImageIndex}`}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${campImages[previousImageIndex]})`,
              y: imageY,
            } as any}
            initial={{ opacity: 1 }}
            animate={{ opacity: prefersReducedMotion ? 1 : 0 }}
            transition={{
              duration: 2.2,
              ease: [0.4, 0, 0.2, 1],
            }}
          />

          <motion.div
            key={`current-${currentImageIndex}`}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${campImages[currentImageIndex]})`,
              y: imageY,
            } as any}
            initial={{ opacity: 0 }}
            animate={{ opacity: prefersReducedMotion ? 0 : 1 }}
            transition={{
              duration: 2.2,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </motion.div>
      )}

      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
        }}
      />

      {!prefersReducedMotion && <AmbientParticles />}

      <motion.div
        className="absolute inset-0"
        animate={{
          background: isDark
            ? 'radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.6) 100%)'
            : 'radial-gradient(circle at center, transparent 0%, rgba(90, 74, 56, 0.15) 100%)',
        }}
        transition={{
          duration: 2,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />
    </div>
  );
}
