import {
  registerGuide,
  registerSmartHintResolver,
  SmartHintRenderer,
} from '@/features/guides';
import { useUnreadMessageCount } from '@/ui/context/MessagingCountContext';

registerGuide({
  id: 'applicant.inbox',
  role: 'applicant',
  routeKeys: ['APPLICANT_INBOX'],
  titleKey: 'guide.applicant.inbox.title',
  summaryKey: 'guide.applicant.inbox.summary',
  smartHints: true,
  steps: [
    {
      id: 'reading',
      titleKey: 'guide.applicant.inbox.steps.reading.title',
      summaryKey: 'guide.applicant.inbox.steps.reading.summary',
      detailsKey: 'guide.applicant.inbox.steps.reading.details',
    },
    {
      id: 'reply',
      titleKey: 'guide.applicant.inbox.steps.reply.title',
      summaryKey: 'guide.applicant.inbox.steps.reply.summary',
      detailsKey: 'guide.applicant.inbox.steps.reply.details',
    },
    {
      id: 'archive',
      titleKey: 'guide.applicant.inbox.steps.archive.title',
      summaryKey: 'guide.applicant.inbox.steps.archive.summary',
      detailsKey: 'guide.applicant.inbox.steps.archive.details',
    },
    {
      id: 'document_requests_in_inbox',
      titleKey: 'guide.applicant.inbox.steps.document_requests_in_inbox.title',
      summaryKey: 'guide.applicant.inbox.steps.document_requests_in_inbox.summary',
      detailsKey: 'guide.applicant.inbox.steps.document_requests_in_inbox.details',
    },
  ],
  faq: [
    {
      id: 'system_messages',
      questionKey: 'guide.applicant.inbox.faq.system_messages.question',
      answerKey: 'guide.applicant.inbox.faq.system_messages.answer',
    },
    {
      id: 'direct_email',
      questionKey: 'guide.applicant.inbox.faq.direct_email.question',
      answerKey: 'guide.applicant.inbox.faq.direct_email.answer',
    },
  ],
});

export function ApplicantInboxHint() {
  const { unreadMessageCount } = useUnreadMessageCount();

  if (unreadMessageCount > 0) {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.inbox.unread_messages',
          messageKey: 'guide.applicant.inbox.hint.unread_messages.message',
          messageVars: { count: unreadMessageCount },
          severity: 'info',
          cta: {
            labelKey: 'guide.applicant.inbox.hint.unread_messages.cta',
          },
        }}
      />
    );
  }

  return null;
}

registerSmartHintResolver('APPLICANT_INBOX', ApplicantInboxHint);
