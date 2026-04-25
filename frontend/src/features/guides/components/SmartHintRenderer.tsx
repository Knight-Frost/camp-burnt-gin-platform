import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertTriangle, Info } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { openGuide, closeGuide } from '@/features/guides';
import { ROUTES } from '@/shared/constants/routes';
import type { SmartHint } from '../types/guide.types';

interface Props {
  hint: SmartHint;
}

export function SmartHintRenderer({ hint }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const Icon = hint.severity === 'urgent' || hint.severity === 'warning' ? AlertTriangle : Info;
  const accent =
    hint.severity === 'urgent' ? 'var(--destructive)' :
    hint.severity === 'warning' ? 'var(--warm-amber)' :
    'var(--ember-orange)';

  function handleCta() {
    if (!hint.cta) return;
    if (hint.cta.externalAction === 'open-help-center') {
      dispatch(openGuide({ mode: 'help-center' }));
      return;
    }
    if (hint.cta.routeKey) {
      const route = ROUTES[hint.cta.routeKey as keyof typeof ROUTES];
      const path = typeof route === 'function' ? hint.cta.pathOverride ?? '' : (route as string) ?? '';
      if (path) {
        dispatch(closeGuide());
        navigate(path);
      }
    } else if (hint.cta.pathOverride) {
      dispatch(closeGuide());
      navigate(hint.cta.pathOverride);
    }
  }

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ borderColor: accent, background: `${accent}10` }}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0" style={{ color: accent }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t(hint.messageKey, hint.messageVars ?? {})}
          </p>
          {hint.cta && (
            <button
              type="button"
              onClick={handleCta}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline"
              style={{ color: accent }}
            >
              {t(hint.cta.labelKey)}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
