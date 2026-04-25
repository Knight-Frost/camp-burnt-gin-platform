import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { getSessions } from '@/features/admin/api/admin.api';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'admin.sessions',
  role: ['admin', 'super_admin'],
  routeKeys: ['ADMIN_SESSIONS', 'SUPER_ADMIN_SESSIONS'],
  titleKey: 'guide.admin.sessions.title',
  summaryKey: 'guide.admin.sessions.summary',
  smartHints: true,
  steps: [
    {
      id: 'session_cards',
      titleKey: 'guide.admin.sessions.steps.session_cards.title',
      summaryKey: 'guide.admin.sessions.steps.session_cards.summary',
      detailsKey: 'guide.admin.sessions.steps.session_cards.details',
    },
    {
      id: 'create_session',
      titleKey: 'guide.admin.sessions.steps.create_session.title',
      summaryKey: 'guide.admin.sessions.steps.create_session.summary',
      detailsKey: 'guide.admin.sessions.steps.create_session.details',
    },
    {
      id: 'capacity_warning',
      titleKey: 'guide.admin.sessions.steps.capacity_warning.title',
      summaryKey: 'guide.admin.sessions.steps.capacity_warning.summary',
      detailsKey: 'guide.admin.sessions.steps.capacity_warning.details',
    },
    {
      id: 'archive_vs_delete',
      titleKey: 'guide.admin.sessions.steps.archive_vs_delete.title',
      summaryKey: 'guide.admin.sessions.steps.archive_vs_delete.summary',
      detailsKey: 'guide.admin.sessions.steps.archive_vs_delete.details',
      severity: 'warning',
    },
    {
      id: 'view_dashboard',
      titleKey: 'guide.admin.sessions.steps.view_dashboard.title',
      summaryKey: 'guide.admin.sessions.steps.view_dashboard.summary',
      detailsKey: 'guide.admin.sessions.steps.view_dashboard.details',
    },
  ],
  faq: [
    {
      id: 'archive_effect',
      questionKey: 'guide.admin.sessions.faq.archive_effect.question',
      answerKey: 'guide.admin.sessions.faq.archive_effect.answer',
    },
    {
      id: 'capacity_after_enrollment',
      questionKey: 'guide.admin.sessions.faq.capacity_after_enrollment.question',
      answerKey: 'guide.admin.sessions.faq.capacity_after_enrollment.answer',
    },
  ],
});

export function AdminSessionsHint() {
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessions()
      .then((sessions) => {
        if (cancelled) return;
        const atCapacity = sessions.filter(
          (s) => s.enrolled_count !== undefined && s.enrolled_count >= s.capacity,
        );
        if (atCapacity.length > 0) {
          setHint({
            id: 'admin-sessions-full',
            messageKey: 'guide.admin.sessions.hint.sessions_full.message',
            messageVars: { count: atCapacity.length },
            severity: 'warning',
          });
          return;
        }
        const nearCapacity = sessions.filter(
          (s) =>
            s.enrolled_count !== undefined &&
            s.capacity > 0 &&
            s.enrolled_count / s.capacity >= 0.8,
        );
        if (nearCapacity.length > 0) {
          setHint({
            id: 'admin-sessions-near-capacity',
            messageKey: 'guide.admin.sessions.hint.sessions_near_capacity.message',
            messageVars: { count: nearCapacity.length },
            severity: 'info',
          });
          return;
        }
        setHint(null);
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

registerSmartHintResolver('ADMIN_SESSIONS', AdminSessionsHint);
