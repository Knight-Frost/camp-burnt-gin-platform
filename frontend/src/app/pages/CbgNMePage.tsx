import { motion } from 'framer-motion';
import { Video, Music, BookOpen, Gamepad2 } from 'lucide-react';

const features = [
  {
    icon: Video,
    title: 'Virtual Gatherings',
    description:
      'Join live video sessions with camp friends and counselors for games, activities, and connection.',
  },
  {
    icon: Music,
    title: 'Online Activities',
    description:
      'Participate in music, art, storytelling, and other engaging programs from home.',
  },
  {
    icon: BookOpen,
    title: 'Resource Library',
    description:
      'Access activities, crafts, and educational materials designed for all abilities.',
  },
  {
    icon: Gamepad2,
    title: 'Interactive Games',
    description:
      'Play accessible online games and challenges with the camp community.',
  },
];

const cardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const iconContainerStyle = {
  backgroundColor: 'rgba(251, 191, 36, 0.2)',
};

export function CbgNMePage() {
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-16 text-center"
        >
          <h1 className="text-5xl md:text-6xl mb-8 leading-tight">
            CBG 'n Me
          </h1>
          <p className="text-xl opacity-80 leading-relaxed max-w-3xl mx-auto">
            Our virtual program brings the spirit of Camp Burnt Gin to you –
            wherever you are, whenever you need it.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8 mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="p-8 rounded-2xl backdrop-blur-md"
              style={cardStyle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 0.3 + index * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-6"
                style={iconContainerStyle}
              >
                <feature.icon
                  className="w-7 h-7"
                  style={{ color: '#fbbf24' }}
                />
              </div>
              <h3 className="text-2xl mb-3">{feature.title}</h3>
              <p className="leading-relaxed opacity-80">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true }}
        >
          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-3xl mb-6">Keeping Camp Alive Year-Round</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                CBG 'n Me was created to extend the camp experience beyond the
                summer months and reach families who may not be able to attend
                in-person sessions. Through accessible online programming, we
                maintain connections, provide enrichment, and bring joy to our
                community.
              </p>
              <p>
                All virtual programs are designed with the same care and
                inclusivity as our in-person camp, ensuring every participant
                can engage meaningfully regardless of their abilities or
                technology access.
              </p>
            </div>
          </section>

          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-3xl mb-6">Who Can Participate?</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                CBG 'n Me is open to current and former campers, as well as
                families who are interested in the Camp Burnt Gin community. All
                programs are free and designed to be accessible to participants
                with diverse abilities.
              </p>
              <p>
                Whether you're waiting for your first summer at camp, staying
                connected between sessions, or simply looking for inclusive
                online programming, you're welcome here.
              </p>
            </div>
          </section>

          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-3xl mb-6">Getting Started</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                Joining CBG 'n Me is simple. Register on our website to receive
                the virtual program schedule, access codes for live sessions,
                and links to our resource library.
              </p>
              <p>
                Sessions are designed to accommodate different time zones,
                schedules, and comfort levels. You can participate live or
                access recorded content at your convenience.
              </p>
            </div>
          </section>

          <div className="text-center pt-8">
            <h2 className="text-2xl mb-4">Join CBG 'n Me Today</h2>
            <p className="opacity-80 mb-8 max-w-2xl mx-auto">
              Experience the warmth and community of Camp Burnt Gin from
              wherever you are. Registration is free and open to all.
            </p>
            <button
              className="px-10 py-5 rounded-full backdrop-blur-md text-lg transition-all duration-500 hover:scale-105"
              style={{
                backgroundColor: 'rgba(244, 114, 66, 0.2)',
                border: '1px solid rgba(244, 114, 66, 0.4)',
                boxShadow:
                  '0 8px 32px rgba(244, 114, 66, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              Register Now
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
