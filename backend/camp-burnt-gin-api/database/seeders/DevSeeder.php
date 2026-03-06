<?php

namespace Database\Seeders;

use App\Enums\AllergySeverity;
use App\Enums\ApplicationStatus;
use App\Enums\DiagnosisSeverity;
use App\Models\Allergy;
use App\Models\Announcement;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\CalendarEvent;
use App\Models\Camp;
use App\Models\CampSession;
use App\Models\Camper;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use App\Models\Message;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Development seeder — populates the database with realistic demo data.
 *
 * Creates a fully functional state for local development and review:
 *   - 1 camp with 3 sessions (upcoming, current, past)
 *   - 5 applicant families with campers, medical records, and applications
 *   - Applications spread across all statuses
 *   - Inbox conversations (user-to-user + system notifications)
 *   - Announcements (pinned, urgent, standard)
 *   - Calendar events across session lifecycle
 *   - Audit log entries
 *
 * Run via: php artisan db:seed --class=DevSeeder
 */
class DevSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding dev data...');

        // ── Roles ─────────────────────────────────────────────────────────────
        $adminRole     = Role::where('name', 'admin')->firstOrFail();
        $parentRole    = Role::where('name', 'applicant')->firstOrFail();
        $medicalRole   = Role::where('name', 'medical')->firstOrFail();
        $superRole     = Role::where('name', 'super_admin')->firstOrFail();

        // ── Staff accounts ────────────────────────────────────────────────────
        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name'              => 'Alex Rivera',
                'role_id'           => $adminRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $medical = User::firstOrCreate(
            ['email' => 'medical@example.com'],
            [
                'name'              => 'Dr. Morgan Chen',
                'role_id'           => $medicalRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        // ── Applicant families ────────────────────────────────────────────────
        $families = [
            [
                'name'  => 'Sarah Johnson',
                'email' => 'sarah.johnson@example.com',
                'campers' => [
                    ['first_name' => 'Ethan',  'last_name' => 'Johnson',  'dob' => '2013-04-12', 'gender' => 'male'],
                    ['first_name' => 'Lily',   'last_name' => 'Johnson',  'dob' => '2015-09-03', 'gender' => 'female'],
                ],
            ],
            [
                'name'  => 'David Martinez',
                'email' => 'david.martinez@example.com',
                'campers' => [
                    ['first_name' => 'Sofia',  'last_name' => 'Martinez', 'dob' => '2014-06-28', 'gender' => 'female'],
                ],
            ],
            [
                'name'  => 'Jennifer Thompson',
                'email' => 'jennifer.thompson@example.com',
                'campers' => [
                    ['first_name' => 'Noah',   'last_name' => 'Thompson', 'dob' => '2012-11-17', 'gender' => 'male'],
                ],
            ],
            [
                'name'  => 'Michael Williams',
                'email' => 'michael.williams@example.com',
                'campers' => [
                    ['first_name' => 'Ava',    'last_name' => 'Williams', 'dob' => '2016-02-09', 'gender' => 'female'],
                    ['first_name' => 'Lucas',  'last_name' => 'Williams', 'dob' => '2011-08-22', 'gender' => 'male'],
                ],
            ],
            [
                'name'  => 'Patricia Davis',
                'email' => 'patricia.davis@example.com',
                'campers' => [
                    ['first_name' => 'Mia',    'last_name' => 'Davis',    'dob' => '2015-05-14', 'gender' => 'female'],
                ],
            ],
        ];

        $parentUsers = [];
        $campersByUser = [];

        foreach ($families as $family) {
            $user = User::firstOrCreate(
                ['email' => $family['email']],
                [
                    'name'              => $family['name'],
                    'role_id'           => $parentRole->id,
                    'password'          => Hash::make('password'),
                    'email_verified_at' => now(),
                ]
            );
            $parentUsers[] = $user;

            foreach ($family['campers'] as $c) {
                $camper = Camper::firstOrCreate(
                    ['user_id' => $user->id, 'first_name' => $c['first_name'], 'last_name' => $c['last_name']],
                    ['date_of_birth' => $c['dob'], 'gender' => $c['gender']]
                );
                $campersByUser[$user->id][] = $camper;
            }
        }

        // ── Emergency contacts ─────────────────────────────────────────────────
        $this->seedEmergencyContacts($campersByUser);

        // ── Medical records, diagnoses, allergies ──────────────────────────────
        $this->seedMedicalData($campersByUser);

        // ── Camp & sessions ────────────────────────────────────────────────────
        $camp = Camp::firstOrCreate(
            ['name' => 'Camp Burnt Gin'],
            [
                'description' => 'A residential camp for children and youth with special health care needs (CYSHCN). Located in the beautiful South Carolina Lowcountry, we provide a fully accessible, medically supervised camp experience.',
                'location'    => 'Orangeburg, SC',
                'is_active'   => true,
            ]
        );

        $sessionPast = CampSession::firstOrCreate(
            ['camp_id' => $camp->id, 'name' => 'Session 1 — Summer 2025'],
            [
                'start_date'             => '2025-06-09',
                'end_date'               => '2025-06-13',
                'capacity'               => 60,
                'min_age'                => 6,
                'max_age'                => 17,
                'registration_opens_at'  => '2025-01-15 00:00:00',
                'registration_closes_at' => '2025-05-15 23:59:59',
                'is_active'              => false,
            ]
        );

        $sessionUpcoming = CampSession::firstOrCreate(
            ['camp_id' => $camp->id, 'name' => 'Session 1 — Summer 2026'],
            [
                'start_date'             => '2026-06-08',
                'end_date'               => '2026-06-12',
                'capacity'               => 60,
                'min_age'                => 6,
                'max_age'                => 17,
                'registration_opens_at'  => '2026-01-15 00:00:00',
                'registration_closes_at' => '2026-05-15 23:59:59',
                'is_active'              => true,
            ]
        );

        $sessionUpcoming2 = CampSession::firstOrCreate(
            ['camp_id' => $camp->id, 'name' => 'Session 2 — Summer 2026'],
            [
                'start_date'             => '2026-06-22',
                'end_date'               => '2026-06-26',
                'capacity'               => 60,
                'min_age'                => 6,
                'max_age'                => 17,
                'registration_opens_at'  => '2026-01-15 00:00:00',
                'registration_closes_at' => '2026-05-29 23:59:59',
                'is_active'              => true,
            ]
        );

        // ── Applications ───────────────────────────────────────────────────────
        // Ethan Johnson — approved for upcoming session 1
        $ethan      = $campersByUser[$parentUsers[0]->id][0];
        $appEthan   = Application::firstOrCreate(
            ['camper_id' => $ethan->id, 'camp_session_id' => $sessionUpcoming->id],
            [
                'status'       => ApplicationStatus::Approved,
                'submitted_at' => now()->subDays(20),
                'reviewed_at'  => now()->subDays(10),
                'reviewed_by'  => $admin->id,
                'notes'        => 'Ethan has attended Camp Burnt Gin twice before. Medical team familiar with his care needs. Approved.',
            ]
        );

        // Lily Johnson — pending
        $lily     = $campersByUser[$parentUsers[0]->id][1];
        $appLily  = Application::firstOrCreate(
            ['camper_id' => $lily->id, 'camp_session_id' => $sessionUpcoming->id],
            [
                'status'       => ApplicationStatus::Pending,
                'submitted_at' => now()->subDays(5),
                'reviewed_at'  => null,
                'reviewed_by'  => null,
                'notes'        => null,
            ]
        );

        // Sofia Martinez — under review
        $sofia     = $campersByUser[$parentUsers[1]->id][0];
        $appSofia  = Application::firstOrCreate(
            ['camper_id' => $sofia->id, 'camp_session_id' => $sessionUpcoming->id],
            [
                'status'       => ApplicationStatus::UnderReview,
                'submitted_at' => now()->subDays(14),
                'reviewed_at'  => null,
                'reviewed_by'  => null,
                'notes'        => 'Awaiting updated immunization records and physician clearance letter.',
            ]
        );

        // Noah Thompson — rejected (waitlisted → session full)
        $noah     = $campersByUser[$parentUsers[2]->id][0];
        $appNoah  = Application::firstOrCreate(
            ['camper_id' => $noah->id, 'camp_session_id' => $sessionUpcoming->id],
            [
                'status'       => ApplicationStatus::Rejected,
                'submitted_at' => now()->subDays(30),
                'reviewed_at'  => now()->subDays(22),
                'reviewed_by'  => $admin->id,
                'notes'        => 'Session 1 is at capacity. Applicant has been notified and encouraged to apply for Session 2.',
            ]
        );

        // Noah — second application for session 2, pending
        $appNoah2  = Application::firstOrCreate(
            ['camper_id' => $noah->id, 'camp_session_id' => $sessionUpcoming2->id],
            [
                'status'       => ApplicationStatus::Pending,
                'submitted_at' => now()->subDays(2),
                'reviewed_at'  => null,
                'reviewed_by'  => null,
                'notes'        => null,
            ]
        );

        // Ava Williams — approved, session 2
        $ava     = $campersByUser[$parentUsers[3]->id][0];
        $appAva  = Application::firstOrCreate(
            ['camper_id' => $ava->id, 'camp_session_id' => $sessionUpcoming2->id],
            [
                'status'       => ApplicationStatus::Approved,
                'submitted_at' => now()->subDays(18),
                'reviewed_at'  => now()->subDays(8),
                'reviewed_by'  => $admin->id,
                'notes'        => 'All documents received and verified. Approved.',
            ]
        );

        // Lucas Williams — pending session 1
        $lucas     = $campersByUser[$parentUsers[3]->id][1];
        $appLucas  = Application::firstOrCreate(
            ['camper_id' => $lucas->id, 'camp_session_id' => $sessionUpcoming->id],
            [
                'status'       => ApplicationStatus::Pending,
                'submitted_at' => now()->subDays(3),
                'reviewed_at'  => null,
                'reviewed_by'  => null,
                'notes'        => null,
            ]
        );

        // Mia Davis — past session (approved)
        $mia     = $campersByUser[$parentUsers[4]->id][0];
        $appMia  = Application::firstOrCreate(
            ['camper_id' => $mia->id, 'camp_session_id' => $sessionPast->id],
            [
                'status'       => ApplicationStatus::Approved,
                'submitted_at' => '2025-04-10 10:00:00',
                'reviewed_at'  => '2025-04-20 14:00:00',
                'reviewed_by'  => $admin->id,
                'notes'        => 'Mia attended successfully. Eligible to re-apply.',
            ]
        );

        // ── Conversations ──────────────────────────────────────────────────────
        $this->seedConversations($parentUsers, $admin, $appEthan, $appSofia, $appNoah);

        // ── Announcements ──────────────────────────────────────────────────────
        $this->seedAnnouncements($admin, $sessionUpcoming);

        // ── Calendar events ────────────────────────────────────────────────────
        $this->seedCalendarEvents($admin, $sessionUpcoming, $sessionUpcoming2);

        // ── Audit log entries ──────────────────────────────────────────────────
        $this->seedAuditLog($parentUsers, $admin);

        $this->command->info('Dev data seeded successfully.');
        $this->command->newLine();
        $this->command->line('  Applicant accounts (password: <comment>password</comment>):');
        foreach ($families as $f) {
            $this->command->line("    {$f['email']}");
        }
        $this->command->line('  Admin:   admin@example.com / password');
        $this->command->line('  Medical: medical@example.com / password');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function seedEmergencyContacts(array $campersByUser): void
    {
        $contacts = [
            ['name' => 'Robert Johnson',   'rel' => 'Father',          'phone' => '803-555-0121', 'email' => 'robert.johnson@example.com'],
            ['name' => 'Carlos Martinez',  'rel' => 'Grandfather',     'phone' => '803-555-0134', 'email' => 'carlos.m@example.com'],
            ['name' => 'Linda Thompson',   'rel' => 'Grandmother',     'phone' => '803-555-0145', 'email' => 'linda.t@example.com'],
            ['name' => 'Angela Williams',  'rel' => 'Mother',          'phone' => '803-555-0156', 'email' => 'angela.w@example.com'],
            ['name' => 'Thomas Davis',     'rel' => 'Father',          'phone' => '803-555-0167', 'email' => 'thomas.d@example.com'],
        ];

        $i = 0;
        foreach ($campersByUser as $userId => $campers) {
            $contact = $contacts[$i % count($contacts)];
            foreach ($campers as $camper) {
                if (! EmergencyContact::where('camper_id', $camper->id)->exists()) {
                    EmergencyContact::create([
                        'camper_id'            => $camper->id,
                        'name'                 => $contact['name'],
                        'relationship'         => $contact['rel'],
                        'phone_primary'        => $contact['phone'],
                        'phone_secondary'      => null,
                        'email'                => $contact['email'],
                        'is_primary'           => true,
                        'is_authorized_pickup' => true,
                    ]);
                }
            }
            $i++;
        }
    }

    private function seedMedicalData(array $campersByUser): void
    {
        $medicalProfiles = [
            // Ethan Johnson — Autism + epilepsy (complex)
            [
                'physician'  => 'Dr. Sandra Hill',
                'phone'      => '803-555-0200',
                'insurance'  => 'BlueCross BlueShield',
                'policy'     => 'BCB123456789',
                'notes'      => 'Ethan responds well to routine. Staff should be briefed on his communication preferences.',
                'diagnoses'  => [
                    ['name' => 'Autism Spectrum Disorder', 'description' => 'Level 2 support needs. Verbal but may struggle with transitions.', 'severity' => DiagnosisSeverity::Moderate],
                    ['name' => 'Epilepsy', 'description' => 'Absence seizures, well-controlled on Levetiracetam 500mg twice daily.', 'severity' => DiagnosisSeverity::Moderate],
                ],
                'allergies'  => [
                    ['allergen' => 'Penicillin', 'severity' => AllergySeverity::Severe, 'reaction' => 'Anaphylaxis', 'treatment' => 'Epinephrine auto-injector'],
                ],
            ],
            // Lily Johnson — Asthma (mild)
            [
                'physician'  => 'Dr. Sandra Hill',
                'phone'      => '803-555-0200',
                'insurance'  => 'BlueCross BlueShield',
                'policy'     => 'BCB123456790',
                'notes'      => null,
                'diagnoses'  => [
                    ['name' => 'Asthma', 'description' => 'Mild intermittent. Uses albuterol rescue inhaler as needed.', 'severity' => DiagnosisSeverity::Mild],
                ],
                'allergies'  => [
                    ['allergen' => 'Tree pollen', 'severity' => AllergySeverity::Mild, 'reaction' => 'Rhinitis, watery eyes', 'treatment' => 'Cetirizine 5mg daily'],
                ],
            ],
            // Sofia Martinez — Cerebral palsy + spina bifida
            [
                'physician'  => 'Dr. James Owens',
                'phone'      => '803-555-0211',
                'insurance'  => 'Aetna',
                'policy'     => 'AET987654321',
                'notes'      => 'Sofia uses a manual wheelchair. Bladder management program (intermittent catheterization every 4 hours).',
                'diagnoses'  => [
                    ['name' => 'Spastic Cerebral Palsy (Diplegia)', 'description' => 'GMFCS Level III. Can walk short distances with walker; uses wheelchair for longer distances.', 'severity' => DiagnosisSeverity::Moderate],
                    ['name' => 'Spina Bifida (Myelomeningocele, L3)', 'description' => 'Repaired at birth. Neurogenic bladder and bowel managed on protocol.', 'severity' => DiagnosisSeverity::Severe],
                ],
                'allergies'  => [],
            ],
            // Noah Thompson — Down syndrome
            [
                'physician'  => 'Dr. Rachel Kim',
                'phone'      => '803-555-0222',
                'insurance'  => 'United Healthcare',
                'policy'     => 'UHC456789123',
                'notes'      => 'Noah is very social and enthusiastic. Annual cardiac follow-up completed; cleared for physical activity.',
                'diagnoses'  => [
                    ['name' => 'Down Syndrome (Trisomy 21)', 'description' => 'Mosaic presentation. Mild intellectual disability. Atlantoaxial instability cleared by neurology.', 'severity' => DiagnosisSeverity::Moderate],
                    ['name' => 'Hypothyroidism', 'description' => 'On Levothyroxine 50mcg daily. Last TSH normal.', 'severity' => DiagnosisSeverity::Mild],
                ],
                'allergies'  => [
                    ['allergen' => 'Latex', 'severity' => AllergySeverity::Severe, 'reaction' => 'Contact dermatitis and urticaria', 'treatment' => 'Remove latex; Benadryl for mild reactions; Epipen if systemic'],
                ],
            ],
            // Ava Williams — Type 1 Diabetes
            [
                'physician'  => 'Dr. Maria Gonzalez',
                'phone'      => '803-555-0233',
                'insurance'  => 'Cigna',
                'policy'     => 'CIG321654987',
                'notes'      => 'Ava wears a Dexcom CGM and uses an OmniPod insulin pump. Staff must understand pump alarms and how to treat hypoglycemia.',
                'diagnoses'  => [
                    ['name' => 'Type 1 Diabetes Mellitus', 'description' => 'Diagnosed age 5. Continuous glucose monitor + insulin pump. Target BG 80–180 mg/dL.', 'severity' => DiagnosisSeverity::Severe],
                ],
                'allergies'  => [
                    ['allergen' => 'Amoxicillin', 'severity' => AllergySeverity::Moderate, 'reaction' => 'Hives and GI upset', 'treatment' => 'Avoid; use alternative antibiotics'],
                ],
            ],
            // Lucas Williams — Muscular Dystrophy
            [
                'physician'  => 'Dr. Maria Gonzalez',
                'phone'      => '803-555-0233',
                'insurance'  => 'Cigna',
                'policy'     => 'CIG321654988',
                'notes'      => 'Lucas uses a power wheelchair. Nighttime BiPAP support required. Respiratory status should be monitored.',
                'diagnoses'  => [
                    ['name' => 'Duchenne Muscular Dystrophy', 'description' => 'Stage 4 (non-ambulatory). On Deflazacort 18mg daily. Cardiac MRI — mildly reduced EF, on ACE inhibitor.', 'severity' => DiagnosisSeverity::Severe],
                ],
                'allergies'  => [],
            ],
            // Mia Davis — Sickle Cell
            [
                'physician'  => 'Dr. Kevin Patel',
                'phone'      => '803-555-0244',
                'insurance'  => 'Medicaid',
                'policy'     => 'MC789123456',
                'notes'      => 'Mia must stay well-hydrated and avoid extreme heat. Hydroxyurea 500mg daily. Pain crisis protocol on file.',
                'diagnoses'  => [
                    ['name' => 'Sickle Cell Disease (HbSS)', 'description' => 'On hydroxyurea. History of 2 acute chest syndrome episodes. Last hospitalization 18 months ago.', 'severity' => DiagnosisSeverity::Severe],
                    ['name' => 'Avascular Necrosis (right hip)', 'description' => 'Mild; managed conservatively. No joint replacement needed at this time.', 'severity' => DiagnosisSeverity::Mild],
                ],
                'allergies'  => [
                    ['allergen' => 'NSAIDs', 'severity' => AllergySeverity::Moderate, 'reaction' => 'Worsening renal function and pain', 'treatment' => 'Avoid ibuprofen/naproxen; use acetaminophen only'],
                ],
            ],
        ];

        $allCampers = collect($campersByUser)->flatten()->values();
        foreach ($allCampers as $idx => $camper) {
            if (MedicalRecord::where('camper_id', $camper->id)->exists()) {
                continue;
            }
            $profile = $medicalProfiles[$idx] ?? $medicalProfiles[0];

            MedicalRecord::create([
                'camper_id'             => $camper->id,
                'physician_name'        => $profile['physician'],
                'physician_phone'       => $profile['phone'],
                'insurance_provider'    => $profile['insurance'],
                'insurance_policy_number' => $profile['policy'],
                'notes'                 => $profile['notes'],
            ]);

            foreach ($profile['diagnoses'] as $d) {
                Diagnosis::create([
                    'camper_id'      => $camper->id,
                    'name'           => $d['name'],
                    'description'    => $d['description'],
                    'severity_level' => $d['severity'],
                ]);
            }

            foreach ($profile['allergies'] as $a) {
                Allergy::create([
                    'camper_id' => $camper->id,
                    'allergen'  => $a['allergen'],
                    'severity'  => $a['severity'],
                    'reaction'  => $a['reaction'],
                    'treatment' => $a['treatment'],
                ]);
            }
        }
    }

    private function seedConversations(array $parents, User $admin, Application $appEthan, Application $appSofia, Application $appNoah): void
    {
        // Helper to create/reuse a conversation with participants and messages
        $makeConv = function (string $subject, User $creator, array $participants, array $messages, ?int $applicationId = null, string $category = 'general') {
            if (Conversation::where('subject', $subject)->exists()) {
                return;
            }
            $conv = Conversation::create([
                'created_by_id'  => $creator->id,
                'subject'        => $subject,
                'category'       => $category,
                'application_id' => $applicationId,
                'last_message_at' => now()->subHours(rand(1, 72)),
                'is_archived'    => false,
            ]);

            foreach (array_unique(array_merge([$creator->id], array_column($participants, 'id'))) as $uid) {
                ConversationParticipant::create([
                    'conversation_id' => $conv->id,
                    'user_id'         => $uid,
                    'joined_at'       => now()->subDays(rand(1, 14)),
                ]);
            }

            foreach ($messages as $msg) {
                Message::create([
                    'conversation_id'  => $conv->id,
                    'sender_id'        => $msg['sender']->id,
                    'body'             => $msg['body'],
                    'idempotency_key'  => Str::uuid()->toString(),
                    'created_at'       => now()->subMinutes(rand(5, 4320)),
                ]);
            }
        };

        $sarah   = $parents[0];
        $david   = $parents[1];
        $jennifer = $parents[2];

        // Thread 1: Sarah asks about Ethan's application
        $makeConv(
            "Ethan Johnson — Session 1 Application Question",
            $sarah,
            [$admin],
            [
                ['sender' => $sarah, 'body' => "Hi, I submitted Ethan's application for Session 1 about three weeks ago and wanted to check on the status. He is so excited about camp this year!"],
                ['sender' => $admin, 'body' => "Hi Sarah! Great news — Ethan's application has been approved. Our medical team has reviewed his file and everything looks great. You should receive an official confirmation email shortly with next steps."],
                ['sender' => $sarah, 'body' => "That is wonderful! Thank you so much. Should I send his updated seizure action plan now, or wait for the pre-camp packet?"],
                ['sender' => $admin, 'body' => "Please go ahead and send it now so we can get it to our nursing staff early. You can attach it in a new message here or email it to us at medical@campburntgin.org. We want to be fully prepared for Ethan."],
            ],
            $appEthan->id,
            'application'
        );

        // Thread 2: David inquires about Sofia's missing documents
        $makeConv(
            "Sofia Martinez — Missing Documents",
            $admin,
            [$david],
            [
                ['sender' => $admin, 'body' => "Hi David, I'm following up on Sofia's application. We're currently under review and need two things to move forward: (1) an updated immunization record from her pediatrician, and (2) a physician clearance letter confirming she is cleared for camp participation. Could you send those by the end of the week?"],
                ['sender' => $david, 'body' => "Of course, I'll contact Dr. Owens's office today. Sofia's annual exam was last month so the immunizations should be up to date. I'll have them send the records directly — what email should they use?"],
                ['sender' => $admin, 'body' => "They can send records to records@campburntgin.org and reference Sofia's application ID. Thank you for the quick response, David!"],
                ['sender' => $david, 'body' => "Done — Dr. Owens's office said they'll fax the clearance letter by Friday and email the immunization record tomorrow. Let me know if you need anything else."],
            ],
            $appSofia->id,
            'application'
        );

        // Thread 3: Jennifer venting about rejection, then reapplying
        $makeConv(
            "Noah Thompson — Session 2 Application",
            $jennifer,
            [$admin],
            [
                ['sender' => $jennifer, 'body' => "Hi, I received the email that Noah's Session 1 application was rejected due to capacity. I understand but we're disappointed. You mentioned we could apply for Session 2 — I've done that now. Will his existing medical file carry over?"],
                ['sender' => $admin, 'body' => "Hi Jennifer, I'm so sorry for the disappointment. Yes — all of Noah's medical records and forms are already on file. His Session 2 application will move much faster through review. Thank you for reapplying!"],
                ['sender' => $jennifer, 'body' => "That's a relief. Noah is really looking forward to this. Please let me know if there's anything else needed."],
            ],
            $appNoah->id,
            'general'
        );

        // Thread 4: General medical question from Jennifer
        $makeConv(
            "Latex Allergy Protocol — Noah Thompson",
            $jennifer,
            [$admin],
            [
                ['sender' => $jennifer, 'body' => "I want to make sure the camp is aware of Noah's severe latex allergy. He had a significant reaction two years ago. Does camp have a latex-free environment policy?"],
                ['sender' => $admin, 'body' => "Absolutely, Jennifer. We maintain a latex-safe environment throughout the entire camp. Our nursing staff is briefed on all allergy protocols before campers arrive. Noah's Epipen will be with nursing staff and copies will be at each activity station. We've handled latex-allergic campers many times."],
            ],
            null,
            'medical'
        );

        // Thread 5: General inquiry from Sarah about packing list
        $makeConv(
            "Packing List & Drop-Off Instructions",
            $sarah,
            [$admin],
            [
                ['sender' => $sarah, 'body' => "Hi! When will the packing list and drop-off time/location be sent out for Session 1?"],
                ['sender' => $admin, 'body' => "Hi Sarah! We'll send the full pre-camp packet (packing list, drop-off instructions, medication form, and schedule overview) 6 weeks before the session start date — so around late April. We'll also post it in the announcements here. Keep an eye out!"],
                ['sender' => $sarah, 'body' => "Perfect, thank you!"],
            ],
            null,
            'general'
        );
    }

    private function seedAnnouncements(User $admin, CampSession $session): void
    {
        $announcements = [
            [
                'title'        => 'Registration Now Open — Session 1 & Session 2, Summer 2026',
                'body'         => "We are thrilled to announce that registration for Summer 2026 is now open! Applications are accepted on a rolling basis. Session 1 runs June 8–12 and Session 2 runs June 22–26.\n\nAll camper medical records, physician clearance letters, and required documents must be received no later than May 15 (Session 1) or May 29 (Session 2) for your application to be considered complete.\n\nQuestions? Message us in the inbox or email admissions@campburntgin.org.",
                'is_pinned'    => true,
                'is_urgent'    => false,
                'audience'     => 'all',
                'published_at' => now()->subDays(45),
            ],
            [
                'title'        => 'URGENT: Medication Form Update Required Before April 1',
                'body'         => "All applicants with approved applications for Summer 2026 must complete and submit the updated Medication Administration Authorization Form (MAA Form Rev. 2026) by April 1, 2026.\n\nThis is a new South Carolina DSS requirement for all residential camps serving children with special health care needs. The form can be downloaded from the Forms section of your applicant portal.\n\nIf you have questions, please message our nursing staff directly through the inbox.",
                'is_pinned'    => true,
                'is_urgent'    => true,
                'audience'     => 'parent',
                'published_at' => now()->subDays(10),
            ],
            [
                'title'        => 'Pre-Camp Medical Review — Scheduling Now Open',
                'body'         => "We are now scheduling optional pre-camp telehealth consultations with our camp nursing director for families of first-time campers or campers with complex medical needs.\n\nThese 20-minute calls allow our clinical team to review your camper's care plan, ask questions, and ensure we have everything needed for a safe and successful camp experience.\n\nTo schedule, reply to this announcement or message us in the inbox.",
                'is_pinned'    => false,
                'is_urgent'    => false,
                'audience'     => 'parent',
                'published_at' => now()->subDays(25),
            ],
            [
                'title'        => 'Staff Orientation — March 14–15, 2026',
                'body'         => "All seasonal staff are required to attend in-person orientation on March 14–15 at Camp Burnt Gin (250 Camp Road, Orangeburg, SC 29118). Check-in begins at 8:30 AM on March 14.\n\nTopics covered: HIPAA & FERPA compliance, emergency protocols, disability awareness training, medication administration refresher, and camper behavioral support strategies.\n\nPlease confirm attendance by replying to this announcement.",
                'is_pinned'    => false,
                'is_urgent'    => false,
                'audience'     => 'admin',
                'published_at' => now()->subDays(18),
            ],
            [
                'title'        => 'Welcome to the Camp Burnt Gin Applicant Portal',
                'body'         => "Welcome to the Camp Burnt Gin applicant portal. Here you can:\n\n• Submit and track your camper's application\n• Message our team directly\n• Access announcements and camp updates\n• Download required forms and documents\n\nWe're glad you're here and look forward to making this a memorable summer for your family. If you have any questions at any time, don't hesitate to reach out via the inbox.",
                'is_pinned'    => false,
                'is_urgent'    => false,
                'audience'     => 'parent',
                'published_at' => now()->subDays(60),
            ],
        ];

        foreach ($announcements as $a) {
            if (! Announcement::where('title', $a['title'])->exists()) {
                Announcement::create(array_merge($a, ['author_id' => $admin->id, 'target_session_id' => null]));
            }
        }
    }

    private function seedCalendarEvents(User $admin, CampSession $session1, CampSession $session2): void
    {
        $events = [
            // Deadlines
            ['title' => 'Session 1 Application Deadline', 'type' => 'deadline', 'color' => '#dc2626', 'start' => '2026-05-15 23:59:00', 'end' => '2026-05-15 23:59:00', 'all_day' => true, 'audience' => 'all'],
            ['title' => 'Session 2 Application Deadline', 'type' => 'deadline', 'color' => '#dc2626', 'start' => '2026-05-29 23:59:00', 'end' => '2026-05-29 23:59:00', 'all_day' => true, 'audience' => 'all'],
            ['title' => 'Medication Forms Due (Session 1)', 'type' => 'deadline', 'color' => '#f59e0b', 'start' => '2026-04-01 23:59:00', 'end' => '2026-04-01 23:59:00', 'all_day' => true, 'audience' => 'parent'],
            // Sessions
            ['title' => 'Session 1 — Summer 2026', 'type' => 'session', 'color' => '#16a34a', 'start' => '2026-06-08 08:00:00', 'end' => '2026-06-12 17:00:00', 'all_day' => false, 'audience' => 'all'],
            ['title' => 'Session 2 — Summer 2026', 'type' => 'session', 'color' => '#16a34a', 'start' => '2026-06-22 08:00:00', 'end' => '2026-06-26 17:00:00', 'all_day' => false, 'audience' => 'all'],
            // Orientations
            ['title' => 'Staff Orientation Day 1', 'type' => 'orientation', 'color' => '#7c3aed', 'start' => '2026-03-14 08:30:00', 'end' => '2026-03-14 17:00:00', 'all_day' => false, 'audience' => 'admin'],
            ['title' => 'Staff Orientation Day 2', 'type' => 'orientation', 'color' => '#7c3aed', 'start' => '2026-03-15 08:30:00', 'end' => '2026-03-15 17:00:00', 'all_day' => false, 'audience' => 'admin'],
            ['title' => 'Family Pre-Camp Info Night (Virtual)', 'type' => 'orientation', 'color' => '#0891b2', 'start' => '2026-05-20 18:00:00', 'end' => '2026-05-20 19:30:00', 'all_day' => false, 'audience' => 'parent'],
            // Internal
            ['title' => 'Medical Records Review — Session 1 Cohort', 'type' => 'internal', 'color' => '#475569', 'start' => '2026-05-22 09:00:00', 'end' => '2026-05-22 12:00:00', 'all_day' => false, 'audience' => 'admin'],
            ['title' => 'Medical Records Review — Session 2 Cohort', 'type' => 'internal', 'color' => '#475569', 'start' => '2026-06-05 09:00:00', 'end' => '2026-06-05 12:00:00', 'all_day' => false, 'audience' => 'admin'],
            ['title' => 'Post-Camp Debrief & Documentation', 'type' => 'internal', 'color' => '#475569', 'start' => '2026-06-29 10:00:00', 'end' => '2026-06-29 13:00:00', 'all_day' => false, 'audience' => 'admin'],
        ];

        foreach ($events as $e) {
            if (! CalendarEvent::where('title', $e['title'])->exists()) {
                CalendarEvent::create([
                    'created_by'       => $admin->id,
                    'title'            => $e['title'],
                    'description'      => null,
                    'event_type'       => $e['type'],
                    'color'            => $e['color'],
                    'starts_at'        => $e['start'],
                    'ends_at'          => $e['end'],
                    'all_day'          => $e['all_day'],
                    'audience'         => $e['audience'],
                    'target_session_id' => null,
                ]);
            }
        }
    }

    private function seedAuditLog(array $parents, User $admin): void
    {
        $entries = [
            [
                'user_id'       => $admin->id,
                'event_type'    => 'admin_action',
                'action'        => 'application.approved',
                'description'   => 'Approved application for Ethan Johnson (Session 1 — Summer 2026)',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id'  => 1,
                'ip_address'    => '127.0.0.1',
                'user_agent'    => 'Mozilla/5.0',
            ],
            [
                'user_id'       => $admin->id,
                'event_type'    => 'admin_action',
                'action'        => 'application.rejected',
                'description'   => 'Rejected application for Noah Thompson (Session 1 — Summer 2026): session at capacity',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id'  => 2,
                'ip_address'    => '127.0.0.1',
                'user_agent'    => 'Mozilla/5.0',
            ],
            [
                'user_id'       => $parents[0]->id,
                'event_type'    => 'auth',
                'action'        => 'login',
                'description'   => 'User logged in successfully',
                'auditable_type' => null,
                'auditable_id'  => null,
                'ip_address'    => '192.168.1.100',
                'user_agent'    => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
            ],
            [
                'user_id'       => $parents[1]->id,
                'event_type'    => 'phi_access',
                'action'        => 'camper.medical_record.viewed',
                'description'   => 'Applicant viewed medical record for Sofia Martinez',
                'auditable_type' => 'App\\Models\\MedicalRecord',
                'auditable_id'  => 1,
                'ip_address'    => '10.0.0.45',
                'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0)',
            ],
            [
                'user_id'       => $admin->id,
                'event_type'    => 'admin_action',
                'action'        => 'announcement.created',
                'description'   => 'Published announcement: Registration Now Open — Session 1 & Session 2, Summer 2026',
                'auditable_type' => 'App\\Models\\Announcement',
                'auditable_id'  => 1,
                'ip_address'    => '127.0.0.1',
                'user_agent'    => 'Mozilla/5.0',
            ],
        ];

        foreach ($entries as $entry) {
            AuditLog::create(array_merge($entry, [
                'request_id' => Str::uuid()->toString(),
                'old_values' => null,
                'new_values' => null,
                'metadata'   => null,
            ]));
        }
    }
}
