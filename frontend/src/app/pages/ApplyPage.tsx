import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle, FileText, Mail, Calendar, Clock } from 'lucide-react';

const steps = [
  {
    icon: FileText,
    title: 'Complete Application',
    description:
      "Fill out our online application form with your camper's information and needs.",
  },
  {
    icon: Mail,
    title: 'Submit Medical Forms',
    description:
      'Work with your healthcare provider to complete required medical documentation.',
  },
  {
    icon: Calendar,
    title: 'Schedule Interview',
    description:
      "Connect with our team to discuss your camper's needs and answer questions.",
  },
  {
    icon: CheckCircle,
    title: 'Receive Confirmation',
    description:
      "Once accepted, you'll receive session details and preparation materials.",
  },
];

const cardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const iconContainerStyle = {
  backgroundColor: 'rgba(251, 191, 36, 0.2)',
};

export function ApplyPage() {
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-16 text-center"
        >
          <h1 className="text-5xl md:text-6xl mb-8 leading-tight">
            Apply to Camp
          </h1>
          <p
            className="text-xl leading-relaxed max-w-2xl mx-auto"
            style={{ color: 'rgba(255, 255, 255, 0.8)' }}
          >
            We're excited to welcome your camper to Camp Burnt Gin. The
            application process is designed to be straightforward and
            supportive.
          </p>

          <div
            className="mt-12 p-8 rounded-3xl max-w-2xl mx-auto"
            style={{
              backgroundColor: 'rgba(15, 15, 15, 0.75)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow:
                '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Clock
                className="w-6 h-6"
                style={{ color: 'rgba(251, 191, 36, 0.9)' }}
              />
              <h3
                className="text-xl"
                style={{ color: 'rgba(255, 255, 255, 0.95)' }}
              >
                Estimated Time: ~10 minutes
              </h3>
            </div>
            <p
              className="text-base leading-relaxed mb-6"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              You can save your progress and return at any time. We'll keep your
              information secure and make the process as easy as possible.
            </p>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-10 py-5 rounded-full transition-all duration-500"
                style={{
                  backgroundColor: 'rgba(244, 114, 66, 0.25)',
                  color: '#ffffff',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  boxShadow:
                    '0 8px 32px rgba(244, 114, 66, 0.5), 0 0 40px rgba(244, 114, 66, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(244, 114, 66, 0.4)',
                  backdropFilter: 'blur(16px)',
                  textDecoration: 'none',
                }}
              >
                Start Application
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8 mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
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
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                  style={iconContainerStyle}
                >
                  <step.icon
                    className="w-6 h-6"
                    style={{ color: '#fbbf24' }}
                  />
                </div>
                <div>
                  <h3 className="text-xl mb-2">{step.title}</h3>
                  <p className="opacity-80 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-2xl mb-4">What to Expect</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                The application process typically takes 2-4 weeks. We review
                each application carefully to ensure we can provide the
                appropriate level of care and support for your camper.
              </p>
              <p>
                Our admissions team is here to help throughout the process.
                Don't hesitate to reach out with questions or concerns. We want
                to make this as easy and stress-free as possible for your
                family.
              </p>
            </div>
          </section>

          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-2xl mb-4">Financial Assistance</h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                We believe every child should have access to the camp
                experience, regardless of financial circumstances. Camp Burnt
                Gin offers scholarships and financial aid to qualifying
                families.
              </p>
              <p>
                Financial assistance information is included in the application
                process, and all requests are kept confidential.
              </p>
            </div>
          </section>

          <section className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
            <h2 className="text-2xl mb-4">Important Dates</h2>
            <div className="space-y-3 opacity-90">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span>Application Opens</span>
                <span>January 15, 2026</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span>Priority Deadline</span>
                <span>March 1, 2026</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span>Final Deadline</span>
                <span>May 1, 2026</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span>Summer Sessions Begin</span>
                <span>June 15, 2026</span>
              </div>
            </div>
          </section>

          <div className="text-center pt-8">
            <p className="opacity-70">
              Questions? Email us at admissions@campburntgin.org
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
