import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { useAppSelector } from '@/store/hooks';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'medical.camperRecord',
  role: 'medical',
  routeKeys: ['MEDICAL_RECORD_DETAIL'],
  titleKey: 'guide.medical.camperRecord.title',
  summaryKey: 'guide.medical.camperRecord.summary',
  smartHints: true,
  steps: [
    {
      id: 'sections_overview',
      titleKey: 'guide.medical.camperRecord.steps.sections_overview.title',
      summaryKey: 'guide.medical.camperRecord.steps.sections_overview.summary',
      detailsKey: 'guide.medical.camperRecord.steps.sections_overview.details',
    },
    {
      id: 'log_treatment',
      titleKey: 'guide.medical.camperRecord.steps.log_treatment.title',
      summaryKey: 'guide.medical.camperRecord.steps.log_treatment.summary',
      detailsKey: 'guide.medical.camperRecord.steps.log_treatment.details',
    },
    {
      id: 'incidents',
      titleKey: 'guide.medical.camperRecord.steps.incidents.title',
      summaryKey: 'guide.medical.camperRecord.steps.incidents.summary',
      detailsKey: 'guide.medical.camperRecord.steps.incidents.details',
    },
    {
      id: 'emergency_view',
      titleKey: 'guide.medical.camperRecord.steps.emergency_view.title',
      summaryKey: 'guide.medical.camperRecord.steps.emergency_view.summary',
      detailsKey: 'guide.medical.camperRecord.steps.emergency_view.details',
    },
    {
      id: 'no_share',
      titleKey: 'guide.medical.camperRecord.steps.no_share.title',
      summaryKey: 'guide.medical.camperRecord.steps.no_share.summary',
      detailsKey: 'guide.medical.camperRecord.steps.no_share.details',
      severity: 'urgent',
    },
  ],
  faq: [
    {
      id: 'mistake_on_log',
      questionKey: 'guide.medical.camperRecord.faq.mistake_on_log.question',
      answerKey: 'guide.medical.camperRecord.faq.mistake_on_log.answer',
    },
    {
      id: 'parent_access',
      questionKey: 'guide.medical.camperRecord.faq.parent_access.question',
      answerKey: 'guide.medical.camperRecord.faq.parent_access.answer',
    },
  ],
});

export function MedicalRecordHint() {
  const user = useAppSelector((s) => s.auth.user);
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    if (!user) {
      setHint(null);
      return;
    }
    setHint({
      id: 'medical.camperRecord.general',
      messageKey: 'guide.medical.camperRecord.hint.general.message',
      severity: 'info',
    });
  }, [user]);

  if (!hint) return null;
  return SmartHintRenderer({ hint });
}

registerSmartHintResolver('MEDICAL_RECORD_DETAIL', MedicalRecordHint);
