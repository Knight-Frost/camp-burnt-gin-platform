import { motion } from 'framer-motion';

const campfireImage = 'https://images.unsplash.com/photo-1699811250891-1366dc5701d2?w=800&q=80';

export function AboutPage() {
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1 className="text-5xl md:text-6xl mb-12 leading-tight">
            Our Story
          </h1>
        </motion.div>

        <motion.div
          className="space-y-8 leading-relaxed text-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="opacity-90">
            For over three decades, Camp Burnt Gin has been a beacon of joy,
            growth, and belonging for children and young adults with special
            health care needs. Nestled in the natural beauty of the wilderness,
            our camp provides a safe, nurturing environment where every camper
            can thrive.
          </p>

          <p className="opacity-90">
            Founded on the belief that every child deserves the transformative
            experience of summer camp, we've created a program that combines
            expert medical care with authentic camp adventures. Our dedicated
            staff includes nurses, therapists, counselors, and volunteers who
            share a passion for making camp accessible to all.
          </p>

          <div className="py-12">
            <motion.div
              className="rounded-3xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
              viewport={{ once: true }}
              style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' }}
            >
              <img
                src={campfireImage}
                alt="Camp Burnt Gin grounds"
                className="w-full h-auto"
              />
            </motion.div>
          </div>

          <h2 className="text-3xl mt-16 mb-6">Our Mission</h2>
          <p className="opacity-90">
            We create life-changing experiences that empower campers to discover
            their strengths, build confidence, and form lasting friendships in a
            supportive, medically-supervised environment.
          </p>

          <h2 className="text-3xl mt-16 mb-6">Our Values</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl mb-2">Safety First</h3>
              <p className="opacity-80">
                Round-the-clock medical care and trained staff ensure every
                camper's health and wellbeing.
              </p>
            </div>
            <div>
              <h3 className="text-xl mb-2">Authentic Inclusion</h3>
              <p className="opacity-80">
                Every activity is designed to be accessible, engaging, and fun
                for campers of all abilities.
              </p>
            </div>
            <div>
              <h3 className="text-xl mb-2">Joyful Growth</h3>
              <p className="opacity-80">
                We believe in the power of play, nature, and community to help
                every camper flourish.
              </p>
            </div>
            <div>
              <h3 className="text-xl mb-2">Lasting Impact</h3>
              <p className="opacity-80">
                The friendships and confidence built at camp extend far beyond
                the summer.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
