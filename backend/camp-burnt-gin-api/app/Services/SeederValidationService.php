<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Camper;
use App\Models\Document;
use App\Models\MedicalRecord;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * SeederValidationService — post-seed integrity gate for DevSeeder.
 *
 * Runs a suite of assertions after DevSeeder completes. Any failure throws a
 * RuntimeException with the full list of violations, halting the seed process.
 *
 * This is NOT production validation — it is a developer safety net that ensures
 * the seeded state matches the contract: "10 families fully completed their
 * applications but stopped right before uploading required documents."
 *
 * ─── ASSERTIONS ─────────────────────────────────────────────────────────────
 *
 *   ✔ All applications are draft (is_draft=true, submitted_at=null)
 *   ✔ No non-draft applications exist
 *   ✔ All narrative fields populated on every application
 *   ✔ No required upload documents exist (official_medical_form, immunization_record, insurance_card)
 *   ✔ Every camper has a valid parent user
 *   ✔ Every application references a valid camper and session
 *   ✔ Every camper has at least one emergency contact
 *   ✔ Every camper has a medical record
 *   ✔ No orphan diagnoses, medications, or allergies
 *
 * Usage:
 *   SeederValidationService::assertValid();   // throws on failure
 *   $errors = SeederValidationService::validate();  // returns error list
 */
class SeederValidationService
{
    /**
     * Run all assertions and throw if any fail.
     *
     * @throws RuntimeException listing every violated assertion
     */
    public static function assertValid(): void
    {
        $errors = self::validate();

        if (empty($errors)) {
            return;
        }

        $message = sprintf(
            "\n\n  SeederValidationService: %d assertion(s) failed:\n",
            count($errors)
        );

        foreach ($errors as $i => $error) {
            $message .= sprintf("    [%d] %s\n", $i + 1, $error);
        }

        $message .= "\n  Fix the seeder and re-run: php artisan migrate:fresh --seed\n";

        throw new RuntimeException($message);
    }

    /**
     * Run all assertions and return error messages.
     *
     * @return list<string>
     */
    public static function validate(): array
    {
        return array_merge(
            self::checkAllApplicationsAreDraft(),
            self::checkNarrativeFieldsPopulated(),
            self::checkNoRequiredUploads(),
            self::checkRelationshipsValid(),
            self::checkNoOrphanClinicalRecords(),
        );
    }

    // ── Assertion: All applications must be draft ────────────────────────────

    private static function checkAllApplicationsAreDraft(): array
    {
        $errors = [];

        $nonDraft = Application::where('status', '!=', \App\Enums\ApplicationStatus::Draft->value)->count();
        if ($nonDraft > 0) {
            $errors[] = "Found {$nonDraft} application(s) with status != 'draft'. "
                .'DevSeeder must only create draft applications (status=draft).';
        }

        $withSubmittedAt = Application::whereNotNull('submitted_at')->count();
        if ($withSubmittedAt > 0) {
            $errors[] = "Found {$withSubmittedAt} application(s) with submitted_at IS NOT NULL. "
                .'Draft applications must have submitted_at=NULL.';
        }

        $withSignedAt = Application::whereNotNull('signed_at')->count();
        if ($withSignedAt > 0) {
            $errors[] = "Found {$withSignedAt} application(s) with signed_at set. "
                .'Draft applications must not have a signature timestamp.';
        }

        return $errors;
    }

    // ── Assertion: All narrative fields populated ────────────────────────────

    private static function checkNarrativeFieldsPopulated(): array
    {
        $errors = [];

        $narrativeFields = [
            'narrative_rustic_environment',
            'narrative_staff_suggestions',
            'narrative_participation_concerns',
            'narrative_camp_benefit',
            'narrative_heat_tolerance',
            'narrative_transportation',
            'narrative_additional_info',
            'narrative_emergency_protocols',
        ];

        foreach ($narrativeFields as $field) {
            $count = Application::where('status', \App\Enums\ApplicationStatus::Draft->value)->whereNull($field)->count();
            if ($count > 0) {
                $errors[] = "Found {$count} draft application(s) with NULL {$field}. "
                    .'All narrative fields must be populated for a logically complete application.';
            }
        }

        $requiredCamperFields = [
            'first_name', 'last_name', 'date_of_birth', 'gender', 'tshirt_size',
            'applicant_address', 'applicant_city', 'applicant_state', 'applicant_zip',
        ];
        foreach ($requiredCamperFields as $field) {
            $count = Camper::whereNull($field)->count();
            if ($count > 0) {
                $errors[] = "Found {$count} camper(s) with NULL {$field}. All camper fields must be populated.";
            }
        }

        $requiredMedicalFields = ['physician_name', 'physician_phone', 'insurance_provider'];
        foreach ($requiredMedicalFields as $field) {
            $count = MedicalRecord::whereNull($field)->count();
            if ($count > 0) {
                $errors[] = "Found {$count} medical record(s) with NULL {$field}.";
            }
        }

        return $errors;
    }

    // ── Assertion: No required upload documents ──────────────────────────────

    private static function checkNoRequiredUploads(): array
    {
        $errors = [];

        $blockedTypes = ['official_medical_form', 'immunization_record', 'insurance_card'];

        foreach ($blockedTypes as $type) {
            $count = Document::where('document_type', $type)
                ->whereNull('archived_at')
                ->count();

            if ($count > 0) {
                $errors[] = "Found {$count} active document(s) of type '{$type}'. "
                    .'DevSeeder must not create required upload documents — '
                    .'applications should be blocked only by these missing uploads.';
            }
        }

        return $errors;
    }

    // ── Assertion: Relationships valid ───────────────────────────────────────

    private static function checkRelationshipsValid(): array
    {
        $errors = [];

        // Every camper must have a parent user
        $orphanCampers = Camper::whereDoesntHave('user')->count();
        if ($orphanCampers > 0) {
            $errors[] = "Found {$orphanCampers} camper(s) without a valid user_id. Every camper must belong to an applicant user.";
        }

        // Every application must reference a valid camper
        $orphanApps = Application::whereDoesntHave('camper')->count();
        if ($orphanApps > 0) {
            $errors[] = "Found {$orphanApps} application(s) without a valid camper. Broken foreign key.";
        }

        // Every application must have a camp session
        $noSession = Application::whereNull('camp_session_id')->count();
        if ($noSession > 0) {
            $errors[] = "Found {$noSession} application(s) with NULL camp_session_id. All applications need a session.";
        }

        // Every camper must have at least one emergency contact
        $noContact = Camper::whereDoesntHave('emergencyContacts')->count();
        if ($noContact > 0) {
            $errors[] = "Found {$noContact} camper(s) without any emergency contacts. Each camper needs at least one.";
        }

        // Every camper must have a medical record
        $noMedical = Camper::whereDoesntHave('medicalRecord')->count();
        if ($noMedical > 0) {
            $errors[] = "Found {$noMedical} camper(s) without a medical record.";
        }

        return $errors;
    }

    // ── Assertion: No orphan clinical records ────────────────────────────────

    private static function checkNoOrphanClinicalRecords(): array
    {
        $errors = [];

        $tables = [
            'diagnoses' => 'diagnosis',
            'medications' => 'medication',
            'allergies' => 'allergy',
        ];

        foreach ($tables as $table => $label) {
            $orphans = DB::table($table)
                ->leftJoin('campers', "{$table}.camper_id", '=', 'campers.id')
                ->whereNull('campers.id')
                ->count();

            if ($orphans > 0) {
                $errors[] = "Found {$orphans} orphan {$label} record(s) referencing a non-existent camper.";
            }
        }

        return $errors;
    }
}
