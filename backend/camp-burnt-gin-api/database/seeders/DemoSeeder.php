<?php

namespace Database\Seeders;

use App\Enums\ActivityPermissionLevel;
use App\Enums\ApplicationStatus;
use App\Enums\DiagnosisSeverity;
use App\Enums\DocumentVerificationStatus;
use App\Models\ActivityPermission;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Diagnosis;
use App\Models\Document;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use App\Models\Role;
use App\Models\User;
use App\Models\UserEmergencyContact;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * DemoSeeder — polished, minimal dataset for stakeholder demos and onboarding.
 *
 * Builds on MinimalSeeder (roles, document rules, activity permissions config,
 * form definitions, risk engine, super admin account).
 *
 * ─── PURPOSE ────────────────────────────────────────────────────────────────
 *
 *   Designed to make every portal immediately useful after a fresh seed.
 *   Small enough to understand at a glance; realistic enough to demo.
 *   Use this mode for: demos, presentations, onboarding, applicant portal testing.
 *
 *   For a full developer dataset (all statuses, edge cases, ~76 campers),
 *   use SEED_MODE=development instead.
 *
 * ─── ACCOUNTS ───────────────────────────────────────────────────────────────
 *
 *   Super Admin : admin.campburntgin@gmail.com     ADMIN_BOOTSTRAP_PASSWORD (Admin1234! in .env)
 *   Admin       : coordinator@campburntgin.org  password
 *   Medical     : medical@campburntgin.org       password
 *   Applicant 1 : sarah.johnson@example.com      password  (2 children)
 *   Applicant 2 : david.martinez@example.com     password  (1 child)
 *
 * ─── DATA OVERVIEW ──────────────────────────────────────────────────────────
 *
 *   Camp session : Session 1 — Summer 2026 (open, accepting applications)
 *   Campers      : 3 (Ethan Johnson, Lily Johnson, Sofia Martinez)
 *   Applications : 3
 *     - Ethan Johnson  → approved   (admin dashboard: enrolled count, medical access)
 *     - Lily Johnson   → submitted  (admin dashboard: review queue)
 *     - Sofia Martinez → under_review (admin dashboard: in-progress review with notes)
 *   Medical records: Ethan (active, visible to medical portal)
 *   Documents      : 3 verified required docs for Ethan (visible to admin + medical)
 *
 * ─── WHAT EACH PORTAL CAN DO ────────────────────────────────────────────────
 *
 *   Super Admin    → all of the below + system config, user management
 *   Admin          → sees 2 apps in review queue (Lily + Sofia), Ethan enrolled,
 *                    dashboard counts meaningful, can open each application
 *   Medical        → sees Ethan's active camper record, diagnosis, documents
 *   sarah.johnson  → sees Ethan (approved) and Lily (submitted) in applicant portal
 *   david.martinez → sees Sofia (under review) in applicant portal
 *
 * ─── HOW TO RUN ─────────────────────────────────────────────────────────────
 *
 *   php artisan migrate:fresh --seed          (this is the default mode)
 *   SEED_MODE=demo php artisan migrate:fresh --seed
 *   php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // System scaffolding + super admin account.
        $this->call(MinimalSeeder::class);

        $this->command->newLine();
        $this->command->info('Seeding demo data...');

        $adminRole = Role::where('name', 'admin')->firstOrFail();
        $medicalRole = Role::where('name', 'medical')->firstOrFail();
        $applicantRole = Role::where('name', 'applicant')->firstOrFail();

        // ── Staff accounts ────────────────────────────────────────────────────

        $admin = User::firstOrCreate(
            ['email' => 'coordinator@campburntgin.org'],
            [
                'name' => 'Alex Rivera',
                'role_id' => $adminRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0002',
                'address_line_1' => '112 Blanding Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29201',
                'country' => 'US',
                'preferred_name' => 'Alex',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        UserEmergencyContact::firstOrCreate(
            ['user_id' => $admin->id],
            ['name' => 'Carmen Rivera', 'relationship' => 'Spouse', 'phone' => '803-555-0003', 'email' => 'carmen.rivera@example.com']
        );

        User::firstOrCreate(
            ['email' => 'medical@campburntgin.org'],
            [
                'name' => 'Dr. Morgan Chen',
                'role_id' => $medicalRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0005',
                'address_line_1' => '1 Medical Park Drive',
                'city' => 'Orangeburg',
                'state' => 'SC',
                'postal_code' => '29115',
                'country' => 'US',
                'preferred_name' => 'Dr. Chen',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // ── Applicant family 1: Johnson (2 children) ──────────────────────────

        $sarah = User::firstOrCreate(
            ['email' => 'sarah.johnson@example.com'],
            [
                'name' => 'Sarah Johnson',
                'role_id' => $applicantRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0121',
                'address_line_1' => '2847 Devine Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29205',
                'country' => 'US',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // Ethan (13, enhanced supervision — seizure protocol + ASD)
        $ethan = Camper::firstOrCreate(
            ['user_id' => $sarah->id, 'first_name' => 'Ethan', 'last_name' => 'Johnson'],
            [
                'date_of_birth' => '2013-04-12',
                'gender' => 'male',
                'tshirt_size' => 'YL',
                'supervision_level' => 'enhanced',
                'county' => 'Richland',
                'needs_interpreter' => false,
                'is_active' => false,
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $ethan->id, 'name' => 'Robert Johnson'],
            [
                'relationship' => 'Father',
                'phone_primary' => '803-555-0122',
                'phone_secondary' => '803-555-0123',
                'email' => 'robert.johnson@example.com',
                'is_primary' => true,
                'is_authorized_pickup' => true,
            ]
        );

        // Lily (11, standard supervision)
        $lily = Camper::firstOrCreate(
            ['user_id' => $sarah->id, 'first_name' => 'Lily', 'last_name' => 'Johnson'],
            [
                'date_of_birth' => '2015-08-22',
                'gender' => 'female',
                'tshirt_size' => 'YM',
                'supervision_level' => 'standard',
                'county' => 'Richland',
                'needs_interpreter' => false,
                'is_active' => false,
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $lily->id, 'name' => 'Robert Johnson'],
            [
                'relationship' => 'Father',
                'phone_primary' => '803-555-0122',
                'email' => 'robert.johnson@example.com',
                'is_primary' => true,
                'is_authorized_pickup' => true,
            ]
        );

        // ── Applicant family 2: Martinez (1 child) ────────────────────────────

        $david = User::firstOrCreate(
            ['email' => 'david.martinez@example.com'],
            [
                'name' => 'David Martinez',
                'role_id' => $applicantRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0131',
                'address_line_1' => '410 Assembly Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29201',
                'country' => 'US',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // Sofia (12, enhanced supervision — spina bifida, catheterization)
        $sofia = Camper::firstOrCreate(
            ['user_id' => $david->id, 'first_name' => 'Sofia', 'last_name' => 'Martinez'],
            [
                'date_of_birth' => '2014-02-15',
                'gender' => 'female',
                'tshirt_size' => 'YM',
                'supervision_level' => 'enhanced',
                'county' => 'Richland',
                'needs_interpreter' => false,
                'is_active' => false,
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $sofia->id, 'name' => 'Maria Martinez'],
            [
                'relationship' => 'Mother',
                'phone_primary' => '803-555-0132',
                'email' => 'maria.martinez@example.com',
                'is_primary' => true,
                'is_authorized_pickup' => true,
            ]
        );

        // ── Activity permissions (canonical slugs — must match completeness engine) ──

        $this->seedActivityPermissions($ethan, [
            'sports_games' => ActivityPermissionLevel::Yes,
            'arts_crafts' => ActivityPermissionLevel::Yes,
            'nature' => ActivityPermissionLevel::Yes,
            'fine_arts' => ActivityPermissionLevel::Yes,
            // Seizure protocol: swimming and boating require supervision confirmation
            'swimming' => ActivityPermissionLevel::Restricted,
            'boating' => ActivityPermissionLevel::Restricted,
            'camping' => ActivityPermissionLevel::Yes,
            'camp_out' => ActivityPermissionLevel::Yes,
        ], [
            'swimming' => 'Seizure action plan on file with Dr. Hill. Must have dedicated water safety supervisor within arm\'s reach at all times. No participation if seizing within 24 hours.',
            'boating' => 'Same seizure protocol as swimming. Life vest required. Buddy system mandatory. Counselor must remain physically adjacent.',
        ]);

        $this->seedActivityPermissions($lily, array_fill_keys([
            'sports_games', 'arts_crafts', 'nature', 'fine_arts',
            'swimming', 'boating', 'camping', 'camp_out',
        ], ActivityPermissionLevel::Yes));

        $this->seedActivityPermissions($sofia, [
            'sports_games' => ActivityPermissionLevel::Yes,
            'arts_crafts' => ActivityPermissionLevel::Yes,
            'nature' => ActivityPermissionLevel::Yes,
            'fine_arts' => ActivityPermissionLevel::Yes,
            'swimming' => ActivityPermissionLevel::Restricted,
            'boating' => ActivityPermissionLevel::No,
            'camping' => ActivityPermissionLevel::Yes,
            'camp_out' => ActivityPermissionLevel::Yes,
        ], [
            'swimming' => 'May participate with accessible pool entry and a dedicated water aide. Catheter care must be completed before and after water activities.',
            'boating' => 'Excluded — wheelchair-accessible transfer to boat is not feasible at current facility.',
        ]);

        // ── Camp session ──────────────────────────────────────────────────────

        $session = CampSession::firstOrCreate(
            ['name' => 'Session 1 — Summer 2026'],
            [
                'start_date' => '2026-06-08',
                'end_date' => '2026-06-12',
                'capacity' => 60,
                'min_age' => 6,
                'max_age' => 17,
                'registration_opens_at' => '2026-01-15 00:00:00',
                'registration_closes_at' => '2026-05-15 23:59:59',
                'is_active' => true,
                'portal_open' => true,
            ]
        );

        // ── Applications ──────────────────────────────────────────────────────

        // Ethan — Approved. Admin dashboard: enrolled count +1. Medical portal unlocked.
        $ethanApp = Application::firstOrCreate(
            ['camper_id' => $ethan->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Approved,
                'submitted_at' => now()->subDays(20),
                'reviewed_at' => now()->subDays(10),
                'reviewed_by' => $admin->id,
                'notes' => 'Ethan has attended Camp Burnt Gin twice before. Medical team fully briefed on seizure and ASD care plan. Seizure action plan received from Dr. Hill. All clearances in order. Approved.',
                'signature_name' => 'Sarah Johnson',
                'signed_at' => now()->subDays(20),
                'signed_ip_address' => '192.168.1.100',
            ]
        );

        // Lily — Submitted. Admin dashboard: review queue +1.
        Application::firstOrCreate(
            ['camper_id' => $lily->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'submitted_at' => now()->subDays(5),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,
                'signature_name' => 'Sarah Johnson',
                'signed_at' => now()->subDays(5),
                'signed_ip_address' => '192.168.1.100',
            ]
        );

        // Sofia — Under Review. Admin dashboard: review queue +1, in-progress with notes.
        Application::firstOrCreate(
            ['camper_id' => $sofia->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::UnderReview,
                'submitted_at' => now()->subDays(14),
                'reviewed_at' => now()->subDays(12),
                'reviewed_by' => $admin->id,
                'notes' => 'Under review — awaiting updated immunization record from Dr. Owens and physician clearance confirming Sofia is cleared for camp participation. Follow-up email sent to David Martinez on '.now()->subDays(8)->format('M d').'. Catheterization protocol on file from prior consultation.',
                'signature_name' => 'David Martinez',
                'signed_at' => now()->subDays(14),
                'signed_ip_address' => '10.0.0.45',
            ]
        );

        // ── Activate Ethan (approved application → camper + medical access) ───

        $ethan->update(['is_active' => true]);

        // ── Medical record for Ethan ──────────────────────────────────────────

        $medRecord = MedicalRecord::firstOrCreate(
            ['camper_id' => $ethan->id],
            [
                'physician_name' => 'Dr. Sandra Hill',
                'physician_phone' => '803-555-0210',
                'physician_address' => '3600 Forest Drive, Columbia, SC 29204',
                'insurance_provider' => 'BlueCross BlueShield of SC',
                'insurance_policy_number' => 'BCBS-JHN-2026-8821',
                'has_seizures' => true,
                'seizure_description' => 'Tonic-clonic seizures. Typically 60–90 seconds. Post-ictal confusion lasting 10–20 minutes. Last episode 3 months ago. Medication-controlled on Keppra.',
                'special_needs' => 'ASD Level 2. Prefers predictable routines and clear verbal transitions. May need quiet space during sensory overload. Responds well to visual schedules.',
                'dietary_restrictions' => null,
                'notes' => 'Ethan is a confident, enthusiastic camper with excellent peer relationships. No behavioral concerns when routine is maintained. Emergency seizure kit (Diastat) must be accessible at all times.',
                'is_active' => true,
            ]
        );

        Diagnosis::firstOrCreate(
            ['camper_id' => $ethan->id, 'name' => 'Epilepsy — Tonic-Clonic'],
            ['description' => 'Medication-controlled. Last seizure 3 months ago. Diastat prescribed for rescue.', 'severity_level' => DiagnosisSeverity::Moderate]
        );

        Diagnosis::firstOrCreate(
            ['camper_id' => $ethan->id, 'name' => 'Autism Spectrum Disorder'],
            ['description' => 'Level 2. Strong verbal skills. Sensory sensitivities. Requires structured routine.', 'severity_level' => DiagnosisSeverity::Moderate]
        );

        // ── Documents for Ethan (submitted_at set — visible to admin + medical) ─

        $this->seedDocument($ethan, $ethanApp, 'official_medical_form', 'Ethan_Johnson_Medical_Form_2026.pdf', now()->subDays(19), DocumentVerificationStatus::Approved, $admin);
        $this->seedDocument($ethan, $ethanApp, 'immunization_record', 'Ethan_Johnson_Immunizations_2026.pdf', now()->subDays(19), DocumentVerificationStatus::Approved, $admin);
        $this->seedDocument($ethan, $ethanApp, 'insurance_card', 'Ethan_Johnson_Insurance_Card.pdf', now()->subDays(19), DocumentVerificationStatus::Approved, $admin);

        $this->command->newLine();
        $this->command->info('✓ Demo seed complete.');
        $this->command->newLine();
        $this->command->line('<comment>Accounts (all non-admin passwords: password)</comment>');
        $this->command->line('  Super Admin : admin.campburntgin@gmail.com           (see ADMIN_BOOTSTRAP_PASSWORD in .env)');
        $this->command->line('  Admin       : coordinator@campburntgin.org');
        $this->command->line('  Medical     : medical@campburntgin.org');
        $this->command->line('  Applicant 1 : sarah.johnson@example.com        (Ethan: approved, Lily: submitted)');
        $this->command->line('  Applicant 2 : david.martinez@example.com       (Sofia: under review)');
        $this->command->newLine();
        $this->command->line('<comment>Session:</comment> Session 1 — Summer 2026 (open)');
        $this->command->line('<comment>Applications:</comment> approved(1), under_review(1), submitted(1)');
        $this->command->line('<comment>Tip:</comment> Use SEED_MODE=development for the full developer dataset.');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * @param  array<string, ActivityPermissionLevel>  $permissions  slug → level
     * @param  array<string, string>  $notes  slug → restriction_notes
     */
    private function seedActivityPermissions(Camper $camper, array $permissions, array $notes = []): void
    {
        foreach ($permissions as $slug => $level) {
            ActivityPermission::firstOrCreate(
                ['camper_id' => $camper->id, 'activity_name' => $slug],
                [
                    'permission_level' => $level,
                    'restriction_notes' => $notes[$slug] ?? null,
                ]
            );
        }
    }

    private function seedDocument(
        Camper $camper,
        Application $application,
        string $documentType,
        string $originalFilename,
        \Carbon\Carbon $submittedAt,
        DocumentVerificationStatus $verificationStatus,
        User $uploadedBy
    ): void {
        $existing = Document::where('documentable_type', 'App\Models\Application')
            ->where('documentable_id', $application->id)
            ->where('document_type', $documentType)
            ->exists();

        if ($existing) {
            return;
        }

        $uuid = Str::uuid()->toString();
        $year = $submittedAt->format('Y');
        $month = $submittedAt->format('m');

        Document::create([
            'documentable_type' => 'App\Models\Application',
            'documentable_id' => $application->id,
            'document_type' => $documentType,
            'original_filename' => $originalFilename,
            'stored_filename' => $uuid.'.pdf',
            'path' => "documents/Application/{$year}/{$month}/{$uuid}.pdf",
            'disk' => 'local',
            'mime_type' => 'application/pdf',
            'file_size' => random_int(120000, 800000),
            'uploaded_by' => $uploadedBy->id,
            'is_scanned' => true,
            'scan_passed' => true,
            'scanned_at' => $submittedAt->copy()->addMinutes(2),
            'verification_status' => $verificationStatus,
            'verified_by' => $uploadedBy->id,
            'verified_at' => $submittedAt->copy()->addDays(1),
            'submitted_at' => $submittedAt,
        ]);
    }
}
