import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { FAQ_ITEMS } from '../config/faq.config';
import { useInView } from '../hooks/useInView';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { ref, inView } = useInView(0.2);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" ref={ref as React.RefObject<HTMLElement>} className="px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.15em] text-warm-amber">
            Questions & Answers
          </p>
          <h2 className="font-headline mb-6 text-[clamp(2.25rem,5vw,3rem)] font-bold leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="font-body mx-auto max-w-2xl text-[1.125rem] leading-relaxed opacity-75">
            Everything you need to know before getting started
          </p>
        </motion.div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {FAQ_ITEMS.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.8,
                delay: 0.05 * index,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <motion.button
                onClick={() => toggleFAQ(index)}
                className={`
                  w-full rounded-2xl p-6 text-left backdrop-blur-glass transition-all duration-button md:p-8
                  border border-white/10
                  ${openIndex === index
                    ? 'bg-white/12 shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'bg-white/6 shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
                  }
                `}
                whileHover={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  boxShadow:
                    '0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.12)',
                }}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-body pr-4 text-[1.125rem] font-semibold leading-relaxed text-white/95 md:text-xl">
                    {faq.question}
                  </h3>
                  <motion.div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-glass-icon-bg text-warm-amber"
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    {openIndex === index ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </motion.div>
                </div>

                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.4,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                      style={{ overflow: 'hidden' } as React.CSSProperties}
                    >
                      <div className="mt-6 border-t border-white/10 pt-6">
                        <p className="font-body text-base leading-relaxed text-white/70 md:text-lg">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="font-body text-[1.125rem] leading-relaxed opacity-65">
            Still have questions? You can start an application and save your progress anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
