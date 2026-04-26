import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { useUnreadMessageCount } from '@/ui/context/MessagingCountContext';
import type { SmartHint } from '@/features/guides';

const SHARED_INBOX_ROUTE_KEYS = [
  'ADMIN_INBOX',
  'MEDICAL_INBOX',
  'SUPER_ADMIN_INBOX',
  'INBOX',
] as const;

const SHARED_INBOX_ROLES = ['admin', 'medical', 'super_admin'] as const;

registerGuide({
  id: 'shared.inbox',
  role: [...SHARED_INBOX_ROLES],
  routeKeys: [...SHARED_INBOX_ROUTE_KEYS],
  titleKey: 'guide.shared.inbox.title',
  summaryKey: 'guide.shared.inbox.summary',
  smartHints: true,
  steps: [
    {
      id: 'reading',
      titleKey: 'guide.shared.inbox.steps.reading.title',
      summaryKey: 'guide.shared.inbox.steps.reading.summary',
      detailsKey: 'guide.shared.inbox.steps.reading.details',
    },
    {
      id: 'reply',
      titleKey: 'guide.shared.inbox.steps.reply.title',
      summaryKey: 'guide.shared.inbox.steps.reply.summary',
      detailsKey: 'guide.shared.inbox.steps.reply.details',
    },
    {
      id: 'compose',
      titleKey: 'guide.shared.inbox.steps.compose.title',
      summaryKey: 'guide.shared.inbox.steps.compose.summary',
      detailsKey: 'guide.shared.inbox.steps.compose.details',
    },
    {
      id: 'mark_important_starred',
      titleKey: 'guide.shared.inbox.steps.mark_important_starred.title',
      summaryKey: 'guide.shared.inbox.steps.mark_important_starred.summary',
      detailsKey: 'guide.shared.inbox.steps.mark_important_starred.details',
    },
    {
      id: 'attachments',
      titleKey: 'guide.shared.inbox.steps.attachments.title',
      summaryKey: 'guide.shared.inbox.steps.attachments.summary',
      detailsKey: 'guide.shared.inbox.steps.attachments.details',
    },
  ],
  faq: [
    {
      id: 'star_vs_important',
      questionKey: 'guide.shared.inbox.faq.star_vs_important.question',
      answerKey: 'guide.shared.inbox.faq.star_vs_important.answer',
    },
    {
      id: 'unarchive',
      questionKey: 'guide.shared.inbox.faq.unarchive.question',
      answerKey: 'guide.shared.inbox.faq.unarchive.answer',
    },
  ],
});

export function SharedInboxHint() {
  const { unreadMessageCount } = useUnreadMessageCount();
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    if (unreadMessageCount > 0) {
      setHint({
        id: 'shared.inbox.unread_messages',
        messageKey: 'guide.shared.inbox.hint.unread_messages.message',
        messageVars: { count: unreadMessageCount },
        severity: 'info',
      });
    } else {
      setHint(null);
    }
  }, [unreadMessageCount]);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

for (const routeKey of SHARED_INBOX_ROUTE_KEYS) {
  registerSmartHintResolver(routeKey, SharedInboxHint);
}
