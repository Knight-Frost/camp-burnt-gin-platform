<?php

namespace Database\Seeders;

use App\Enums\DocumentVerificationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — document metadata records.
 *
 * Creates Document model records without actual files on disk.
 * All stored_filename and path values are synthetic UUIDs.
 *
 * Part 1 — Application documents (uploaded by admin/medical for compliance review):
 *
 *   All three universal required documents (official_medical_form, immunization_record,
 *   insurance_card) are seeded for every approved/reviewed application to ensure the
 *   compliance engine and admin UI agree on document state.
 *
 *   Ethan (Approved, S1 2026) — full verified set including seizure-specific documents
 *     (seizure_action_plan, seizure_medication_authorization — required by
 *     RequiredDocumentRuleSeeder for condition_flag=seizures) and supervision_justification
 *     (required for enhanced supervision level).
 *
 *   Sofia (Under Review, S1 2026) — official_medical_form on file (pending verification),
 *     insurance_card approved, immunization_record pending. Admin notes cite only these
 *     two as outstanding; medical form was received but not yet verified.
 *
 *   Noah (Rejected, S1 2026) — full set was on file before rejection. Immunization record
 *     included to reflect state at time of review.
 *
 *   Ava (Approved, S2 2026) — full set including immunization_record, supervision_justification
 *     (enhanced supervision), and OmniPod insulin protocol (medical_care_plan).
 *
 *   Lucas (Submitted, S1 2026) — only insurance_card uploaded so far. Remaining docs
 *     pending from family. This is intentional — tests incomplete-document submission flow.
 *
 *   Mia (Approved, S1 2025 past) — full set (official_medical_form now expired — realistic
 *     for a past session record). immunization_record included.
 *
 *   Henry (Approved, S1 2026 — paper application) — all documents admin-entered manually
 *     from scanned paper packet. Admin notes confirm all are verified.
 *
 * Part 2 — Applicant-uploaded documents (attached to Campers, uploaded by parent):
 *   Sarah Johnson  → Ethan: photo_id (approved)
 *   Sarah Johnson  → Lily:  medical_waiver (pending)
 *   David Martinez → Sofia: allergy_action_plan (pending)
 *   Michael Williams → Ava: insulin_protocol (approved), emergency_contacts (approved)
 *
 * These exercise the applicant /documents page and the admin Documents inbox.
 *
 * NOTE — Idempotency: Each application block guards on whether ANY document exists for
 * that application. On re-seed without migrate:fresh, new document types added to an
 * already-seeded application will not be created. Always use migrate:fresh --seed for
 * a complete reset.
 */
class DocumentSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

        $session1Past = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();
        $session1Upcoming = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2Upcoming = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $ava = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $henry = Camper::where('first_name', 'Henry')->where('last_name', 'Carter')->firstOrFail();

        $appEthan = Application::where('camper_id', $ethan->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appSofia = Application::where('camper_id', $sofia->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appNoah = Application::where('camper_id', $noah->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appAva = Application::where('camper_id', $ava->id)->where('camp_session_id', $session2Upcoming->id)->first();
        $appLucas = Application::where('camper_id', $lucas->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appMia = Application::where('camper_id', $mia->id)->where('camp_session_id', $session1Past->id)->first();
        $appHenry = Application::where('camper_id', $henry->id)->where('camp_session_id', $session1Upcoming->id)->first();

        // Ethan — approved, full verified set.
        // Universal docs: official_medical_form + immunization_record + insurance_card.
        // Seizure-specific docs (condition_flag=seizures, Epilepsy diagnosis):
        //   seizure_action_plan + seizure_medication_authorization — admin note
        //   confirms "Seizure action plan received from Dr. Hill."
        // Enhanced supervision: supervision_justification required per RequiredDocumentRuleSeeder.
        if ($appEthan && ! Document::where('documentable_id', $appEthan->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appEthan, 'official_medical_form', 'Ethan_Johnson_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15), now()->addYear());
            $this->makeDoc($appEthan, 'immunization_record', 'Ethan_Johnson_Immunization_Record_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15));
            $this->makeDoc($appEthan, 'insurance_card', 'Ethan_Johnson_BCBS_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15));
            $this->makeDoc($appEthan, 'physician_clearance', 'Ethan_Johnson_Dr_Hill_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12), now()->addYear());
            $this->makeDoc($appEthan, 'seizure_action_plan', 'Ethan_Johnson_Seizure_Action_Plan_Dr_Hill.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12), now()->addYear());
            $this->makeDoc($appEthan, 'seizure_medication_authorization', 'Ethan_Johnson_Diastat_Authorization.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12), now()->addYear());
            $this->makeDoc($appEthan, 'supervision_justification', 'Ethan_Johnson_Enhanced_Supervision_Justification.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(14), now()->addYear());
        }

        // Sofia — under review: official_medical_form received but pending verification,
        // insurance_card approved, immunization_record pending. Admin notes cite only
        // immunization + physician clearance as outstanding — medical form is on file.
        if ($appSofia && ! Document::where('documentable_id', $appSofia->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appSofia, 'official_medical_form', 'Sofia_Martinez_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Pending, now()->subDays(18));
            $this->makeDoc($appSofia, 'insurance_card', 'Sofia_Martinez_Aetna_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(20));
            $this->makeDoc($appSofia, 'immunization_record', 'Sofia_Martinez_Immunizations.pdf', $admin, DocumentVerificationStatus::Pending, now()->subDays(3));
        }

        // Noah — rejected (capacity constraint), full document set was on file before rejection.
        // All three universal docs included to reflect state at time of review.
        if ($appNoah && ! Document::where('documentable_id', $appNoah->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appNoah, 'official_medical_form', 'Noah_Thompson_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(25), now()->addYear());
            $this->makeDoc($appNoah, 'immunization_record', 'Noah_Thompson_Immunization_Record.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(25));
            $this->makeDoc($appNoah, 'insurance_card', 'Noah_Thompson_UHC_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(25));
            $this->makeDoc($appNoah, 'physician_clearance', 'Noah_Thompson_Dr_Kim_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(20), now()->addYear());
        }

        // Ava — approved, full set including pump care plan uploaded by medical staff.
        // Universal docs: official_medical_form + immunization_record + insurance_card.
        // Enhanced supervision: supervision_justification required per RequiredDocumentRuleSeeder.
        // OmniPod insulin protocol (medical_care_plan) uploaded by medical staff.
        if ($appAva && ! Document::where('documentable_id', $appAva->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appAva, 'official_medical_form', 'Ava_Williams_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(18), now()->addYear());
            $this->makeDoc($appAva, 'immunization_record', 'Ava_Williams_Immunization_Record_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(18));
            $this->makeDoc($appAva, 'insurance_card', 'Ava_Williams_Cigna_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(18));
            $this->makeDoc($appAva, 'physician_clearance', 'Ava_Williams_Dr_Gonzalez_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(15), now()->addYear());
            $this->makeDoc($appAva, 'medical_care_plan', 'Ava_Williams_OmniPod_Insulin_Protocol.pdf', $medical, DocumentVerificationStatus::Approved, now()->subDays(8));
            $this->makeDoc($appAva, 'supervision_justification', 'Ava_Williams_Enhanced_Supervision_Justification_Dr_Gonzalez.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(16), now()->addYear());
        }

        // Lucas — pending, only insurance card uploaded so far
        if ($appLucas && ! Document::where('documentable_id', $appLucas->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appLucas, 'insurance_card', 'Lucas_Williams_Cigna_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Pending, now()->subDays(3));
        }

        // Mia — past session (Summer 2025), older approved documents.
        // official_medical_form expiration date is now()->subDays(5) — realistic for a
        // past-session record (the 12-month exam from 2025 has since expired).
        // immunization_record has no expiration (records don't expire).
        if ($appMia && ! Document::where('documentable_id', $appMia->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appMia, 'official_medical_form', 'Mia_Davis_Medical_Exam_2025.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(340), now()->subDays(5));
            $this->makeDoc($appMia, 'immunization_record', 'Mia_Davis_Immunization_Record_2025.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(340));
            $this->makeDoc($appMia, 'insurance_card', 'Mia_Davis_Medicaid_Card_2025.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(340));
        }

        // Henry — paper application approved (admin manually entered from physical form).
        // Admin notes confirm: "All documents verified (immunization record, physician
        // clearance, medication authorization)." All documents admin-uploaded as part
        // of the paper-packet scanning workflow. signed_ip_address=null on the
        // application confirms paper signature.
        if ($appHenry && ! Document::where('documentable_id', $appHenry->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appHenry, 'official_medical_form', 'Henry_Carter_Medical_Exam_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12), now()->addYear());
            $this->makeDoc($appHenry, 'immunization_record', 'Henry_Carter_Immunization_Record.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12));
            $this->makeDoc($appHenry, 'insurance_card', 'Henry_Carter_UHC_Insurance_Card.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(12));
            $this->makeDoc($appHenry, 'physician_clearance', 'Henry_Carter_Dr_Huang_Clearance_2026.pdf', $admin, DocumentVerificationStatus::Approved, now()->subDays(10), now()->addYear());
        }

        // ── Part 2: Applicant-uploaded documents (attached to Campers) ─────────────
        // These are documents that parents upload themselves in the Applicant portal.

        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $michael = User::where('email', 'michael.williams@example.com')->firstOrFail();

        $lily = Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail();

        // Sarah → Ethan: photo ID (approved).
        // NOTE: Ethan's immunization_record is now seeded at the application level (Part 1)
        // as an admin-uploaded verified document — that is the compliance-authoritative copy.
        // This block only seeds the supplemental camper-profile photo ID.
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $ethan->id)->where('uploaded_by', $sarah->id)->exists()) {
            $this->makeCamperDoc($ethan, 'photo_id', 'Ethan_Johnson_State_ID.pdf', $sarah, DocumentVerificationStatus::Approved, now()->subDays(10));
        }

        // Sarah → Lily: medical waiver (pending)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $lily->id)->where('uploaded_by', $sarah->id)->exists()) {
            $this->makeCamperDoc($lily, 'medical_waiver', 'Lily_Johnson_Medical_Waiver.pdf', $sarah, DocumentVerificationStatus::Pending, now()->subDays(2));
        }

        // David → Sofia: allergy action plan (pending)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $sofia->id)->where('uploaded_by', $david->id)->exists()) {
            $this->makeCamperDoc($sofia, 'allergy_action_plan', 'Sofia_Martinez_Allergy_Plan.pdf', $david, DocumentVerificationStatus::Pending, now()->subDays(6));
        }

        // Michael → Ava: insulin protocol (approved) + emergency contacts form (approved)
        if (! Document::where('documentable_type', Camper::class)->where('documentable_id', $ava->id)->where('uploaded_by', $michael->id)->exists()) {
            $this->makeCamperDoc($ava, 'insulin_protocol', 'Ava_Williams_Insulin_Protocol.pdf', $michael, DocumentVerificationStatus::Approved, now()->subDays(14));
            $this->makeCamperDoc($ava, 'emergency_contacts', 'Ava_Williams_Emergency_Contacts.pdf', $michael, DocumentVerificationStatus::Approved, now()->subDays(14));
        }
    }

    private function makeCamperDoc(
        Camper $camper,
        string $documentType,
        string $originalFilename,
        User $uploader,
        DocumentVerificationStatus $verificationStatus,
        \DateTimeInterface $uploadedAt,
        ?\DateTimeInterface $expirationDate = null
    ): void {
        $isApproved = $verificationStatus === DocumentVerificationStatus::Approved;
        $storedFilename = Str::uuid()->toString().'.pdf';

        // Resolve admin verifier from the DB rather than hardcoding a user ID.
        static $adminVerifier = null;
        if ($isApproved && $adminVerifier === null) {
            $adminVerifier = User::whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']))->first();
        }

        Document::create([
            'documentable_type' => Camper::class,
            'documentable_id' => $camper->id,
            'message_id' => null,
            'uploaded_by' => $uploader->id,
            'original_filename' => $originalFilename,
            'stored_filename' => $storedFilename,
            'mime_type' => 'application/pdf',
            'file_size' => rand(30000, 600000),
            'disk' => 'local',
            'path' => 'dev/documents/'.$storedFilename,
            'document_type' => $documentType,
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => $uploadedAt,
            'verification_status' => $verificationStatus,
            'verified_by' => $isApproved ? $adminVerifier?->id : null,
            'verified_at' => $isApproved ? $uploadedAt : null,
            'expiration_date' => $expirationDate,
            'submitted_at' => $uploadedAt,
            'created_at' => $uploadedAt,
            'updated_at' => $uploadedAt,
        ]);
    }

    private function makeDoc(
        Application $application,
        string $documentType,
        string $originalFilename,
        User $uploader,
        DocumentVerificationStatus $verificationStatus,
        \DateTimeInterface $uploadedAt,
        ?\DateTimeInterface $expirationDate = null
    ): void {
        $isApproved = $verificationStatus === DocumentVerificationStatus::Approved;
        $storedFilename = Str::uuid()->toString().'.pdf';

        Document::create([
            'documentable_type' => Application::class,
            'documentable_id' => $application->id,
            'message_id' => null,
            'uploaded_by' => $uploader->id,
            'original_filename' => $originalFilename,
            'stored_filename' => $storedFilename,
            'mime_type' => 'application/pdf',
            'file_size' => rand(40000, 800000),
            'disk' => 'local',
            'path' => 'dev/documents/'.$storedFilename,
            'document_type' => $documentType,
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => $uploadedAt,
            'verification_status' => $verificationStatus,
            'verified_by' => $isApproved ? $uploader->id : null,
            'verified_at' => $isApproved ? $uploadedAt : null,
            'expiration_date' => $expirationDate,
            'submitted_at' => $uploadedAt,
            'created_at' => $uploadedAt,
            'updated_at' => $uploadedAt,
        ]);
    }
}
