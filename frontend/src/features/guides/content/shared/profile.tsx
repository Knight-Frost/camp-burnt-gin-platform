import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { useAppSelector } from '@/store/hooks';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'shared.profile',
  role: ['applicant', 'admin', 'super_admin', 'medical'],
  routeKeys: ['PROFILE'],
  titleKey: 'guide.shared.profile.title',
  summaryKey: 'guide.shared.profile.summary',
  smartHints: true,
  steps: [
    {
      id: 'contact_info',
      titleKey: 'guide.shared.profile.steps.contact_info.title',
      summaryKey: 'guide.shared.profile.steps.contact_info.summary',
      detailsKey: 'guide.shared.profile.steps.contact_info.details',
    },
    {
      id: 'avatar',
      titleKey: 'guide.shared.profile.steps.avatar.title',
      summaryKey: 'guide.shared.profile.steps.avatar.summary',
      detailsKey: 'guide.shared.profile.steps.avatar.details',
    },
    {
      id: 'mfa',
      titleKey: 'guide.shared.profile.steps.mfa.title',
      summaryKey: 'guide.shared.profile.steps.mfa.summary',
      detailsKey: 'guide.shared.profile.steps.mfa.details',
    },
    {
      id: 'emergency_contacts',
      titleKey: 'guide.shared.profile.steps.emergency_contacts.title',
      summaryKey: 'guide.shared.profile.steps.emergency_contacts.summary',
      detailsKey: 'guide.shared.profile.steps.emergency_contacts.details',
    },
  ],
  faq: [
    {
      id: 'what_is_mfa',
      questionKey: 'guide.shared.profile.faq.what_is_mfa.question',
      answerKey: 'guide.shared.profile.faq.what_is_mfa.answer',
    },
    {
      id: 'why_emergency_contact',
      questionKey: 'guide.shared.profile.faq.why_emergency_contact.question',
      answerKey: 'guide.shared.profile.faq.why_emergency_contact.answer',
    },
  ],
});

export function ProfileHint() {
  const user = useAppSelector((s) => s.auth.user);
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    if (!user) {
      setHint(null);
      return;
    }
    if (user.mfa_enabled === false) {
      setHint({
        id: 'shared.profile.mfa_disabled',
        messageKey: 'guide.shared.profile.hint.mfa_disabled.message',
        severity: 'warning',
      });
    } else {
      setHint(null);
    }
  }, [user]);

  if (!hint) return null;
  return SmartHintRenderer({ hint });
}

registerSmartHintResolver('PROFILE', ProfileHint);
