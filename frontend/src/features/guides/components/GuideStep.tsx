import { useTranslation } from 'react-i18next';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import type { GuideStep as GuideStepType } from '../types/guide.types';

interface Props {
  step: GuideStepType;
  index: number;
}

export function GuideStep({ step, index }: Props) {
  const { t } = useTranslation();
  const hasSeverityIcon = step.severity === 'warning' || step.severity === 'urgent';
  const severityLabel =
    step.severity === 'urgent' ? t('guide.urgent_label') :
    step.severity === 'warning' ? t('guide.warning_label') : null;

  return (
    <div className="rounded-xl border p-4 mb-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ background: 'var(--ember-orange)', color: '#fff' }}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          {severityLabel && (
            <div
              className="inline-flex items-center gap-1 mb-1 text-xs font-semibold"
              style={{ color: step.severity === 'urgent' ? 'var(--destructive)' : 'var(--warm-amber)' }}
            >
              {hasSeverityIcon && <AlertTriangle className="h-3 w-3" />}
              {severityLabel}
            </div>
          )}
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
            {t(step.titleKey)}
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t(step.summaryKey)}
          </p>
          {step.detailsKey && (
            <Accordion.Root type="single" collapsible className="mt-2">
              <Accordion.Item value="details">
                <Accordion.Header>
                  <Accordion.Trigger
                    className="group flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                    style={{ color: 'var(--ember-orange)' }}
                  >
                    {t('guide.more_details_show')}
                    <ChevronDown
                      className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180"
                    />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {t(step.detailsKey)}
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          )}
        </div>
      </div>
    </div>
  );
}
