import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  registerGuide,
  registerSmartHintResolver,
  SmartHintRenderer,
} from '@/features/guides';
import { getDrafts } from '@/features/parent/api/applicant.api';
import type { ApplicationDraft } from '@/features/parent/api/applicant.api';

registerGuide({
  id: 'applicant.applicationForm',
  role: 'applicant',
  routeKeys: ['PARENT_APPLICATION_NEW'],
  titleKey: 'guide.applicant.applicationForm.title',
  summaryKey: 'guide.applicant.applicationForm.summary',
  smartHints: true,
  steps: [
    {
      id: 'sections_overview',
      titleKey: 'guide.applicant.applicationForm.steps.sections_overview.title',
      summaryKey: 'guide.applicant.applicationForm.steps.sections_overview.summary',
      detailsKey: 'guide.applicant.applicationForm.steps.sections_overview.details',
    },
    {
      id: 'autosave',
      titleKey: 'guide.applicant.applicationForm.steps.autosave.title',
      summaryKey: 'guide.applicant.applicationForm.steps.autosave.summary',
      detailsKey: 'guide.applicant.applicationForm.steps.autosave.details',
    },
    {
      id: 'section_complete',
      titleKey: 'guide.applicant.applicationForm.steps.section_complete.title',
      summaryKey: 'guide.applicant.applicationForm.steps.section_complete.summary',
      detailsKey: 'guide.applicant.applicationForm.steps.section_complete.details',
    },
    {
      id: 'documents',
      titleKey: 'guide.applicant.applicationForm.steps.documents.title',
      summaryKey: 'guide.applicant.applicationForm.steps.documents.summary',
      detailsKey: 'guide.applicant.applicationForm.steps.documents.details',
    },
    {
      id: 'signature',
      titleKey: 'guide.applicant.applicationForm.steps.signature.title',
      summaryKey: 'guide.applicant.applicationForm.steps.signature.summary',
      detailsKey: 'guide.applicant.applicationForm.steps.signature.details',
    },
    {
      id: 'submit',
      titleKey: 'guide.applicant.applicationForm.steps.submit.title',
      summaryKey: 'guide.applicant.applicationForm.steps.submit.summary',
      detailsKey: 'guide.applicant.applicationForm.steps.submit.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'yellow_section',
      questionKey: 'guide.applicant.applicationForm.faq.yellow_section.question',
      answerKey: 'guide.applicant.applicationForm.faq.yellow_section.answer',
    },
    {
      id: 'nothing_to_declare',
      questionKey: 'guide.applicant.applicationForm.faq.nothing_to_declare.question',
      answerKey: 'guide.applicant.applicationForm.faq.nothing_to_declare.answer',
    },
    {
      id: 'edit_after_submit',
      questionKey: 'guide.applicant.applicationForm.faq.edit_after_submit.question',
      answerKey: 'guide.applicant.applicationForm.faq.edit_after_submit.answer',
    },
  ],
});

// TODO: A richer hint (e.g. "You are on Section 3 of 11") would require the
// active section index to be lifted into Redux or a shared context. The form
// currently holds that state locally in ApplicationFormPage. Until that lift
// happens, this resolver is minimal and returns null in most cases.
export function ApplicationFormHint() {
  const location = useLocation();
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const draftIdFromSearch = (() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('draftId');
    return raw ? parseInt(raw, 10) : null;
  })();

  useEffect(() => {
    let cancelled = false;
    getDrafts()
      .then((data) => {
        if (!cancelled) setDrafts(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const activeDraft = draftIdFromSearch
    ? drafts.find((d) => d.id === draftIdFromSearch) ?? null
    : drafts[0] ?? null;

  if (!activeDraft) return null;

  return (
    <SmartHintRenderer
      hint={{
        id: 'applicant.applicationForm.section_in_progress',
        messageKey: 'guide.applicant.applicationForm.hint.section_in_progress.message',
        messageVars: { section: 1 },
        severity: 'info',
      }}
    />
  );
}

registerSmartHintResolver('PARENT_APPLICATION_NEW', ApplicationFormHint);
