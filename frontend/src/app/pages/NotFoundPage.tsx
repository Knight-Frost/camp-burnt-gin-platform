/**
 * NotFoundPage.tsx
 * Route: *  (catch-all)
 */

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pageEntry, buttonHover, buttonTap } from '@/shared/constants/motion';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        variants={pageEntry}
        initial="hidden"
        animate="visible"
        className="text-center max-w-sm"
      >
        <p
          className="font-headline font-bold mb-4"
          style={{ fontSize: '120px', lineHeight: 1, color: 'var(--ember-orange)', opacity: 0.2 }}
        >
          404
        </p>
        <h1 className="font-headline text-xl font-semibold mb-3" style={{ color: 'var(--on-image-text)' }}>
          {t('errors.not_found_title')}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--on-image-muted)' }}>
          {t('errors.not_found_desc')}
        </p>
        <motion.div whileHover={buttonHover} whileTap={buttonTap} className="inline-block">
          <Link
            to="/"
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--cta-primary-bg)', color: 'var(--cta-primary-color)' }}
          >
            {t('errors.go_home')}
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
