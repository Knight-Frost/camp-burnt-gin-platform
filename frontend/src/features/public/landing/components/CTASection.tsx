import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useInView } from '../hooks/useInView';
import { useTheme } from '../hooks/useTheme';

export function CTASection() {
  const { ref, inView } = useInView(0.2);
  const { isDark } = useTheme();

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="px-6 py-32">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h2 className="font-headline mb-8 text-[clamp(2.25rem,5vw,3rem)] font-bold leading-tight">
            Ready to Create
            <br />
            Unforgettable Memories?
          </h2>
          <p className="font-body mb-12 text-base leading-relaxed opacity-80">
            Join our community and discover what makes Camp Burnt Gin special.
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link
              to="/register"
              className={`
                inline-flex items-center gap-2 rounded-full px-10 py-5
                text-[1.125rem] font-semibold text-white transition-all duration-button
                ${isDark
                  ? 'bg-overlay-primary shadow-ember-primary border border-border-ember backdrop-blur-glass'
                  : 'bg-overlay-light shadow-light-button-primary border border-button-border-dark'
                }
              `}
            >
              Start Your Journey
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
