import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'admin.reports',
  role: ['admin', 'super_admin'],
  routeKeys: ['ADMIN_REPORTS', 'SUPER_ADMIN_REPORTS'],
  titleKey: 'guide.admin.reports.title',
  summaryKey: 'guide.admin.reports.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.admin.reports',
    titleKey: 'guide.admin.reports.walkthrough.title',
    steps: [
      {
        id: 'stat-cards',
        anchorId: 'admin-reports.stat-cards',
        titleKey: 'guide.admin.reports.walkthrough.steps.stat-cards.title',
        bodyKey: 'guide.admin.reports.walkthrough.steps.stat-cards.body',
        position: 'bottom',
      },
      {
        id: 'charts-grid',
        anchorId: 'admin-reports.charts-grid',
        titleKey: 'guide.admin.reports.walkthrough.steps.charts-grid.title',
        bodyKey: 'guide.admin.reports.walkthrough.steps.charts-grid.body',
        position: 'bottom',
      },
      {
        id: 'export-buttons',
        anchorId: 'admin-reports.export-buttons',
        titleKey: 'guide.admin.reports.walkthrough.steps.export-buttons.title',
        bodyKey: 'guide.admin.reports.walkthrough.steps.export-buttons.body',
        position: 'top',
      },
    ],
  },
  steps: [
    {
      id: 'stat_cards',
      titleKey: 'guide.admin.reports.steps.stat_cards.title',
      summaryKey: 'guide.admin.reports.steps.stat_cards.summary',
      detailsKey: 'guide.admin.reports.steps.stat_cards.details',
    },
    {
      id: 'charts',
      titleKey: 'guide.admin.reports.steps.charts.title',
      summaryKey: 'guide.admin.reports.steps.charts.summary',
      detailsKey: 'guide.admin.reports.steps.charts.details',
    },
    {
      id: 'export_csv',
      titleKey: 'guide.admin.reports.steps.export_csv.title',
      summaryKey: 'guide.admin.reports.steps.export_csv.summary',
      detailsKey: 'guide.admin.reports.steps.export_csv.details',
    },
    {
      id: 'mailing_labels',
      titleKey: 'guide.admin.reports.steps.mailing_labels.title',
      summaryKey: 'guide.admin.reports.steps.mailing_labels.summary',
      detailsKey: 'guide.admin.reports.steps.mailing_labels.details',
    },
    {
      id: 'id_labels',
      titleKey: 'guide.admin.reports.steps.id_labels.title',
      summaryKey: 'guide.admin.reports.steps.id_labels.summary',
      detailsKey: 'guide.admin.reports.steps.id_labels.details',
    },
  ],
  faq: [
    {
      id: 'real_time',
      questionKey: 'guide.admin.reports.faq.real_time.question',
      answerKey: 'guide.admin.reports.faq.real_time.answer',
    },
    {
      id: 'csv_location',
      questionKey: 'guide.admin.reports.faq.csv_location.question',
      answerKey: 'guide.admin.reports.faq.csv_location.answer',
    },
  ],
});

const exportTipHint: SmartHint = {
  id: 'admin-reports-export-tip',
  messageKey: 'guide.admin.reports.hint.export_tip.message',
  severity: 'info',
};

export function AdminReportsHint() {
  return <SmartHintRenderer hint={exportTipHint} />;
}

registerSmartHintResolver('ADMIN_REPORTS', AdminReportsHint);
