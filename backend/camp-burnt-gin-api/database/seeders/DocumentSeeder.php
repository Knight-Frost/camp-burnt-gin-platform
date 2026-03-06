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
 * Seeder — document metadata records attached to Applications.
 *
 * Creates Document model records without actual files on disk.
 * All stored_filename and path values are synthetic UUIDs pointing to
 * a non-existent dev/documents/ path. This exercises the document list
 * UI without requiring real file uploads.
 *
 * Documents are attached to Applications (not MedicalRecords) because the
 * ApplicationReviewPage reads application.documents, and camp staff upload
 * compliance documents in the context of reviewing an application.
 *
 * Documents seeded:
 *   Ethan   (approved)      → medical_exam, insurance_card, physician_clearance — all approved
 *   Sofia   (under_review)  → insurance_card (approved), immunization_record (pending)
 *   Ava     (approved)      → medical_exam, insurance_card, physician_clearance, care_plan — all approved
 *   Noah    (rejected/S1)   → medical_exam, insurance_card — approved
 *   Lucas   (pending/S1)    → insurance_card only — pending verification
 *   Mia     (past/approved) → medical_exam, insurance_card — approved (older dates)
 *
 * Lily and Tyler are intentionally left without documents to exercise
 * the "No documents attached" UI state.
 */
class DocumentSeeder extends Seeder
{
    public function run(): void
    {
        $admin   = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

        $session1Past     = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();
        $session1Upcoming = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2Upcoming = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $noah  = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $ava   = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $mia   = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();

        $appEthan = Application::where('camper_id', $ethan->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appSofia = Application::where('camper_id', $sofia->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appNoah  = Application::where('camper_id', $noah->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appAva   = Application::where('camper_id', $ava->id)->where('camp_session_id', $session2Upcoming->id)->first();
        $appLucas = Application::where('camper_id', $lucas->id)->where('camp_session_id', $session1Upcoming->id)->first();
        $appMia   = Application::where('camper_id', $mia->id)->where('camp_session_id', $session1Past->id)->first();

        // Ethan — approved, full verified set
        if ($appEthan && ! Document::where('documentable_id', $appEthan->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appEthan, 'medical_exam',          'Ethan_Johnson_Medical_Exam_2026.pdf',          $admin,   DocumentVerificationStatus::Approved, now()->subDays(15), now()->addYear());
            $this->makeDoc($appEthan, 'insurance_card',        'Ethan_Johnson_BCBS_Insurance_Card.pdf',        $admin,   DocumentVerificationStatus::Approved, now()->subDays(15));
            $this->makeDoc($appEthan, 'physician_clearance',   'Ethan_Johnson_Dr_Hill_Clearance_2026.pdf',     $admin,   DocumentVerificationStatus::Approved, now()->subDays(12), now()->addYear());
        }

        // Sofia — under review: insurance approved, immunization record pending verification
        if ($appSofia && ! Document::where('documentable_id', $appSofia->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appSofia, 'insurance_card',        'Sofia_Martinez_Aetna_Insurance_Card.pdf',      $admin,   DocumentVerificationStatus::Approved, now()->subDays(20));
            $this->makeDoc($appSofia, 'immunization_record',   'Sofia_Martinez_Immunizations.pdf',             $admin,   DocumentVerificationStatus::Pending,  now()->subDays(3));
        }

        // Noah — rejected, documents were on file before rejection
        if ($appNoah && ! Document::where('documentable_id', $appNoah->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appNoah, 'medical_exam',           'Noah_Thompson_Medical_Exam_2026.pdf',          $admin,   DocumentVerificationStatus::Approved, now()->subDays(25), now()->addYear());
            $this->makeDoc($appNoah, 'insurance_card',         'Noah_Thompson_UHC_Insurance_Card.pdf',         $admin,   DocumentVerificationStatus::Approved, now()->subDays(25));
            $this->makeDoc($appNoah, 'physician_clearance',    'Noah_Thompson_Dr_Kim_Clearance_2026.pdf',      $admin,   DocumentVerificationStatus::Approved, now()->subDays(20), now()->addYear());
        }

        // Ava — approved, full set including pump care plan uploaded by medical staff
        if ($appAva && ! Document::where('documentable_id', $appAva->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appAva, 'medical_exam',            'Ava_Williams_Medical_Exam_2026.pdf',           $admin,   DocumentVerificationStatus::Approved, now()->subDays(18), now()->addYear());
            $this->makeDoc($appAva, 'insurance_card',          'Ava_Williams_Cigna_Insurance_Card.pdf',        $admin,   DocumentVerificationStatus::Approved, now()->subDays(18));
            $this->makeDoc($appAva, 'physician_clearance',     'Ava_Williams_Dr_Gonzalez_Clearance_2026.pdf',  $admin,   DocumentVerificationStatus::Approved, now()->subDays(15), now()->addYear());
            $this->makeDoc($appAva, 'care_plan',               'Ava_Williams_OmniPod_Insulin_Protocol.pdf',    $medical, DocumentVerificationStatus::Approved, now()->subDays(8));
        }

        // Lucas — pending, only insurance card uploaded so far
        if ($appLucas && ! Document::where('documentable_id', $appLucas->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appLucas, 'insurance_card',        'Lucas_Williams_Cigna_Insurance_Card.pdf',      $admin,   DocumentVerificationStatus::Pending,  now()->subDays(3));
        }

        // Mia — past session, older approved documents
        if ($appMia && ! Document::where('documentable_id', $appMia->id)->where('documentable_type', Application::class)->exists()) {
            $this->makeDoc($appMia, 'medical_exam',            'Mia_Davis_Medical_Exam_2025.pdf',              $admin,   DocumentVerificationStatus::Approved, now()->subDays(340), now()->subDays(5));
            $this->makeDoc($appMia, 'insurance_card',          'Mia_Davis_Medicaid_Card_2025.pdf',             $admin,   DocumentVerificationStatus::Approved, now()->subDays(340));
        }
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
        $isApproved     = $verificationStatus === DocumentVerificationStatus::Approved;
        $storedFilename = Str::uuid()->toString().'.pdf';

        Document::create([
            'documentable_type'   => Application::class,
            'documentable_id'     => $application->id,
            'message_id'          => null,
            'uploaded_by'         => $uploader->id,
            'original_filename'   => $originalFilename,
            'stored_filename'     => $storedFilename,
            'mime_type'           => 'application/pdf',
            'file_size'           => rand(40000, 800000),
            'disk'                => 'local',
            'path'                => 'dev/documents/'.$storedFilename,
            'document_type'       => $documentType,
            'is_scanned'          => true,
            'scan_passed'         => true,
            'scanned_at'          => $uploadedAt,
            'verification_status' => $verificationStatus,
            'verified_by'         => $isApproved ? $uploader->id : null,
            'verified_at'         => $isApproved ? $uploadedAt : null,
            'expiration_date'     => $expirationDate,
            'created_at'          => $uploadedAt,
            'updated_at'          => $uploadedAt,
        ]);
    }
}
