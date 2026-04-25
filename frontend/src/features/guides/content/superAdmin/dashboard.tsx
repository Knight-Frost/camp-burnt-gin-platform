import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { getAdminApplications } from '@/features/admin/api/admin.api';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'superAdmin.dashboard',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_DASHBOARD'],
  titleKey: 'guide.superAdmin.dashboard.title',
  summaryKey: 'guide.superAdmin.dashboard.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.superAdmin.dashboard',
    titleKey: 'guide.superAdmin.dashboard.walkthrough.title',
    steps: [
      { id: 'stats',           anchorId: 'super-admin-dashboard.stats',           titleKey: 'guide.superAdmin.dashboard.walkthrough.steps.stats.title',           bodyKey: 'guide.superAdmin.dashboard.walkthrough.steps.stats.body',           position: 'bottom' },
      { id: 'sessions',        anchorId: 'super-admin-dashboard.sessions',        titleKey: 'guide.superAdmin.dashboard.walkthrough.steps.sessions.title',        bodyKey: 'guide.superAdmin.dashboard.walkthrough.steps.sessions.body',        position: 'bottom' },
      { id: 'needs-attention', anchorId: 'super-admin-dashboard.needs-attention', titleKey: 'guide.superAdmin.dashboard.walkthrough.steps.needs-attention.title', bodyKey: 'guide.superAdmin.dashboard.walkthrough.steps.needs-attention.body', position: 'right' },
      { id: 'recent-activity', anchorId: 'super-admin-dashboard.recent-activity', titleKey: 'guide.superAdmin.dashboard.walkthrough.steps.recent-activity.title', bodyKey: 'guide.superAdmin.dashboard.walkthrough.steps.recent-activity.body', position: 'left' },
    ],
  },
  steps: [
    {
      id: 'overview',
      titleKey: 'guide.superAdmin.dashboard.steps.overview.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.overview.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.overview.details',
    },
    {
      id: 'needs_attention',
      titleKey: 'guide.superAdmin.dashboard.steps.needs_attention.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.needs_attention.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.needs_attention.details',
    },
    {
      id: 'sessions_carousel',
      titleKey: 'guide.superAdmin.dashboard.steps.sessions_carousel.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.sessions_carousel.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.sessions_carousel.details',
    },
    {
      id: 'user_management_link',
      titleKey: 'guide.superAdmin.dashboard.steps.user_management_link.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.user_management_link.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.user_management_link.details',
    },
    {
      id: 'audit_log_link',
      titleKey: 'guide.superAdmin.dashboard.steps.audit_log_link.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.audit_log_link.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.audit_log_link.details',
    },
  ],
  faq: [
    {
      id: 'oldest_first',
      questionKey: 'guide.superAdmin.dashboard.faq.oldest_first.question',
      answerKey: 'guide.superAdmin.dashboard.faq.oldest_first.answer',
    },
    {
      id: 'red_session',
      questionKey: 'guide.superAdmin.dashboard.faq.red_session.question',
      answerKey: 'guide.superAdmin.dashboard.faq.red_session.answer',
    },
  ],
});

export function SuperAdminDashboardHint() {
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminApplications({ status: 'submitted', sort: 'submitted_at', direction: 'asc', per_page: 8 })
      .then((response) => {
        if (cancelled) return;
        const total = response.meta?.total ?? response.data.length;
        if (total === 0) {
          setHint({
            id: 'super-admin-dashboard-caught-up',
            messageKey: 'guide.superAdmin.dashboard.hint.all_caught_up.message',
            severity: 'info',
          });
          return;
        }
        const oldest = response.data[0];
        if (oldest?.submitted_at) {
          const days = Math.floor(
            (Date.now() - new Date(oldest.submitted_at).getTime()) / (1000 * 60 * 60 * 24),
          );
          if (days >= 5) {
            setHint({
              id: 'super-admin-dashboard-overdue',
              messageKey: 'guide.superAdmin.dashboard.hint.overdue_pending.message',
              messageVars: { count: total, days },
              severity: 'urgent',
              cta: { labelKey: 'guide.superAdmin.dashboard.hint.overdue_pending.cta', routeKey: 'SUPER_ADMIN_DASHBOARD' },
            });
            return;
          }
        }
        setHint({
          id: 'super-admin-dashboard-pending',
          messageKey: 'guide.superAdmin.dashboard.hint.pending_exists.message',
          messageVars: { count: total },
          severity: 'info',
        });
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

registerSmartHintResolver('SUPER_ADMIN_DASHBOARD', SuperAdminDashboardHint);
