/**
 * ForbiddenPage.tsx
 * Route: /forbidden
 */

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';
import { pageEntry, buttonHover, buttonTap } from '@/shared/constants/motion';

export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        variants={pageEntry}
        initial="hidden"
        animate="visible"
        className="text-center max-w-sm"
      >
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-5"
          style={{ background: 'rgba(248,113,113,0.1)' }}
        >
          <ShieldOff className="h-7 w-7" style={{ color: '#f87171' }} />
        </div>
        <h1 className="font-headline text-xl font-semibold mb-3" style={{ color: 'var(--on-image-text)' }}>
          {t('errors.forbidden_title')}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--on-image-muted)' }}>
          {t('errors.forbidden_desc')}
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
