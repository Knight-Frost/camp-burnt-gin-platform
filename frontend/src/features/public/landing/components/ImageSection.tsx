import { motion } from 'framer-motion';
import { useInView } from '../hooks/useInView';

export function ImageSection() {
  const { ref, inView } = useInView(0.2);

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="px-6 py-32">
      <motion.div
        className="mx-auto max-w-4xl overflow-hidden rounded-3xl shadow-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img
          src="https://images.unsplash.com/photo-1701834951900-b31c99da66f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwa2lkcyUyMGdyb3VwJTIwc21pbGluZyUyMGhhcHB5fGVufDF8fHx8MTc3MDM0MTkyMXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Happy campers at Camp Burnt Gin"
          className="h-auto w-full"
          loading="lazy"
        />
      </motion.div>
    </section>
  );
}
