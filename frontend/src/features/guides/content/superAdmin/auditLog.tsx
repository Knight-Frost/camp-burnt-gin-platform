import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'superAdmin.auditLog',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_AUDIT'],
  titleKey: 'guide.superAdmin.auditLog.title',
  summaryKey: 'guide.superAdmin.auditLog.summary',
  smartHints: true,
  steps: [
    {
      id: 'what_logs',
      titleKey: 'guide.superAdmin.auditLog.steps.what_logs.title',
      summaryKey: 'guide.superAdmin.auditLog.steps.what_logs.summary',
      detailsKey: 'guide.superAdmin.auditLog.steps.what_logs.details',
    },
    {
      id: 'compliance',
      titleKey: 'guide.superAdmin.auditLog.steps.compliance.title',
      summaryKey: 'guide.superAdmin.auditLog.steps.compliance.summary',
      detailsKey: 'guide.superAdmin.auditLog.steps.compliance.details',
      severity: 'warning',
    },
    {
      id: 'investigate',
      titleKey: 'guide.superAdmin.auditLog.steps.investigate.title',
      summaryKey: 'guide.superAdmin.auditLog.steps.investigate.summary',
      detailsKey: 'guide.superAdmin.auditLog.steps.investigate.details',
    },
    {
      id: 'retention',
      titleKey: 'guide.superAdmin.auditLog.steps.retention.title',
      summaryKey: 'guide.superAdmin.auditLog.steps.retention.summary',
      detailsKey: 'guide.superAdmin.auditLog.steps.retention.details',
    },
  ],
  faq: [
    {
      id: 'delete_entry',
      questionKey: 'guide.superAdmin.auditLog.faq.delete_entry.question',
      answerKey: 'guide.superAdmin.auditLog.faq.delete_entry.answer',
    },
    {
      id: 'who_can_see',
      questionKey: 'guide.superAdmin.auditLog.faq.who_can_see.question',
      answerKey: 'guide.superAdmin.auditLog.faq.who_can_see.answer',
    },
  ],
});

const useFiltersHint: SmartHint = {
  id: 'super-admin-audit-use-filters',
  messageKey: 'guide.superAdmin.auditLog.hint.use_filters.message',
  severity: 'info',
};

export function SuperAdminAuditHint() {
  return <SmartHintRenderer hint={useFiltersHint} />;
}

registerSmartHintResolver('SUPER_ADMIN_AUDIT', SuperAdminAuditHint);
