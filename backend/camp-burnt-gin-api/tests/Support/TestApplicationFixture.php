<?php

namespace Tests\Support;

use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\Camper;
use App\Models\Document;

/**
 * Shared fixture helpers for tests that need a draft application whose
 * data passes the ApplicationCompletenessService engine. The engine
 * validates all 11 sections; constructing a "minimal but valid" fixture
 * by hand in every test is both verbose and brittle when the rules
 * tighten. This helper centralises the minimum contract.
 *
 * Usage:
 *
 *   TestApplicationFixture::buildCamperMinimum($camper);
 *   $app = Application::factory()->create([
 *       'camper_id'         => $camper->id,
 *       'status' => 'draft',
 *       'signed_at'         => now(),
 *       'sections_reviewed' => TestApplicationFixture::reviewedOptionalSections(),
 *       ...
 *   ]);
 *   TestApplicationFixture::attachConsents($app);
 *   TestApplicationFixture::attachRequiredDocuments($camper);
 */
class TestApplicationFixture
{
    /** Applies every camper-level minimum the engine validates. */
    public static function buildCamperMinimum(Camper $camper): void
    {
        $camper->update([
            'first_name' => $camper->first_name ?: 'Athena',
            'last_name' => $camper->last_name ?: 'Wicker',
            'date_of_birth' => $camper->date_of_birth ?: '2015-01-01',
            'gender' => $camper->gender ?: 'female',
            'tshirt_size' => $camper->tshirt_size ?: 'Youth M',
            'county' => $camper->county ?: 'Richland',
        ]);

        if ($camper->emergencyContacts()->count() === 0) {
            $camper->emergencyContacts()->create([
                'name' => 'Jane Parent',
                'relationship' => 'Mother',
                'phone_primary' => '803-555-0100',
            ]);
        }

        $mr = $camper->medicalRecord()->firstOrCreate([]);
        // The engine's insurance rule (2026-04-23) requires an explicit
        // insurance_type — 'other' with a provider is the equivalent of the
        // pre-audit "some private insurance" state these fixtures previously
        // represented implicitly.
        if (empty($mr->physician_name) || empty($mr->insurance_provider) || empty($mr->insurance_type)) {
            $mr->update([
                'physician_name' => $mr->physician_name ?: 'Dr. Test Physician',
                'insurance_type' => $mr->insurance_type ?: 'other',
                'insurance_provider' => $mr->insurance_provider ?: 'Test Insurance Co',
                'insurance_policy_number' => $mr->insurance_policy_number ?: 'POL-TEST-001',
            ]);
        }

        if ($camper->diagnoses()->count() === 0) {
            $camper->diagnoses()->create([
                'name' => 'Cerebral palsy',
                'severity_level' => 'moderate',
            ]);
        }

        // Personal care plan — every ADL level set to a valid enum value.
        if (! $camper->personalCarePlan) {
            $camper->personalCarePlan()->create([
                'bathing_level' => 'independent',
                'toileting_level' => 'independent',
                'dressing_level' => 'independent',
                'oral_hygiene_level' => 'independent',
            ]);
        }

        // Canonical activity permissions — one row per activity slug that
        // ApplicationCompletenessService::CANONICAL_ACTIVITIES requires.
        $activities = [
            'sports_games', 'arts_crafts', 'nature', 'fine_arts',
            'swimming', 'boating', 'camp_out',
        ];
        $existing = $camper->activityPermissions()->pluck('activity_name')->all();
        foreach ($activities as $slug) {
            if (! in_array($slug, $existing, true)) {
                $camper->activityPermissions()->create([
                    'activity_name' => $slug,
                    'permission_level' => 'yes',
                ]);
            }
        }
    }

    /**
     * Per-application review timestamps for every data-bearing section the
     * engine requires. Apply this to any draft fixture that is expected to
     * pass the completeness gate — without it, sections that otherwise look
     * complete (camper, health, personal_care, activities) now correctly
     * report as "not yet reviewed for this application."
     *
     * Submitted applications don't need this set — the engine treats any
     * non-draft application as implicitly reviewed to preserve historical
     * records.
     */
    public static function reviewedOptionalSections(): array
    {
        $ts = now()->toISOString();

        return [
            'camper' => $ts,
            'health' => $ts,
            'behavior' => $ts,
            'equipment' => $ts,
            'diet' => $ts,
            'personal_care' => $ts,
            'activities' => $ts,
            'medications' => $ts,
            'narratives' => $ts,
        ];
    }

    /**
     * Explicit "nothing to declare" attestations for the four hybrid
     * sections (behavior, equipment, diet, medications). The completeness
     * engine treats these as complete-when-empty only if the parent has
     * affirmatively attested — separate from "did the parent visit the
     * section". Apply alongside reviewedOptionalSections() on any draft
     * fixture that does not provide actual behavior/diet/medication data.
     *
     * Submitted (non-draft) applications don't need this — the engine
     * implicitly accepts any non-draft as attested to preserve history.
     */
    public static function attestedOptionalSections(): array
    {
        return [
            'behavior' => true,
            'equipment' => true,
            'diet' => true,
            'medications' => true,
        ];
    }

    /** Creates the 7 required ApplicationConsent rows for the app. */
    public static function attachConsents(Application $app, string $guardianName = 'Jane Parent'): void
    {
        $types = ['general', 'photos', 'liability', 'activity', 'authorization', 'medication', 'hipaa'];
        $existing = $app->consents()->pluck('consent_type')->all();
        foreach ($types as $type) {
            if (! in_array($type, $existing, true)) {
                ApplicationConsent::create([
                    'application_id' => $app->id,
                    'consent_type' => $type,
                    'guardian_name' => $guardianName,
                    'guardian_relationship' => 'Mother',
                    'guardian_signature' => $guardianName,
                    'signed_at' => now(),
                ]);
            }
        }
    }

    /** Creates the universal required documents, submitted + verified. */
    public static function attachRequiredDocuments(Camper $camper): void
    {
        $types = ['official_medical_form', 'immunization_record', 'insurance_card'];
        foreach ($types as $type) {
            $existing = Document::query()
                ->where('documentable_type', Camper::class)
                ->where('documentable_id', $camper->id)
                ->where('document_type', $type)
                ->whereNull('archived_at')
                ->first();
            if ($existing) {
                continue;
            }
            Document::create([
                'documentable_type' => Camper::class,
                'documentable_id' => $camper->id,
                'document_type' => $type,
                'original_filename' => $type.'.pdf',
                'stored_filename' => $type.'.pdf',
                'path' => 'documents/'.$type.'.pdf',
                'mime_type' => 'application/pdf',
                'file_size' => 1024,
                'uploaded_by' => $camper->user_id,
                'submitted_at' => now(),
                'is_verified' => true,
                'verification_status' => 'approved',
                'expiration_date' => $type === 'official_medical_form' ? now()->addYear() : null,
                'exam_date' => $type === 'official_medical_form' ? now()->subMonth() : null,
            ]);
        }
    }
}
