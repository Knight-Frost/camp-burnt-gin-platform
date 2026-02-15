import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function HeroSection() {
  const { isDark } = useTheme();

  const scrollToContent = () => {
    const aboutSection = document.getElementById('mission');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center px-6 py-32"
    >
      {!isDark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-full max-w-6xl rounded-3xl bg-glass-overlay px-12 py-24 shadow-hero-panel" />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1
            className="font-headline mb-10 text-[clamp(2.75rem,8vw,5rem)] dark:text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[1.1] tracking-tight"
          >
            Belonging Isn't a Promise—
            <br />
            <span className="mt-3 inline-block">It's the Foundation</span>
          </h1>
        </motion.div>

        <motion.p
          className="font-body mx-auto mb-14 max-w-3xl text-[1.5rem] dark:text-[1.375rem] leading-[1.7] font-medium dark:font-normal text-text-overlay-dark dark:text-text-overlay-light"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Camp Burnt Gin creates transformative summer experiences for children and young
          adults with special health care needs—built on care, joy, growth, and lifelong
          connection.
        </motion.p>

        <motion.div
          className="flex flex-col justify-center gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link
              to="/apply"
              className={`
                group inline-flex items-center justify-center gap-2 rounded-full px-10 py-5
                text-[1.125rem] font-semibold text-white transition-all duration-button
                ${isDark
                  ? 'bg-overlay-primary shadow-ember-primary border border-border-ember backdrop-blur-glass'
                  : 'bg-overlay-light shadow-light-button-primary border border-button-border-dark'
                }
              `}
            >
              Apply Now
              <ArrowRight className="h-5 w-5 transition-transform duration-button group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <button
              onClick={scrollToContent}
              className={`
                inline-flex items-center justify-center rounded-full px-10 py-5
                text-[1.125rem] font-semibold transition-all duration-button
                ${isDark
                  ? 'bg-overlay-secondary text-glass-dark-strong shadow-ember-secondary border border-border-glass backdrop-blur-glass'
                  : 'bg-glass-strong text-foreground shadow-light-button-secondary border border-button-border-light'
                }
              `}
            >
              Learn More
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
