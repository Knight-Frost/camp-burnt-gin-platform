<?php

namespace App\Http\Resources;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Canonical shape for a single Document as it appears inside an
 * ApplicationResource payload.
 *
 * Every compliance-relevant attribute is computed on the server and exposed
 * as an explicit boolean or string. The two frontends (admin + applicant)
 * must NOT recompute these — they render directly from the fields here.
 * This is what ends the admin-vs-applicant "expired vs uploaded" divergence.
 *
 * The optional admin/applicant labels are role-appropriate wording for the
 * same underlying state. Callers select the one that matches their viewer.
 */
class ApplicationDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Document $doc */
        $doc = $this->resource;

        $isSubmitted = $doc->submitted_at !== null;
        $isVerified = $doc->isVerified();
        $isExpired = $doc->isExpired();
        $isArchived = $doc->archived_at !== null;

        $type = $doc->document_type;
        $requiresExamDate = in_array($type, [
            'official_medical_form',
            'physical_examination',
        ], true);
        $hasExamDate = $doc->expiration_date !== null;
        $isIncompleteMetadata = $requiresExamDate && $isSubmitted && ! $hasExamDate;

        // Derive exam_date from expiration_date - 1 year (CYSHCN 12-month rule).
        $examDate = null;
        if ($requiresExamDate && $hasExamDate) {
            $examDate = \Carbon\Carbon::parse($doc->expiration_date)
                ->subYear()
                ->format('Y-m-d');
        }

        // Single ground-truth status — what admin and applicant both render from.
        // Exam-date and expiration-date checks are intentionally NOT in this
        // match: the system does not block approval on missing or past
        // exam_date / expiration_date values. The is_expired and
        // is_incomplete_metadata booleans below remain for purely
        // informational display, but they never drive a "Blocks approval"
        // label.
        $complianceStatus = match (true) {
            $isArchived => 'archived',
            ! $isSubmitted => 'draft',
            ! $isVerified => 'unverified',
            default => 'ok',
        };

        return [
            'id' => $doc->id,
            'document_type' => $type,
            'document_type_label' => $this->labelFor($type),
            'original_filename' => $doc->original_filename,
            'mime_type' => $doc->mime_type,
            'file_size' => $doc->file_size,
            'uploaded_at' => $doc->created_at?->toISOString(),
            'submitted_at' => $doc->submitted_at?->toISOString(),
            'verification_status' => $doc->verification_status?->value,
            'expiration_date' => $doc->expiration_date?->format('Y-m-d'),
            'exam_date' => $examDate,

            // Computed compliance booleans. Frontends MUST NOT recompute these.
            'is_submitted' => $isSubmitted,
            'is_verified' => $isVerified,
            'is_expired' => $isExpired,
            'is_archived' => $isArchived,
            'is_incomplete_metadata' => $isIncompleteMetadata,
            'compliance_status' => $complianceStatus,

            // Role-appropriate labels. Admin frontends pick admin_label,
            // applicant frontends pick applicant_label. Same underlying
            // truth, different wording.
            'admin_label' => $this->adminLabelFor($complianceStatus, $type),
            'applicant_label' => $this->applicantLabelFor($complianceStatus, $type),

            // Visibility filter: admin listing endpoints show only submitted
            // + non-draft; applicants can see anything in their own staging.
            'visible_to_admin' => $isSubmitted && ! $isArchived,
        ];
    }

    private function labelFor(string $type): string
    {
        return match ($type) {
            'official_medical_form' => 'Medical Examination Form',
            'immunization_record' => 'Immunization Record',
            'insurance_card' => 'Insurance Card',
            'paper_application_packet' => 'Paper Application Packet',
            'physical_examination' => 'Physical Examination',
            'seizure_action_plan' => 'Seizure Action Plan',
            'emergency_care_plan' => 'Emergency Care Plan',
            default => ucwords(str_replace('_', ' ', $type)),
        };
    }

    private function adminLabelFor(string $status, string $type): string
    {
        $label = $this->labelFor($type);

        return match ($status) {
            'ok' => "$label — verified",
            'draft' => "$label — draft (not submitted by applicant yet)",
            'unverified' => "Pending review: $label awaiting admin verification",
            'archived' => "$label — archived",
            default => $label,
        };
    }

    private function applicantLabelFor(string $status, string $type): string
    {
        $label = $this->labelFor($type);

        return match ($status) {
            'ok' => "$label — submitted and verified",
            'draft' => "$label uploaded — submit to staff to finalize",
            'unverified' => "$label submitted — awaiting staff review",
            'archived' => "$label — archived",
            default => $label,
        };
    }
}
