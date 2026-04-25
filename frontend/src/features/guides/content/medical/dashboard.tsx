import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { useAppSelector } from '@/store/hooks';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'medical.dashboard',
  role: 'medical',
  routeKeys: ['MEDICAL_DASHBOARD'],
  titleKey: 'guide.medical.dashboard.title',
  summaryKey: 'guide.medical.dashboard.summary',
  smartHints: true,
  steps: [
    {
      id: 'overview',
      titleKey: 'guide.medical.dashboard.steps.overview.title',
      summaryKey: 'guide.medical.dashboard.steps.overview.summary',
      detailsKey: 'guide.medical.dashboard.steps.overview.details',
    },
    {
      id: 'directory',
      titleKey: 'guide.medical.dashboard.steps.directory.title',
      summaryKey: 'guide.medical.dashboard.steps.directory.summary',
      detailsKey: 'guide.medical.dashboard.steps.directory.details',
    },
    {
      id: 'treatments_log',
      titleKey: 'guide.medical.dashboard.steps.treatments_log.title',
      summaryKey: 'guide.medical.dashboard.steps.treatments_log.summary',
      detailsKey: 'guide.medical.dashboard.steps.treatments_log.details',
    },
    {
      id: 'follow_ups',
      titleKey: 'guide.medical.dashboard.steps.follow_ups.title',
      summaryKey: 'guide.medical.dashboard.steps.follow_ups.summary',
      detailsKey: 'guide.medical.dashboard.steps.follow_ups.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.dashboard.steps.phi_handling.title',
      summaryKey: 'guide.medical.dashboard.steps.phi_handling.summary',
      detailsKey: 'guide.medical.dashboard.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'why_log_every_treatment',
      questionKey: 'guide.medical.dashboard.faq.why_log_every_treatment.question',
      answerKey: 'guide.medical.dashboard.faq.why_log_every_treatment.answer',
    },
    {
      id: 'see_all_campers',
      questionKey: 'guide.medical.dashboard.faq.see_all_campers.question',
      answerKey: 'guide.medical.dashboard.faq.see_all_campers.answer',
    },
  ],
});

export function MedicalDashboardHint() {
  const user = useAppSelector((s) => s.auth.user);
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    if (!user) {
      setHint(null);
      return;
    }
    setHint({
      id: 'medical.dashboard.general',
      messageKey: 'guide.medical.dashboard.hint.general.message',
      severity: 'info',
    });
  }, [user]);

  if (!hint) return null;
  return SmartHintRenderer({ hint });
}

registerSmartHintResolver('MEDICAL_DASHBOARD', MedicalDashboardHint);
