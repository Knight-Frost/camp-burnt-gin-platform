import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const storiesImage =
  'https://images.unsplash.com/photo-1606456075288-cd0617384dc5?w=800&q=80';

const testimonials = [
  {
    quote:
      'Camp Burnt Gin gave my daughter confidence I never imagined possible. She came home beaming, talking about her new friends and all the things she accomplished. It\'s been truly transformative.',
    author: 'Sarah M.',
    role: 'Parent of camper, age 12',
  },
  {
    quote:
      "As a volunteer counselor, I've witnessed the magic of this place firsthand. The joy on campers' faces, the friendships formed, the barriers broken down – it's changed my life as much as theirs.",
    author: 'Marcus T.',
    role: 'Returning volunteer',
  },
  {
    quote:
      'The medical staff went above and beyond to make sure my son felt safe and cared for. They knew his needs inside and out, and we never worried for a moment. He cannot wait to go back.',
    author: 'Jennifer L.',
    role: 'Parent of camper, age 9',
  },
  {
    quote:
      "I've been going to Camp Burnt Gin for five years. It's where I feel most like myself. My camp friends understand me, and the counselors make everything fun. It's my favorite place in the world.",
    author: 'Alex R.',
    role: 'Camper, age 16',
  },
  {
    quote:
      'Camp Burnt Gin creates an environment where every child belongs. The adaptive programming is seamless, the care is exceptional, and the atmosphere is filled with pure joy.',
    author: 'Dr. Patricia K.',
    role: 'Consulting physician',
  },
  {
    quote:
      'Watching my brother sing at the talent show, surrounded by cheering friends, brought tears to my eyes. Camp gave him a place to shine, and our family is forever grateful.',
    author: 'Emily S.',
    role: 'Sibling of camper',
  },
];

const cardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

export function StoriesPage() {
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
            Stories from Our Community
          </h1>
          <p className="text-xl opacity-80 leading-relaxed max-w-3xl mx-auto">
            The heart of Camp Burnt Gin is our community – campers, families,
            staff, and volunteers who make this place special.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className="p-8 rounded-2xl backdrop-blur-md"
              style={cardStyle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 0.3 + index * 0.08,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <Quote
                className="w-10 h-10 mb-6"
                style={{ color: '#fbbf24', opacity: 0.6 }}
              />
              <p className="text-lg leading-relaxed mb-6 opacity-90">
                {testimonial.quote}
              </p>
              <div className="border-t border-white/10 pt-4">
                <p className="font-medium">{testimonial.author}</p>
                <p className="text-sm opacity-70 mt-1">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-20 rounded-3xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true }}
          style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' }}
        >
          <img
            src={storiesImage}
            alt="Happy campers playing outdoors"
            className="w-full h-auto"
          />
        </motion.div>

        <motion.div
          className="mt-20 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl mb-6">Share Your Story</h2>
          <p className="text-lg opacity-80 leading-relaxed max-w-2xl mx-auto">
            If Camp Burnt Gin has touched your life, we'd love to hear from you.
            Your experiences help others understand the impact of this special
            place.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
