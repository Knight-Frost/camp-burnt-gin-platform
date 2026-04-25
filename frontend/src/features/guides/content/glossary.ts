import { registerGlossaryTerm } from '@/features/guides';

const TERMS = [
  { id: 'glossary.application',        termKey: 'guide.glossary.application.term',        definitionKey: 'guide.glossary.application.definition' },
  { id: 'glossary.applicant',          termKey: 'guide.glossary.applicant.term',          definitionKey: 'guide.glossary.applicant.definition' },
  { id: 'glossary.camper',             termKey: 'guide.glossary.camper.term',             definitionKey: 'guide.glossary.camper.definition' },
  { id: 'glossary.draft',              termKey: 'guide.glossary.draft.term',              definitionKey: 'guide.glossary.draft.definition' },
  { id: 'glossary.submitted',          termKey: 'guide.glossary.submitted.term',          definitionKey: 'guide.glossary.submitted.definition' },
  { id: 'glossary.under_review',       termKey: 'guide.glossary.under_review.term',       definitionKey: 'guide.glossary.under_review.definition' },
  { id: 'glossary.approved',           termKey: 'guide.glossary.approved.term',           definitionKey: 'guide.glossary.approved.definition' },
  { id: 'glossary.rejected',           termKey: 'guide.glossary.rejected.term',           definitionKey: 'guide.glossary.rejected.definition' },
  { id: 'glossary.waitlisted',         termKey: 'guide.glossary.waitlisted.term',         definitionKey: 'guide.glossary.waitlisted.definition' },
  { id: 'glossary.withdrawn',          termKey: 'guide.glossary.withdrawn.term',          definitionKey: 'guide.glossary.withdrawn.definition' },
  { id: 'glossary.required_document',  termKey: 'guide.glossary.required_document.term',  definitionKey: 'guide.glossary.required_document.definition' },
  { id: 'glossary.requested_document', termKey: 'guide.glossary.requested_document.term', definitionKey: 'guide.glossary.requested_document.definition' },
  { id: 'glossary.mfa',                termKey: 'guide.glossary.mfa.term',                definitionKey: 'guide.glossary.mfa.definition' },
  { id: 'glossary.medical_provider',   termKey: 'guide.glossary.medical_provider.term',   definitionKey: 'guide.glossary.medical_provider.definition' },
  { id: 'glossary.paper_application',  termKey: 'guide.glossary.paper_application.term',  definitionKey: 'guide.glossary.paper_application.definition' },
  { id: 'glossary.digital_application',termKey: 'guide.glossary.digital_application.term',definitionKey: 'guide.glossary.digital_application.definition' },
  { id: 'glossary.hipaa',              termKey: 'guide.glossary.hipaa.term',              definitionKey: 'guide.glossary.hipaa.definition' },
  { id: 'glossary.admin',              termKey: 'guide.glossary.admin.term',              definitionKey: 'guide.glossary.admin.definition' },
  { id: 'glossary.super_admin',        termKey: 'guide.glossary.super_admin.term',        definitionKey: 'guide.glossary.super_admin.definition' },
  { id: 'glossary.session',            termKey: 'guide.glossary.session.term',            definitionKey: 'guide.glossary.session.definition' },
  { id: 'glossary.inbox',              termKey: 'guide.glossary.inbox.term',              definitionKey: 'guide.glossary.inbox.definition' },
  { id: 'glossary.archived',           termKey: 'guide.glossary.archived.term',           definitionKey: 'guide.glossary.archived.definition' },
  { id: 'glossary.phi',                termKey: 'guide.glossary.phi.term',                definitionKey: 'guide.glossary.phi.definition' },
] as const;

for (const term of TERMS) {
  registerGlossaryTerm(term);
}
