import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useScrolledPast } from '../hooks/useScrolledPast';
import { LanguageToggle } from './LanguageToggle';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/programs', label: 'Programs' },
  { path: '/campers', label: 'Campers' },
  { path: '/apply', label: 'Apply' },
  { path: '/testimonials', label: 'Stories' },
  { path: '/get-involved', label: 'Get Involved' },
  { path: '/virtual-program', label: "CBG 'n Me" },
];

export function LandingNav() {
  const location = useLocation();
  const isScrolled = useScrolledPast(20);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navBg = isScrolled ? 'var(--overlay-nav)' : 'var(--overlay-nav-subtle)';

  const navShadow = isScrolled
    ? '0 8px 32px rgba(0, 0, 0, 0.8), 0 2px 8px var(--nav-shadow-ember), inset 0 1px 0 var(--border-glass)'
    : '0 4px 16px rgba(0, 0, 0, 0.6)';

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed left-0 right-0 top-0 z-50 px-6 py-6"
      >
        <motion.div
          className="mx-auto max-w-7xl rounded-full px-8 py-4 backdrop-blur-xl transition-all duration-700 ease-out"
          animate={{
            backgroundColor: navBg,
            boxShadow: navShadow,
          }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="text-[1.125rem] font-semibold tracking-[-0.02em] text-white transition-all duration-button hover:opacity-100"
            >
              Camp Burnt Gin
            </Link>

            <div className="hidden items-center gap-7 md:flex">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      relative px-2 py-1.5 text-xs font-medium tracking-[-0.01em] transition-all duration-button hover:opacity-100
                      ${isActive ? 'text-white opacity-100' : 'text-white/90 opacity-85'}
                    `}
                  >
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute -bottom-0.5 left-1 right-1 h-0.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:block">
              <LanguageToggle />
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center rounded-full p-2 text-white transition-colors hover:bg-white/10 md:hidden"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </motion.div>
      </motion.nav>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl md:hidden"
          style={{ paddingTop: '6rem' } as React.CSSProperties}
        >
          <div className="flex h-full flex-col items-center justify-start gap-6 px-6 py-8">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link
                    to={item.path}
                    className={`block px-4 py-2 text-2xl font-medium transition-colors hover:text-white/80 ${
                      isActive ? 'text-warm-amber' : 'text-white/90'
                    }`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              );
            })}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: navItems.length * 0.05 }}
              className="mt-8"
            >
              <LanguageToggle />
            </motion.div>
          </div>
        </motion.div>
      )}
    </>
  );
}
