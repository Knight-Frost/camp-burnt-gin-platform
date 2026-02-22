import { motion } from 'framer-motion';
import { Palette, Music, TreePine, Activity, Waves, Sparkles } from 'lucide-react';

const programs = [
  {
    icon: Palette,
    title: 'Arts & Creativity',
    description:
      'Express yourself through painting, crafts, drama, and creative projects designed for all abilities.',
  },
  {
    icon: Music,
    title: 'Music & Performance',
    description:
      'Explore rhythm, song, and movement in our accessible music studio and outdoor performance spaces.',
  },
  {
    icon: TreePine,
    title: 'Nature Adventures',
    description:
      'Connect with the outdoors through adapted hiking, nature exploration, and environmental discovery.',
  },
  {
    icon: Waves,
    title: 'Aquatics',
    description:
      'Enjoy swimming, water games, and aqua therapy in our fully accessible pool with trained lifeguards.',
  },
  {
    icon: Activity,
    title: 'Sports & Recreation',
    description:
      'Participate in adaptive sports, games, and physical activities that celebrate every ability.',
  },
  {
    icon: Sparkles,
    title: 'Special Events',
    description:
      'Create magical memories at campfires, themed nights, talent shows, and camp-wide celebrations.',
  },
];

export function ProgramsPage() {
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-16"
        >
          <h1 className="text-5xl md:text-6xl mb-8 leading-tight">
            Programs & Activities
          </h1>
          <p className="text-xl opacity-80 leading-relaxed max-w-3xl">
            Every activity at Camp Burnt Gin is thoughtfully designed to be
            accessible, engaging, and joyful. Our diverse programs ensure every
            camper finds something they love.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8 mb-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {programs.map((program, index) => (
            <motion.div
              key={program.title}
              className="p-8 rounded-2xl backdrop-blur-md"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3 + index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-6"
                style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)' }}
              >
                <program.icon className="w-7 h-7" style={{ color: '#fbbf24' }} />
              </div>
              <h3 className="text-2xl mb-3">{program.title}</h3>
              <p className="leading-relaxed opacity-80">{program.description}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="rounded-3xl overflow-hidden mb-16"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true }}
          style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' }}
        >
          <img
            src="https://images.unsplash.com/photo-1661965607220-d85c073a799b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRzJTIwY3JhZnRzJTIwY2hpbGRyZW4lMjBhY3Rpdml0eXxlbnwxfHx8fDE3NzAzNDE5MjJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Campers enjoying activities"
            className="w-full h-auto"
          />
        </motion.div>

        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl mb-6">A Typical Day at Camp</h2>
          <p className="text-lg opacity-80 leading-relaxed">
            Each day is carefully structured to balance activity and rest,
            adventure and reflection. Morning activities give way to restful
            afternoons, followed by evening programs and cherished campfire
            traditions. Every schedule is flexible to accommodate each camper's
            individual needs and energy levels.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
