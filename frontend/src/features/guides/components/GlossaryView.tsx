import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getGlossaryTerms } from '@/features/guides';

export function GlossaryView() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const terms = useMemo(() => getGlossaryTerms(), []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return terms;
    const q = filter.trim().toLowerCase();
    return terms.filter(
      (term) =>
        t(term.termKey).toLowerCase().includes(q) ||
        t(term.definitionKey).toLowerCase().includes(q)
    );
  }, [filter, terms, t]);

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
        {t('guide.glossary_intro')}
      </p>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t('guide.glossary_search_placeholder')}
        className="w-full rounded-xl border px-3 py-2 text-sm mb-4"
        style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        aria-label={t('guide.glossary_search_placeholder')}
      />
      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {t('guide.help_center_no_results')}
        </p>
      ) : (
        <dl className="space-y-3">
          {filtered.map((term) => (
            <div key={term.id}>
              <dt className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {t(term.termKey)}
              </dt>
              <dd className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {t(term.definitionKey)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
