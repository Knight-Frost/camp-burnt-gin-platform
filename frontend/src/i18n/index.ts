/**
 * i18n/index.ts — Internationalization (translation) setup
 *
 * i18next is the translation library. It lets the app display text in multiple
 * languages without hardcoding any strings inside components.
 *
 * This file:
 * 1. Reads the user's saved language preference from localStorage.
 * 2. Sets the <html lang=""> attribute for screen readers and accessibility tools.
 * 3. Configures i18next with the English and Spanish translation JSON files.
 *
 * Components use the hook: const { t } = useTranslation();
 * Then: t('dashboard.welcome') → "Welcome" (en) or "Bienvenido" (es)
 *
 * This file is imported at the very top of main.tsx so translations are ready
 * before any component renders.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enBase from './en.json';
import esBase from './es.json';
import enGuides from './guides/en.json';
import esGuides from './guides/es.json';
import enGuidesApplicant from './guides/content/applicant.en.json';
import esGuidesApplicant from './guides/content/applicant.es.json';
import enGuidesAdmin from './guides/content/admin.en.json';
import esGuidesAdmin from './guides/content/admin.es.json';
import enGuidesSuperAdmin from './guides/content/superAdmin.en.json';
import esGuidesSuperAdmin from './guides/content/superAdmin.es.json';
import enGuidesMedical from './guides/content/medical.en.json';
import esGuidesMedical from './guides/content/medical.es.json';
import enGuidesShared from './guides/content/shared.en.json';
import esGuidesShared from './guides/content/shared.es.json';
import enGuidesGlossary from './guides/content/glossary.en.json';
import esGuidesGlossary from './guides/content/glossary.es.json';

// Each content file contributes a different sub-namespace under `guide.*`
// (guide.applicant, guide.admin, guide.glossary, etc.) so a shallow merge of
// the second-level `guide` object is collision-free.
const en = {
  ...enBase,
  guide: {
    ...enGuides.guide,
    ...enGuidesApplicant.guide,
    ...enGuidesAdmin.guide,
    ...enGuidesSuperAdmin.guide,
    ...enGuidesMedical.guide,
    ...enGuidesShared.guide,
    ...enGuidesGlossary.guide,
  },
};
const es = {
  ...esBase,
  guide: {
    ...esGuides.guide,
    ...esGuidesApplicant.guide,
    ...esGuidesAdmin.guide,
    ...esGuidesSuperAdmin.guide,
    ...esGuidesMedical.guide,
    ...esGuidesShared.guide,
    ...esGuidesGlossary.guide,
  },
};

const savedLanguage = localStorage.getItem('language') ?? 'en';
document.documentElement.lang = savedLanguage;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
