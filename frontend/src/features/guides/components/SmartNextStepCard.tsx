import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { matchRouteKey } from '@/features/guides';
import { getSmartHintResolver } from '../registry/smartHintRegistry';

export function SmartNextStepCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const routeKey = matchRouteKey(location.pathname);
  const Resolver = getSmartHintResolver(routeKey);

  return (
    <section className="mb-4">
      <h2
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {t('guide.smart_next_step_heading')}
      </h2>
      {Resolver ? (
        // key on the wrapper div resets resolver state on route change
        <div key={routeKey ?? 'none'}><Resolver /></div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {t('guide.smart_next_step_empty')}
        </p>
      )}
    </section>
  );
}
