import { motion } from 'framer-motion';
import { Heart, Sparkles, Users } from 'lucide-react';
import { useInView } from '../hooks/useInView';
import { useTheme } from '../hooks/useTheme';

const VALUES = [
  {
    icon: Heart,
    title: 'Inclusive Care',
    description:
      'Expert medical staff providing compassionate 24/7 care tailored to each camper\'s unique needs.',
  },
  {
    icon: Sparkles,
    title: 'Joyful Experiences',
    description:
      'From arts and nature to sports and music, every activity is designed for growth and pure joy.',
  },
  {
    icon: Users,
    title: 'Lasting Community',
    description:
      'Building friendships and connections that extend far beyond the summer months.',
  },
];

export function MissionSection() {
  const { ref, inView } = useInView(0.2);
  const { isDark } = useTheme();

  return (
    <section id="mission" ref={ref as React.RefObject<HTMLElement>} className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="grid gap-12 md:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {VALUES.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={value.title}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 1,
                  delay: index * 0.15,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <motion.div
                  className={`
                    mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full backdrop-blur-xl
                    ${isDark
                      ? 'bg-glass-icon-bg shadow-amber-glow'
                      : 'bg-glass-mission-bg shadow-light-icon'
                    }
                  `}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Icon className={`h-8 w-8 ${isDark ? 'text-warm-amber' : ''}`} />
                </motion.div>
                <h3 className="font-headline mb-4 text-lg font-bold">
                  {value.title}
                </h3>
                <p className="font-body leading-relaxed opacity-80">
                  {value.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
