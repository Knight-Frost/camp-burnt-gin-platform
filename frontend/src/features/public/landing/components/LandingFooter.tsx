import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function LandingFooter() {
  const { isDark } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      className="relative z-10 mt-32 px-6 py-16"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
      viewport={{ once: true }}
    >
      <div
        className={`
          mx-auto max-w-6xl rounded-3xl p-12 backdrop-blur-xl
          ${isDark
            ? 'bg-glass-footer-dark shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
            : 'bg-glass-footer-light shadow-[0_4px_24px_rgba(0,0,0,0.06)]'
          }
        `}
      >
        <div className="mb-12 grid gap-12 md:grid-cols-3">
          <div>
            <h3 className="font-headline mb-6 text-[1.5rem] font-bold">
              Camp Burnt Gin
            </h3>
            <p className="font-body leading-relaxed opacity-80">
              Creating transformative summer experiences for children and young adults with
              special health care needs since 1990.
            </p>
          </div>

          <div>
            <h4 className="font-headline mb-6 text-[1.125rem] font-semibold">
              Quick Links
            </h4>
            <nav className="font-body space-y-3">
              {[
                { to: '/about', label: 'About Us' },
                { to: '/programs', label: 'Programs' },
                { to: '/apply', label: 'Apply' },
                { to: '/get-involved', label: 'Get Involved' },
              ].map((link) => (
                <motion.div key={link.to}>
                  <Link
                    to={link.to}
                    className="block opacity-75 transition-all duration-button"
                  >
                    <motion.span
                      whileHover={{ x: 4, opacity: 1 }}
                      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                      className="inline-block"
                    >
                      {link.label}
                    </motion.span>
                  </Link>
                </motion.div>
              ))}
            </nav>
          </div>

          <div>
            <h4 className="font-headline mb-6 text-[1.125rem] font-semibold">
              Contact
            </h4>
            <div className="font-body space-y-4 opacity-80">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>info@campburntgin.org</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>(555) 123-4567</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <span>
                  123 Camp Road
                  <br />
                  Wilderness, State 12345
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`font-body border-t pt-8 text-center opacity-70 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <p>© {currentYear} Camp Burnt Gin. All rights reserved.</p>
        </div>
      </div>
    </motion.footer>
  );
}
