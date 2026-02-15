import { motion } from 'framer-motion';
import { SESSIONS } from '../config/sessions.config';
import { SessionCard } from './SessionCard';
import { useInView } from '../hooks/useInView';

export function SessionsSection() {
  const { ref, inView } = useInView(0.2);

  return (
    <section
      id="sessions"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-neutral-50 px-6 py-32 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h2 className="font-headline text-xl font-bold">
            Summer 2026 Sessions
          </h2>
          <p className="font-body mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
            Choose the session that works best for your family. Each session offers the same
            exceptional program and care.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SESSIONS.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.8,
                delay: index * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <SessionCard session={session} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
