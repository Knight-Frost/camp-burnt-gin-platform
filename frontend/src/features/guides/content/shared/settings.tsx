import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'shared.settings',
  role: ['applicant', 'admin', 'super_admin', 'medical'],
  routeKeys: ['APPLICANT_SETTINGS', 'ADMIN_SETTINGS', 'MEDICAL_SETTINGS', 'SUPER_ADMIN_SETTINGS'],
  titleKey: 'guide.shared.settings.title',
  summaryKey: 'guide.shared.settings.summary',
  steps: [
    {
      id: 'language',
      titleKey: 'guide.shared.settings.steps.language.title',
      summaryKey: 'guide.shared.settings.steps.language.summary',
      detailsKey: 'guide.shared.settings.steps.language.details',
    },
    {
      id: 'notifications',
      titleKey: 'guide.shared.settings.steps.notifications.title',
      summaryKey: 'guide.shared.settings.steps.notifications.summary',
      detailsKey: 'guide.shared.settings.steps.notifications.details',
    },
    {
      id: 'accessibility',
      titleKey: 'guide.shared.settings.steps.accessibility.title',
      summaryKey: 'guide.shared.settings.steps.accessibility.summary',
      detailsKey: 'guide.shared.settings.steps.accessibility.details',
    },
    {
      id: 'delete_account',
      titleKey: 'guide.shared.settings.steps.delete_account.title',
      summaryKey: 'guide.shared.settings.steps.delete_account.summary',
      detailsKey: 'guide.shared.settings.steps.delete_account.details',
      // 'warning' → "Important" (amber) flags the destructive nature
      // without implying the user is required to do this. 'urgent' was
      // rendering "Action needed" which read like a pending task.
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'change_password',
      questionKey: 'guide.shared.settings.faq.change_password.question',
      answerKey: 'guide.shared.settings.faq.change_password.answer',
    },
    {
      id: 'notification_not_arriving',
      questionKey: 'guide.shared.settings.faq.notification_not_arriving.question',
      answerKey: 'guide.shared.settings.faq.notification_not_arriving.answer',
    },
  ],
});

export function SettingsHint() {
  return null;
}

registerSmartHintResolver('APPLICANT_SETTINGS', SettingsHint);
registerSmartHintResolver('ADMIN_SETTINGS', SettingsHint);
registerSmartHintResolver('MEDICAL_SETTINGS', SettingsHint);
registerSmartHintResolver('SUPER_ADMIN_SETTINGS', SettingsHint);
