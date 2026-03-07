/**
 * LanguageToggle.tsx
 * Global English / Spanish pill-style toggle.
 * Appears in DashboardHeader for all portal roles.
 *
 * - Switches language instantly via i18next
 * - Persists selection in localStorage under key "language"
 * - Updates <html lang=""> for accessibility
 *
 * To add a new language: extend the Language type and append an entry to LANGUAGES.
 */

import { useTranslation } from 'react-i18next';

type Language = 'en' | 'es';

const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
];

export function LanguageToggle() {
  const { i18n } = useTranslation();
  // Normalise to 2-char code in case i18next returns "en-US" etc.
  const current = (i18n.language?.slice(0, 2) as Language) || 'en';

  const handleSelect = (lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  };

  return (
    <div
      className="flex items-center rounded-lg border overflow-hidden"
      role="group"
      aria-label="Language selection"
      style={{ borderColor: 'var(--border)' }}
    >
      {LANGUAGES.map((lang, idx) => {
        const isActive = current === lang.code;
        return (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            aria-pressed={isActive}
            aria-label={lang.code === 'en' ? 'Switch to English' : 'Cambiar a Español'}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors${idx > 0 ? ' border-l' : ''}`}
            style={{
              background: isActive ? 'var(--overlay-primary)' : 'transparent',
              color: isActive ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              borderColor: 'var(--border)',
            }}
          >
            <span aria-hidden="true">{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        );
      })}
    </div>
  );
}
