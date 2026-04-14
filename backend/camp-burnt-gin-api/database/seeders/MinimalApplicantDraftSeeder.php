<?php

namespace Database\Seeders;

use App\Enums\AllergySeverity;
use App\Enums\ApplicationStatus;
use App\Enums\DiagnosisSeverity;
use App\Enums\SubmissionSource;
use App\Models\Allergy;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * MinimalApplicantDraftSeeder
 *
 * Creates a single, demo-ready applicant scenario:
 *
 *   1 parent account (Angela Thornton)
 *     └─ Camper 1: Marcus Thornton  (12 y/o, ASD + ADHD)           [DRAFT]
 *     └─ Camper 2: Destiny Thornton  (9 y/o, Sickle Cell Disease)   [DRAFT]
 *
 * Every application is FULLY completed — all narrative fields, medical data,
 * emergency contacts, diagnoses, medications, and allergies are present and
 * realistic. The applications are left as is_draft=true because documents
 * have not yet been uploaded.
 *
 * ─── WHY is_draft=true ───────────────────────────────────────────────────────
 *
 * is_draft=true is the authoritative "not submitted" flag on Application.
 * The status column defaults to Submitted (the DB column default) but is
 * ignored while is_draft=true. The signature block (signature_name, signed_at,
 * signed_ip_address) is null because the parent has not reached the sign &
 * submit step — document uploads must be completed first, and those are
 * intentionally absent.
 *
 * ─── WHY DOCUMENTS ARE MISSING ───────────────────────────────────────────────
 *
 * The following required documents are NOT seeded — this is by design:
 *
 *   official_medical_form   — physician must complete Form 4523-ENG-DPH
 *   immunization_record     — SC immunization certificate scan required
 *   insurance_card          — insurance card scan required by both applicants
 *
 * This models the most common real-world scenario: a parent who has carefully
 * filled in all form fields but is waiting to receive documents from their
 * child's physician before they can finish and submit.
 *
 * ─── WHAT THIS SEEDER VALIDATES ──────────────────────────────────────────────
 *
 *   - Draft state indicators are visible in the applicant portal
 *   - Missing-document warnings appear correctly
 *   - Submission is blocked until documents are uploaded
 *   - Admin dashboard shows 2 campers under 1 applicant, both in Draft
 *   - All medical data, narrative text, and contact info renders without errors
 *
 * ─── DEPENDENCIES ────────────────────────────────────────────────────────────
 *
 * Requires RoleSeeder and CampSeeder to have run (or will call them).
 * Safe to re-run — all creates use firstOrCreate on unique constraints.
 *
 * ─── CREDENTIALS ─────────────────────────────────────────────────────────────
 *
 *   Super Admin:  demo.admin@campburntgin.org          /  password
 *   Applicant:    angela.thornton.demo@campburntgin.org  /  password
 */
class MinimalApplicantDraftSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure system prerequisites exist. These are no-ops if already seeded.
        $this->ensurePrerequisites();

        $session = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();

        // Step 1 — Create the super admin and medical staff so colleagues can log in immediately.
        $this->seedSuperAdmin();
        $this->seedMedicalStaff();

        // Step 2 — Create the parent account.
        $parent = $this->createParent();

        // Step 2 — Create each camper with a complete medical profile.
        $marcus = $this->seedMarcus($parent);
        $destiny = $this->seedDestiny($parent);

        // Step 3 — Create a fully-filled draft application for each camper.
        // is_draft=true means all data is present but the parent has not signed
        // and submitted. The only missing piece is the document uploads.
        $this->createMarcusDraft($marcus, $session);
        $this->createDestinyDraft($destiny, $session);

        $this->printSummary();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PREREQUISITES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Call foundational seeders if their output is not yet present.
     * Allows this seeder to run standalone without requiring a full db:seed first.
     */
    private function ensurePrerequisites(): void
    {
        if (! Role::where('name', 'applicant')->exists()) {
            $this->call(RoleSeeder::class);
        }

        if (! CampSession::where('name', 'Session 1 — Summer 2026')->exists()) {
            $this->call(CampSeeder::class);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUPER ADMIN ACCOUNT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a demo super admin account with a known, fixed password.
     *
     * Uses a demo-specific email so it never collides with the production
     * bootstrap account (admin@campburntgin.org set via ADMIN_BOOTSTRAP_EMAIL).
     *
     * mfa_enabled is intentionally false — MFA is optional in this project.
     */
    private function seedSuperAdmin(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->firstOrFail();

        User::firstOrCreate(
            ['email' => 'demo.admin@campburntgin.org'],
            [
                'name' => 'Demo Administrator',
                'role_id' => $superAdminRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'mfa_enabled' => false,
                'notification_preferences' => ['email', 'database'],
            ]
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEDICAL STAFF ACCOUNT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a demo medical staff account.
     * Medical staff can view camper health records and manage medical data
     * but cannot approve/reject applications.
     */
    private function seedMedicalStaff(): void
    {
        $medicalRole = Role::where('name', 'medical')->firstOrFail();

        User::firstOrCreate(
            ['email' => 'demo.medical@campburntgin.org'],
            [
                'name' => 'Demo Medical Staff',
                'role_id' => $medicalRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'mfa_enabled' => false,
                'notification_preferences' => ['email', 'database'],
            ]
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARENT ACCOUNT
    // ─────────────────────────────────────────────────────────────────────────

    private function createParent(): User
    {
        $applicantRole = Role::where('name', 'applicant')->firstOrFail();

        return User::firstOrCreate(
            ['email' => 'angela.thornton.demo@campburntgin.org'],
            [
                'name' => 'Angela Thornton',
                'preferred_name' => 'Angie',
                'role_id' => $applicantRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '(803) 555-0247',
                'address_line_1' => '418 Magnolia Drive',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29205',
                'country' => 'US',
                'notification_preferences' => ['email', 'database'],
            ]
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CAMPER 1 — MARCUS THORNTON (12 y/o, ASD + ADHD)
    // ─────────────────────────────────────────────────────────────────────────

    private function seedMarcus(User $parent): Camper
    {
        $camper = Camper::firstOrCreate(
            ['user_id' => $parent->id, 'first_name' => 'Marcus', 'last_name' => 'Thornton'],
            [
                'preferred_name' => 'Marc',
                'date_of_birth' => '2013-08-14',   // Age 12 at Summer 2026
                'gender' => 'male',
                'tshirt_size' => 'YM',
                'county' => 'Richland',     // Columbia is in Richland County — CYSHCN eligibility
                'supervision_level' => 'enhanced',     // ASD Level 2 requires enhanced supervision (1:3 ratio)
                'needs_interpreter' => false,
                'preferred_language' => 'English',
                'applicant_address' => '418 Magnolia Drive',
                'applicant_city' => 'Columbia',
                'applicant_state' => 'SC',
                'applicant_zip' => '29205',
                'is_active' => false,          // No approved application — draft only
                'record_retention_until' => now()->addYears(7)->format('Y-m-d'),
            ]
        );

        // Emergency contacts — only create if none exist to stay idempotent
        if (! EmergencyContact::where('camper_id', $camper->id)->exists()) {
            // Guardian 1 — primary caregiver, authorized pickup, lives at same address
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Angela Thornton',
                'relationship' => 'Mother',
                'phone_primary' => '(803) 555-0247',
                'phone_secondary' => null,
                'phone_work' => '(803) 555-0891',
                'email' => 'angela.thornton.demo@campburntgin.org',
                'is_primary' => true,
                'is_guardian' => true,
                'is_authorized_pickup' => true,
                'address' => '418 Magnolia Drive',
                'city' => 'Columbia',
                'state' => 'SC',
                'zip' => '29205',
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]);

            // Guardian 2 — father, also authorized pickup
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Robert Thornton',
                'relationship' => 'Father',
                'phone_primary' => '(803) 555-0318',
                'phone_secondary' => null,
                'phone_work' => '(803) 555-0772',
                'email' => 'robert.thornton@outlook.com',
                'is_primary' => false,
                'is_guardian' => true,
                'is_authorized_pickup' => true,
                'address' => null,
                'city' => null,
                'state' => null,
                'zip' => null,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]);

            // Additional contact — school nurse, NOT authorized for pickup
            // Tests the non-guardian, non-pickup contact type in admin views
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Patricia Webb, RN',
                'relationship' => 'School Nurse',
                'phone_primary' => '(803) 555-0194',
                'phone_secondary' => null,
                'phone_work' => null,
                'email' => 'pwebb@colonialheights.richland.k12.sc.us',
                'is_primary' => false,
                'is_guardian' => false,
                'is_authorized_pickup' => false,
                'address' => null,
                'city' => null,
                'state' => null,
                'zip' => null,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]);
        }

        // Medical record — only create if none exists
        if (! MedicalRecord::where('camper_id', $camper->id)->exists()) {
            MedicalRecord::create([
                'camper_id' => $camper->id,
                'physician_name' => 'Dr. James Okafor, MD',
                'physician_phone' => '(803) 434-7000',
                'physician_address' => '9 Medical Park Road, Columbia, SC 29203',
                'insurance_provider' => 'BlueCross BlueShield South Carolina',
                'insurance_policy_number' => 'BCBS-SC-MTH-2026-001',
                'insurance_group' => 'GRP-88441',
                'medicaid_number' => null,
                'special_needs' => 'Marcus has Autism Spectrum Disorder (Level 2) and ADHD. He benefits from structured schedules, visual supports, and advance notice before transitions. He can become dysregulated in loud or unpredictable environments — a quiet de-escalation space is helpful. He is verbal and communicates clearly when calm. Social stories and first/then language work well for him.',
                'dietary_restrictions' => 'Dairy-free diet required due to moderate dairy allergy (rash, GI distress). No milk, cheese, butter, or cream-based sauces. All meals and snacks must be dairy-free.',
                'notes' => 'Marcus completed occupational therapy at Palmetto Therapy Associates (2023–2025). He has an active IEP at Colonial Heights Elementary for speech-language and social supports. He loves swimming, LEGO, and Marvel superheroes. A printed daily schedule helps him feel safe and reduces anxiety during transitions.',
                'mobility_notes' => 'No mobility limitations. Full ambulation without assistive devices. Fine motor skills slightly below age level — allow extra time for dressing tasks such as buttons and zippers.',
                'immunizations_current' => true,
                'tetanus_date' => '2024-10-15',
                'has_seizures' => false,
                'last_seizure_date' => null,
                'seizure_description' => null,
                'has_neurostimulator' => false,
                'has_contagious_illness' => false,
                'contagious_illness_description' => null,
                'tubes_in_ears' => false,
                'has_recent_illness' => false,
                'recent_illness_description' => null,
                'date_of_medical_exam' => '2026-01-22',
                'is_active' => false,
            ]);

            Diagnosis::create([
                'camper_id' => $camper->id,
                'name' => 'Autism Spectrum Disorder (ASD)',
                'description' => 'Level 2 ASD per DSM-5 criteria. Requires substantial support for social communication and restricted/repetitive behaviors. Evaluated by Dr. Okafor at MUSC Children\'s in 2021. Current school placement: general education with resource support and a 1:1 aide for transitions.',
                'severity_level' => DiagnosisSeverity::Moderate,
                'notes' => 'Responds well to visual schedules, clear expectations, and calm redirection. Sensory sensitivities include loud unexpected sounds (horns, alarms) and certain fabric textures. No history of self-injurious behavior.',
            ]);

            Diagnosis::create([
                'camper_id' => $camper->id,
                'name' => 'Attention Deficit Hyperactivity Disorder (ADHD)',
                'description' => 'Combined-type ADHD. Diagnosed at age 8. Co-managed with ASD treatment plan. Aripiprazole addresses co-occurring behavioral and attentional components.',
                'severity_level' => DiagnosisSeverity::Mild,
                'notes' => 'Short task segments and movement breaks significantly improve focus. Positive behavioral support strategies (praise, token board) are documented in the IEP.',
            ]);

            Medication::create([
                'camper_id' => $camper->id,
                'name' => 'Aripiprazole (Abilify)',
                'dosage' => '5 mg tablet',
                'frequency' => 'Once daily in the morning with breakfast',
                'purpose' => 'Management of irritability associated with ASD and co-occurring ADHD symptoms. Helps reduce anxiety-driven behavioral responses and supports emotional regulation.',
                'prescribing_physician' => 'Dr. James Okafor, MD — MUSC Children\'s Hospital, Columbia, SC',
                'notes' => 'Give with food to reduce risk of stomach upset. Do not crush or split the tablet. If Marcus refuses, Dr. Okafor authorizes mixing with a small amount of dairy-free applesauce. Contact parent immediately if dose is missed or vomited within 30 minutes of administration.',
            ]);

            Allergy::create([
                'camper_id' => $camper->id,
                'allergen' => 'Dairy (milk, cheese, cream, butter)',
                'severity' => AllergySeverity::Moderate,
                'reaction' => 'Urticaria (hives) on arms and torso within 30–45 minutes of ingestion, accompanied by abdominal cramping, bloating, and diarrhea. Has not progressed to anaphylaxis historically.',
                'treatment' => 'Administer diphenhydramine (Benadryl) 25 mg for mild hive reaction. If reaction progresses to vomiting, widespread hives, or any respiratory symptoms, call 911 and administer EpiPen if available. Notify parent immediately in all cases.',
            ]);
        }

        return $camper;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CAMPER 2 — DESTINY THORNTON (9 y/o, Sickle Cell Disease HbSS)
    // ─────────────────────────────────────────────────────────────────────────

    private function seedDestiny(User $parent): Camper
    {
        $camper = Camper::firstOrCreate(
            ['user_id' => $parent->id, 'first_name' => 'Destiny', 'last_name' => 'Thornton'],
            [
                'preferred_name' => 'Desi',
                'date_of_birth' => '2016-03-22',   // Age 10 at Summer 2026
                'gender' => 'female',
                'tshirt_size' => 'YS',
                'county' => 'Richland',
                'supervision_level' => 'enhanced',     // SCD with crisis risk warrants enhanced supervision
                'needs_interpreter' => false,
                'preferred_language' => 'English',
                'applicant_address' => '418 Magnolia Drive',
                'applicant_city' => 'Columbia',
                'applicant_state' => 'SC',
                'applicant_zip' => '29205',
                'is_active' => false,
                'record_retention_until' => now()->addYears(7)->format('Y-m-d'),
            ]
        );

        if (! EmergencyContact::where('camper_id', $camper->id)->exists()) {
            // Guardian 1 — mother (primary caregiver)
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Angela Thornton',
                'relationship' => 'Mother',
                'phone_primary' => '(803) 555-0247',
                'phone_secondary' => null,
                'phone_work' => '(803) 555-0891',
                'email' => 'angela.thornton.demo@campburntgin.org',
                'is_primary' => true,
                'is_guardian' => true,
                'is_authorized_pickup' => true,
                'address' => '418 Magnolia Drive',
                'city' => 'Columbia',
                'state' => 'SC',
                'zip' => '29205',
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]);

            // Guardian 2 — father
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Robert Thornton',
                'relationship' => 'Father',
                'phone_primary' => '(803) 555-0318',
                'phone_secondary' => null,
                'phone_work' => '(803) 555-0772',
                'email' => 'robert.thornton@outlook.com',
                'is_primary' => false,
                'is_guardian' => true,
                'is_authorized_pickup' => true,
                'address' => null,
                'city' => null,
                'state' => null,
                'zip' => null,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]);

            // Paternal grandmother — authorized pickup, tests the multi-phone contact UI
            // (both phone_primary and phone_secondary populated, no email)
            EmergencyContact::create([
                'camper_id' => $camper->id,
                'name' => 'Dorothy Thornton',
                'relationship' => 'Paternal Grandmother',
                'phone_primary' => '(803) 555-0603',
                'phone_secondary' => '(803) 555-0714',   // Landline backup
                'phone_work' => null,
                'email' => null,                // No email — tests nullable email state
                'is_primary' => false,
                'is_guardian' => false,
                'is_authorized_pickup' => true,
                'address' => null,
                'city' => null,
                'state' => null,
                'zip' => null,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]);
        }

        if (! MedicalRecord::where('camper_id', $camper->id)->exists()) {
            MedicalRecord::create([
                'camper_id' => $camper->id,
                'physician_name' => 'Dr. Patricia Simmons, MD',
                'physician_phone' => '(803) 434-4869',
                'physician_address' => '7 Richland Medical Park Drive, Columbia, SC 29203',
                'insurance_provider' => 'SC Healthy Connections Medicaid',
                'insurance_policy_number' => 'SCM-RICH-2026-DTHRN-007',
                'insurance_group' => null,
                'medicaid_number' => 'SC-MCD-29205-0337',
                'special_needs' => 'Destiny has Sickle Cell Disease (HbSS genotype). She is at elevated risk for vaso-occlusive pain crises when dehydrated, cold, overexerted, or stressed. She must maintain consistent hydration (minimum 8 oz water every hour during outdoor activity), avoid prolonged sun exposure, and have immediate access to oral pain management. Staff should be trained to recognize early pain crisis signs: limping, refusing to walk, clutching an arm or leg.',
                'dietary_restrictions' => 'No dietary restrictions. Ensure high fluid intake throughout the day — water and non-caffeinated beverages only. Avoid soda, fruit punch, or sugary drinks as the primary hydration source.',
                'notes' => 'Destiny is followed by the SC Comprehensive Sickle Cell Center at Palmetto Health Richland. She was hospitalized once for a mild vaso-occlusive pain crisis (February 2025, 2-night stay, fully resolved). Hydroxyurea therapy has maintained stability for 13 months. Spleen is non-functional (auto-infarction at age 6) — any fever over 101°F requires prompt emergency evaluation. She is cheerful, loves dancing, drawing, and making friendship bracelets.',
                'mobility_notes' => 'No current mobility limitations. During a vaso-occlusive crisis, Destiny may refuse to walk due to leg or foot pain (dactylitis) — this is a medical symptom, not non-compliance. Allow rest and use a wheelchair if available rather than insisting she walk.',
                'immunizations_current' => true,
                'tetanus_date' => '2025-09-08',
                'has_seizures' => false,
                'last_seizure_date' => null,
                'seizure_description' => null,
                'has_neurostimulator' => false,
                'has_contagious_illness' => false,
                'contagious_illness_description' => null,
                'tubes_in_ears' => false,
                'has_recent_illness' => true,
                'recent_illness_description' => 'Mild vaso-occlusive pain crisis, February 2025. Hospitalized for 2 nights at Palmetto Health Richland. Fully resolved. Hydroxyurea dose was optimized following this event. No long-term changes to care plan.',
                'date_of_medical_exam' => '2026-02-10',
                'is_active' => false,
            ]);

            Diagnosis::create([
                'camper_id' => $camper->id,
                'name' => 'Sickle Cell Disease (HbSS)',
                'description' => 'HbSS genotype — the most severe form of sickle cell disease. Diagnosed via newborn screen at birth. Managed with daily hydroxyurea. Enrolled in the SC Comprehensive Sickle Cell Center program. Annual transcranial Doppler (TCD) screenings — last result normal, October 2025. Spleen auto-infarcted at age 6 (functional asplenia).',
                'severity_level' => DiagnosisSeverity::Severe,
                'notes' => 'Primary camp risk: dehydration-triggered vaso-occlusive crisis. Secondary risk: cold-induced vasospasm during swimming (confirm pool water is above 78°F). Tertiary risk: acute chest syndrome if respiratory illness develops — any cough plus chest pain is a medical emergency. No stroke history. Functional asplenia means any fever over 101°F must be evaluated emergently (sepsis risk).',
            ]);

            // Medication 1 — daily disease-modifying therapy
            Medication::create([
                'camper_id' => $camper->id,
                'name' => 'Hydroxyurea (Droxia)',
                'dosage' => '500 mg capsule',
                'frequency' => 'Once daily at bedtime',
                'purpose' => 'Reduces frequency and severity of vaso-occlusive pain crises by increasing fetal hemoglobin (HbF) production and reducing red blood cell sickling.',
                'prescribing_physician' => 'Dr. Patricia Simmons, MD — Palmetto Health Richland, Columbia, SC',
                'notes' => 'Give with a full glass of water at bedtime. Do not open or crush the capsule. Skip a missed dose — do not double-dose. This medication is a chemotherapy agent: staff should avoid skin contact with capsule contents (use gloves). Store in the original childproof container away from heat and direct sunlight.',
            ]);

            // Medication 2 — PRN pain management during a crisis
            Medication::create([
                'camper_id' => $camper->id,
                'name' => 'Ibuprofen (Children\'s Advil)',
                'dosage' => '200 mg / 5 mL suspension — 10 mg/kg per dose (Destiny: 28 kg = 280 mg = 7 mL)',
                'frequency' => 'Every 6–8 hours as needed for pain crisis only (not routine use)',
                'purpose' => 'First-line oral pain management during a mild-to-moderate vaso-occlusive pain crisis. Used when pain is rated 4–6 out of 10 and Destiny is still ambulatory.',
                'prescribing_physician' => 'Dr. Patricia Simmons, MD',
                'notes' => 'Give with food or milk. Do NOT give with aspirin or aspirin-containing products. If pain is 7+/10, does not improve within 1 hour, or if Destiny develops chest pain or shortness of breath, call parent and consider emergency transport immediately. Do not delay emergency evaluation to observe further.',
            ]);

            // Allergy 1 — absolute contraindication
            Allergy::create([
                'camper_id' => $camper->id,
                'allergen' => 'Aspirin (acetylsalicylic acid)',
                'severity' => AllergySeverity::Severe,
                'reaction' => 'Aspirin is absolutely contraindicated in sickle cell disease due to platelet dysfunction and risk of worsening red blood cell sickling. Any accidental ingestion should be treated as a medical emergency.',
                'treatment' => 'Do NOT administer aspirin, aspirin-containing products (e.g. Pepto-Bismol), or NSAIDs other than ibuprofen. If aspirin is accidentally given, call Angela (803-555-0247) and Dr. Simmons (803-434-4869) immediately. Monitor closely for increased pain, pallor, or shortness of breath.',
            ]);

            // Allergy 2 — antibiotic allergy relevant for infection management
            Allergy::create([
                'camper_id' => $camper->id,
                'allergen' => 'Penicillin (and cephalosporins — cross-reactive)',
                'severity' => AllergySeverity::Moderate,
                'reaction' => 'Urticaria (skin rash and hives) noted during penicillin prophylaxis course at age 7. No anaphylaxis documented. Prophylaxis was discontinued and switched to azithromycin per allergist recommendation.',
                'treatment' => 'Avoid all penicillin-class and cephalosporin antibiotics. If Destiny requires antibiotic treatment for any reason, contact Dr. Simmons for guidance. For mild urticaria: diphenhydramine 12.5 mg. For throat tightness or spreading hives: administer EpiPen and call 911 immediately.',
            ]);
        }

        return $camper;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAFT APPLICATION — MARCUS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * All eight narrative fields are filled with realistic, parent-written text.
     * is_draft=true and all signature fields are null because the parent has not
     * yet uploaded the required documents (official_medical_form, immunization_record,
     * insurance_card) and therefore has not reached the sign & submit step.
     */
    private function createMarcusDraft(Camper $marcus, CampSession $session): Application
    {
        return Application::firstOrCreate(
            ['camper_id' => $marcus->id, 'camp_session_id' => $session->id],
            [
                // Status field holds the DB default; is_draft=true overrides submission logic
                'status' => ApplicationStatus::Submitted,
                'is_draft' => true,   // KEY: application exists but is NOT submitted
                'submission_source' => SubmissionSource::Digital,
                'first_application' => true,   // Marcus has not attended Camp Burnt Gin before
                'attended_before' => false,
                'camp_session_id_second' => null,

                // Signature block — null because parent has not yet signed.
                // The sign-and-submit step is gated on completing document uploads.
                'submitted_at' => null,
                'signature_name' => null,
                'signature_data' => null,
                'signed_at' => null,
                'signed_ip_address' => null,
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,

                // ── Narrative Section — 8 long-form parent responses ──────────
                // Every field is completed. This is what a thorough, engaged parent
                // submits. All text is deliberately realistic and specific to Marcus.

                'narrative_rustic_environment' => 'Marcus does well in outdoor environments when he can see the structure of the day in advance. We bring a laminated daily schedule whenever we travel to new places. He attended a day camp at Sesquicentennial State Park last summer and managed the outdoor setting well — he especially loved the swimming and nature walks. He may need gentle reminders to reapply sunscreen since he finds the application process sensory-uncomfortable, but he will comply with a calm, patient approach from a familiar adult.',

                'narrative_staff_suggestions' => 'Marcus responds best to direct, simple language — one instruction at a time. Visual cues and first/then statements are very effective (e.g., "First swimming, then lunch"). Avoid open-ended questions when he is dysregulated; instead offer two clear choices. If he begins stimming (flapping, rocking), please allow it — it is self-regulating behavior, not a problem. Transition warnings of 5 minutes before any activity change are critical. A calm, matter-of-fact tone always works better than a raised voice or urgency.',

                'narrative_participation_concerns' => 'Our main concern is group transitions and mealtimes in loud, busy settings. Marcus can become overwhelmed in cafeteria-style dining and may refuse to eat if noise levels are high. Seating him near the edge of the group and reducing overlapping conversations directed at him during meals helps significantly. He may also need a 10–15 minute quiet decompression period after arrival at camp before engaging with the group. This is not defiance — it is his way of orienting to a new environment.',

                'narrative_camp_benefit' => 'Camp Burnt Gin would be genuinely transformational for Marcus. He does not have many peers who share similar experiences, and being surrounded by children who navigate their own special health needs — in an environment built specifically for them — would normalize his experience in a way his daily life rarely can. He needs structured opportunities to build independence outside the home. The supportive, low-judgment environment of Camp Burnt Gin is exactly the kind of setting where we believe he will surprise himself with what he can do. We have spoken to two other families whose children with ASD attended, and the growth they described gave us real hope.',

                'narrative_heat_tolerance' => 'Marcus does not have a diagnosed heat intolerance, but children on aripiprazole carry a mildly elevated risk of overheating because the medication can slightly impair thermoregulation. Please ensure he has regular water breaks and access to shade or air conditioning during peak afternoon heat (1–4 PM). He sweats normally and will say if he feels "too hot," though he may underreport to avoid missing an activity he enjoys. Proactive check-ins from staff every 30 minutes during outdoor activities are very much appreciated.',

                'narrative_transportation' => 'We will provide our own transportation on opening and closing day — driving from Columbia (approximately 45 minutes to camp). No camp transport is needed. Robert works at Fort Jackson and can be reached through the main gate if his cell is unavailable during work hours: (803) 555-0772. In an emergency, both parents can reach camp within one hour. Angela is the first point of contact for any situation, behavioral or medical.',

                'narrative_additional_info' => 'Marcus is a genuinely wonderful child with a deep love of swimming, LEGO, and anything Marvel (especially Spider-Man). He will likely initiate conversations with staff about his favorite superheroes — please engage with him, as shared interests are his primary way of building trust with new people. He is proud of his swimming ability and has been working toward his 50-meter freestyle badge this spring. He will do best if at least one consistent staff member serves as his primary point of contact throughout the week — consistency and familiarity are the foundation of his confidence.',

                'narrative_emergency_protocols' => 'In a behavioral crisis (not a physical medical emergency), call Angela at (803) 555-0247 before calling Robert. Angela has completed ABA parent training and can provide phone guidance to staff in real time. For a physical medical emergency (allergic reaction, injury, or illness), call 911 first, then Angela immediately. Do not administer any medication not listed on this form without calling a parent first. If Marcus is in a meltdown, the safest approach is to move him away from the group to a quiet space, reduce all demands, and wait calmly — attempting to physically redirect or guide him during a meltdown can escalate the situation significantly.',
            ]
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAFT APPLICATION — DESTINY
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Same design intent as Marcus's draft: every field is complete and realistic,
     * but is_draft=true and no signature because documents are not yet uploaded.
     *
     * Destiny's narratives specifically address the sickle cell crisis protocol,
     * hydration requirements, and emergency response — the kind of detail-rich
     * text that a medically experienced parent would write for a complex condition.
     */
    private function createDestinyDraft(Camper $destiny, CampSession $session): Application
    {
        return Application::firstOrCreate(
            ['camper_id' => $destiny->id, 'camp_session_id' => $session->id],
            [
                'status' => ApplicationStatus::Submitted,
                'is_draft' => true,
                'submission_source' => SubmissionSource::Digital,
                'first_application' => true,
                'attended_before' => false,
                'camp_session_id_second' => null,

                // Signature block — null, pending document uploads
                'submitted_at' => null,
                'signature_name' => null,
                'signature_data' => null,
                'signed_at' => null,
                'signed_ip_address' => null,
                'reviewed_at' => null,
                'reviewed_by' => null,
                'notes' => null,

                'narrative_rustic_environment' => 'Destiny loves the outdoors but we must be thoughtful about sun and heat exposure given her sickle cell disease. She has attended outdoor birthday parties, school field days, and a day trip to Congaree National Park without incident as long as she stayed hydrated. At camp, we ask that outdoor activities longer than 30 minutes include a scheduled water break, and that she wear a sun-protective hat and UPF clothing during peak sun hours. She carries a water bottle everywhere at school and is very self-aware about hydration — she will remind staff herself, but she appreciates the reinforcement.',

                'narrative_staff_suggestions' => 'Destiny is a people-person who thrives on warm connection with trusted adults. She does very well when she feels seen and acknowledged — a simple comment like "Great job keeping up with your water today, Desi" goes a long way for her. Her primary vulnerability is pain — if she says she hurts, please take it seriously immediately. Children with sickle cell sometimes normalize pain and may downplay it at first; Destiny has been coached to speak up clearly. She loves arts and crafts and music — if she needs a rest break, these are ideal quiet activities to transition her into.',

                'narrative_participation_concerns' => 'Our primary concern is a vaso-occlusive pain crisis occurring while she is at camp. Early signs are subtle: she may become quieter than usual, start walking more slowly, or hold one arm or leg differently. If staff notice these signs, please check in with her privately — she knows her body well and will tell you honestly whether she is in pain. We are also cautious about swimming pool temperature: water below 78°F can trigger a crisis. Please confirm pool temperature before each session and have a warm towel available for when she exits the water.',

                'narrative_camp_benefit' => 'Camp Burnt Gin is one of the few places where Destiny will not need to explain her disease to every single person she meets. At school she sometimes feels different and like she has to educate her classmates about sickle cell constantly. At camp, she can simply be a child among other children who also navigate medical complexity every day. The independence she will build, the friendships she will form, and the experience of being fully accepted and accommodated in an environment designed for children like her — we believe this is exactly what she needs right now. Her hematologist, Dr. Simmons, has reviewed the camp\'s medical program and fully endorses her participation.',

                'narrative_heat_tolerance' => 'Destiny has clinically reduced heat tolerance due to her sickle cell disease. Dehydration and overheating are the two most common triggers for her pain crises. During summer 2025 she had one heat-related incident at a school field day (became lethargic with leg pain, resolved with rest, shade, and 32 oz of water). At camp we ask for: mandatory water breaks every 30 minutes during outdoor activities, access to shade or air-conditioned space during the 1–3 PM peak heat window, and permission for Destiny to self-limit activity when she feels tired or achy. This is not non-compliance — it is appropriate self-protection that we have specifically coached her to practice.',

                'narrative_transportation' => 'We will drop off and pick up from camp ourselves, driving from Columbia (approximately 45 minutes). In an emergency, paternal grandmother Dorothy Thornton (803-555-0603) lives in West Columbia and can reach camp in about 30 minutes. She is authorized for pickup. If Destiny requires hospitalization, our hospital of choice and medical home is Palmetto Health Richland in Columbia, where Dr. Simmons practices and Destiny\'s complete sickle cell records are on file. If at all possible, please do not transport her to a different emergency facility — sickle cell management requires providers who know her history.',

                'narrative_additional_info' => 'Destiny is one of the most joyful, generous children you will ever meet. She plans to arrive at camp with a full bag of friendship bracelet supplies to give as gifts. She is a confident swimmer and has been coached since age 5 to exit the pool immediately if she feels cold — you will not need to coax her. She loves dancing to any music and will almost certainly organize a spontaneous dance party during free time. Her older brother Marcus is applying for this same session, and having him nearby may be a comfort to her if she feels homesick — though she is generally very resilient and socially fearless.',

                'narrative_emergency_protocols' => 'PAIN CRISIS PROTOCOL: (1) Assess pain level 1–10 and location. (2) Move Destiny to a cool, shaded area immediately. (3) Give 16–32 oz water right away. (4) For pain rated 4–6 out of 10: administer ibuprofen per the dosing chart in the medical record (7 mL of 200 mg/5 mL suspension). (5) Call Angela at (803) 555-0247 immediately — keep her on the line while monitoring. (6) If pain is 7 or higher, does not improve within 45 minutes, or Destiny develops chest pain, shortness of breath, or unusual lethargy: CALL 911 and transport to Palmetto Health Richland. Do not attempt to manage a severe crisis at camp. FEVER PROTOCOL: Any fever over 101°F in a child with asplenia (non-functional spleen) is a MEDICAL EMERGENCY — call 911 and notify parent simultaneously. Do not wait to confirm with a second reading. Asplenic children can become septic extremely rapidly; there is no "let\'s watch it" option.',
            ]
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    private function printSummary(): void
    {
        $this->command->newLine();
        $this->command->info('✓ MinimalApplicantDraftSeeder complete.');
        $this->command->newLine();
        $this->command->line('  ── Accounts ─────────────────────────────────────────────────');
        $this->command->line('  Super Admin:    demo.admin@campburntgin.org            / password');
        $this->command->line('  Medical Staff:  demo.medical@campburntgin.org          / password');
        $this->command->line('  Applicant:      angela.thornton.demo@campburntgin.org  / password');
        $this->command->newLine();
        $this->command->line('  ── Campers ──────────────────────────────────────────────────');
        $this->command->line('  Camper 1:  Marcus Thornton (12)  — ASD + ADHD, enhanced supervision   [DRAFT]');
        $this->command->line('  Camper 2:  Destiny Thornton (9)  — Sickle Cell Disease, enhanced supervision  [DRAFT]');
        $this->command->newLine();
        $this->command->warn('  Both applications are DRAFT (is_draft=true). Submission is blocked by:');
        $this->command->warn('    - official_medical_form   (physician Form 4523-ENG-DPH — not uploaded)');
        $this->command->warn('    - immunization_record     (SC immunization certificate — not uploaded)');
        $this->command->warn('    - insurance_card          (insurance card scan — not uploaded)');
        $this->command->newLine();
    }
}
