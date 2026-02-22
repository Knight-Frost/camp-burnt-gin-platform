import { motion } from 'framer-motion';
import { HandHeart, Calendar, DollarSign, Share2 } from 'lucide-react';

const opportunities = [
  {
    icon: HandHeart,
    title: 'Volunteer',
    description:
      'Join our team as a counselor, activity leader, or support volunteer. No experience required – just a caring heart and willingness to make a difference.',
    action: 'Learn More',
  },
  {
    icon: DollarSign,
    title: 'Donate',
    description:
      'Your financial support helps provide scholarships, maintain facilities, and expand programs. Every contribution makes camp possible for more families.',
    action: 'Give Now',
  },
  {
    icon: Calendar,
    title: 'Attend Events',
    description:
      'Join us for fundraisers, reunions, and community gatherings throughout the year. Connect with our camp family and celebrate together.',
    action: 'See Calendar',
  },
  {
    icon: Share2,
    title: 'Spread the Word',
    description:
      'Help us reach more families by sharing information about Camp Burnt Gin with your community, healthcare providers, and schools.',
    action: 'Share Resources',
  },
];

const cardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const iconContainerStyle = {
  backgroundColor: 'rgba(251, 191, 36, 0.2)',
};

const actionButtonStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
};

export function GetInvolvedPage() {
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
            Get Involved
          </h1>
          <p className="text-xl opacity-80 leading-relaxed max-w-3xl mx-auto">
            Camp Burnt Gin thrives because of our community. There are many ways
            to support our mission and help create life-changing experiences.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8 mb-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {opportunities.map((opportunity, index) => (
            <motion.div
              key={opportunity.title}
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
                <opportunity.icon
                  className="w-7 h-7"
                  style={{ color: '#fbbf24' }}
                />
              </div>
              <h3 className="text-2xl mb-3">{opportunity.title}</h3>
              <p className="leading-relaxed opacity-80 mb-6">
                {opportunity.description}
              </p>
              <button
                className="px-6 py-3 rounded-full backdrop-blur-md transition-all duration-500 hover:scale-105"
                style={actionButtonStyle}
              >
                {opportunity.action}
              </button>
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
            <h2 className="text-3xl mb-6">Why Your Support Matters</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                Camp Burnt Gin operates as a nonprofit organization dedicated to
                providing accessible camp experiences regardless of a family's
                ability to pay. The majority of our campers receive financial
                assistance.
              </p>
              <p>
                Your involvement – whether through volunteering your time,
                contributing financially, or spreading awareness – directly
                impacts the number of children we can serve and the quality of
                programs we can offer.
              </p>
              <p>
                Every volunteer hour, every dollar donated, and every
                conversation about camp creates ripples of positive change in
                our community.
              </p>
            </div>
          </section>

          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-3xl mb-6">Join Our Family</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                Many of our volunteers and supporters are former campers,
                siblings, parents, and community members who have been touched
                by Camp Burnt Gin. They return year after year because they know
                the profound impact this place has.
              </p>
              <p>
                Whether you can give a few hours, a full summer, or ongoing
                support, you'll become part of a community dedicated to
                inclusion, joy, and transformative experiences.
              </p>
            </div>
          </section>

          <div className="text-center pt-8">
            <h2 className="text-2xl mb-4">Ready to Make a Difference?</h2>
            <p className="opacity-80 mb-8 max-w-2xl mx-auto">
              Connect with us to learn more about volunteer opportunities,
              fundraising events, and ways to support our mission.
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
              Contact Us
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
