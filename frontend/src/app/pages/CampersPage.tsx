import { motion } from 'framer-motion';
import { Heart, Shield, Users, Clock } from 'lucide-react';

const camperImage = 'https://images.unsplash.com/photo-1701834951900-b31c99da66f8?w=800&q=80';

const cardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

export function CampersPage() {
  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-16"
        >
          <h1 className="text-5xl md:text-6xl mb-8 leading-tight">
            Camper Information
          </h1>
          <p className="text-xl opacity-80 leading-relaxed">
            Everything you need to know to prepare for an amazing summer at Camp
            Burnt Gin.
          </p>
        </motion.div>

        <motion.div
          className="space-y-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <section>
            <h2 className="text-3xl mb-6 flex items-center gap-3">
              <Heart className="w-8 h-8" style={{ color: '#fbbf24' }} />
              Who We Serve
            </h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                Camp Burnt Gin welcomes children and young adults ages 7-21 with
                special health care needs, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Developmental disabilities</li>
                <li>Physical disabilities</li>
                <li>Chronic medical conditions</li>
                <li>Complex care needs</li>
                <li>Technology dependence</li>
              </ul>
              <p>
                We believe every child deserves the camp experience, and our team
                works closely with families to ensure we can safely accommodate
                each camper's unique needs.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl mb-6 flex items-center gap-3">
              <Shield className="w-8 h-8" style={{ color: '#fbbf24' }} />
              Medical Care & Safety
            </h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                Your camper's health and safety are our highest priorities. Our
                medical team includes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Registered nurses on-site 24/7</li>
                <li>Licensed physicians available</li>
                <li>Specialized therapists (PT, OT, RT as needed)</li>
                <li>Trained support staff familiar with complex care</li>
              </ul>
              <p>
                We administer medications, manage medical equipment, and provide
                individualized care plans developed in partnership with families
                and medical providers.
              </p>
            </div>
          </section>

          <motion.div
            className="rounded-3xl overflow-hidden my-12"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
            viewport={{ once: true }}
            style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' }}
          >
            <img
              src={camperImage}
              alt="Accessible camp activities"
              className="w-full h-auto"
            />
          </motion.div>

          <section>
            <h2 className="text-3xl mb-6 flex items-center gap-3">
              <Users className="w-8 h-8" style={{ color: '#fbbf24' }} />
              Staff Ratios & Support
            </h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                We maintain low camper-to-staff ratios to ensure personalized
                attention and support. Every camper has a dedicated counselor who
                gets to know them, celebrates their achievements, and helps them
                navigate camp life.
              </p>
              <p>
                Our staff receive extensive training in disability awareness,
                medical care, adaptive programming, and creating inclusive
                environments where every camper can thrive.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl mb-6 flex items-center gap-3">
              <Clock className="w-8 h-8" style={{ color: '#fbbf24' }} />
              Sessions & Schedule
            </h2>
            <div className="space-y-4 opacity-90 leading-relaxed">
              <p>
                Camp sessions run throughout the summer, typically ranging from
                weekend sessions to full week programs. Each session includes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Morning activities and programs</li>
                <li>Midday rest and quiet time</li>
                <li>Afternoon adventures</li>
                <li>Evening activities and campfires</li>
                <li>Overnight care and support</li>
              </ul>
              <p>
                All schedules are flexible and adapted to each camper's needs,
                energy levels, and preferences.
              </p>
            </div>
          </section>

          <section className="pt-8">
            <div className="p-8 rounded-2xl backdrop-blur-md" style={cardStyle}>
              <h2 className="text-2xl mb-4">Questions?</h2>
              <p className="opacity-90 leading-relaxed">
                We're here to help you prepare for camp and answer any questions
                you may have. Every family's journey is unique, and we're
                committed to working with you to make camp a wonderful experience
                for your camper.
              </p>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
