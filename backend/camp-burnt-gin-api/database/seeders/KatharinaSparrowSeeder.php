<?php

namespace Database\Seeders;

use App\Enums\ActivityPermissionLevel;
use App\Enums\AllergySeverity;
use App\Enums\DiagnosisSeverity;
use App\Models\ActivityPermission;
use App\Models\Allergy;
use App\Models\Application;
use App\Models\ApplicationConsent;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\Diagnosis;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use App\Models\Medication;
use App\Models\PersonalCarePlan;
use Illuminate\Database\Seeder;

/**
 * Populates the existing draft application for Katharina Sparrow (camper_id=1).
 *
 * Account owner: Jack Frost (tennighty@gmail.com)
 * This seeder adds all clinical and application data to the pre-existing records.
 * Application status remains 'draft'. submitted_at stays NULL. Nothing is submitted.
 *
 * Safe to re-run — uses firstOrCreate / updateOrCreate patterns throughout.
 *
 * Run: php artisan db:seed --class=KatharinaSparrowSeeder
 */
class KatharinaSparrowSeeder extends Seeder
{
    public function run(): void
    {
        $camper = Camper::findOrFail(1);
        $app = Application::findOrFail(1);

        $this->command->info("Populating Katharina Sparrow (camper_id={$camper->id}, application_id={$app->id})...");

        $this->updateCamperDemographics($camper);
        $this->addEmergencyContacts($camper);
        $this->populateMedicalRecord($camper);
        $this->createDiagnoses($camper);
        $this->createMedications($camper);
        $this->createAllergies($camper);
        $this->createBehavioralProfile($camper);
        $this->createPersonalCarePlan($camper);
        $this->createActivityPermissions($camper);
        $this->updateApplicationNarratives($app);
        $this->createConsents($app);

        $this->printSummary($camper, $app);
    }

    private function updateCamperDemographics(Camper $camper): void
    {
        $camper->update([
            'county' => 'Lexington',
            'preferred_name' => 'Kat',
            'needs_interpreter' => false,
            'preferred_language' => 'en',
        ]);
        $this->command->line('  [1/11] Camper demographics updated (county, preferred_name).');
    }

    private function addEmergencyContacts(Camper $camper): void
    {
        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'phone_primary' => '803-555-7741'],
            [
                'name' => 'Marcus Sparrow',
                'relationship' => 'Father',
                'phone_secondary' => '803-555-7742',
                'email' => 'marcus.sparrow@example.com',
                'is_primary' => false,
                'is_authorized_pickup' => true,
                'is_guardian' => true,
                'address' => '88 Carriage Hill Drive',
                'city' => 'Lexington',
                'state' => 'SC',
                'zip' => '29072',
                'phone_work' => '803-555-7743',
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        EmergencyContact::firstOrCreate(
            ['camper_id' => $camper->id, 'phone_primary' => '803-555-4490'],
            [
                'name' => 'Dorothy Odom',
                'relationship' => 'Maternal Grandmother',
                'phone_secondary' => null,
                'email' => 'dorothy.odom@example.com',
                'is_primary' => false,
                'is_authorized_pickup' => false,
                'is_guardian' => false,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ]
        );

        $this->command->line('  [2/11] Emergency contacts added (Marcus Sparrow + Dorothy Odom).');
    }

    private function populateMedicalRecord(Camper $camper): void
    {
        MedicalRecord::where('camper_id', $camper->id)->update([
            'physician_name' => 'Dr. Angela Pryor',
            'physician_phone' => '803-359-2200',
            'physician_address' => '2720 Sunset Blvd, West Columbia, SC 29169',
            'insurance_provider' => 'South Carolina Healthy Connections (Medicaid)',
            'insurance_policy_number' => 'SC-HCM-2026-88341',
            'insurance_group' => 'SCHCP-LEX',
            'immunizations_current' => true,
            'tetanus_date' => '2023-09-14',
            'has_seizures' => false,
            'has_neurostimulator' => false,
            'has_contagious_illness' => false,
            'tubes_in_ears' => false,
            'has_recent_illness' => false,
            'date_of_medical_exam' => '2026-02-27',
            'special_needs' => 'ADHD (Combined Type) — responds well to clear, brief instructions (1–2 steps). '.
                'Mild persistent asthma — albuterol rescue inhaler kept with camp nurse; '.
                'pre-treat with inhaler 15 min before vigorous physical activity. '.
                'Penicillin allergy on file. No latex allergy. No dietary restrictions.',
            'dietary_restrictions' => null,
            'notes' => 'Katharina ("Kat") is enthusiastic, social, and motivated when given '.
                'appropriate structure. ADHD is managed with medication (Methylphenidate ER). '.
                'Asthma is well-controlled; last ER visit for asthma was over 3 years ago. '.
                'No cardiac conditions. No seizure history. Cleared by Dr. Pryor for all '.
                'camp activities with standard asthma precautions in place.',
        ]);
        $this->command->line('  [3/11] Medical record populated.');
    }

    private function createDiagnoses(Camper $camper): void
    {
        Diagnosis::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Attention-Deficit/Hyperactivity Disorder (ADHD)'],
            [
                'description' => 'Combined presentation (inattentive + hyperactive-impulsive). Diagnosed age 7. '.
                    'Managed with Methylphenidate ER 18mg QAM. Responds well to structured '.
                    'environments, visual schedules, and short-burst activity rotations. '.
                    'Strong reading and verbal skills.',
                'severity_level' => DiagnosisSeverity::Moderate,
                'notes' => 'Mornings may be slower before medication takes effect (~1 hr after dose). '.
                    'Seat Kat near the front during structured sessions. Transitions with a '.
                    '2-min warning work well. Brief specific praise keeps her highly motivated.',
            ]
        );

        Diagnosis::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Mild Persistent Asthma'],
            [
                'description' => 'Mild persistent asthma, well-controlled. Triggers: cold air, high pollen, '.
                    'vigorous sustained exercise, and smoke. No hospitalizations in 3+ years.',
                'severity_level' => DiagnosisSeverity::Mild,
                'notes' => 'Pre-exercise albuterol protocol in place. Camp nurse to hold rescue inhaler. '.
                    'If peak flow < 80% or chest tightness: administer albuterol and rest. '.
                    'No improvement in 20 min → call 911.',
            ]
        );
        $this->command->line('  [4/11] Diagnoses created (ADHD + Mild Persistent Asthma).');
    }

    private function createMedications(Camper $camper): void
    {
        Medication::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Methylphenidate ER (Concerta)'],
            [
                'dosage' => '18 mg',
                'frequency' => 'Once daily in the morning (7:00–8:00 AM)',
                'purpose' => 'ADHD — attention, impulse control, and executive function support',
                'prescribing_physician' => 'Dr. Angela Pryor',
                'notes' => 'Extended-release tablet — do NOT crush or chew. Administer with or without food. '.
                    'If dose is missed in the morning, skip for that day (do not give afternoon dose). '.
                    'Common side effect: reduced appetite at lunch — encourage eating regardless.',
            ]
        );

        Medication::firstOrCreate(
            ['camper_id' => $camper->id, 'name' => 'Albuterol Sulfate HFA Inhaler'],
            [
                'dosage' => '2 puffs (90 mcg/puff)',
                'frequency' => 'As needed (PRN) for symptoms OR 15 min before vigorous exercise',
                'purpose' => 'Asthma rescue — bronchospasm relief and exercise-induced bronchoconstriction prevention',
                'prescribing_physician' => 'Dr. Angela Pryor',
                'notes' => 'Rescue inhaler — keep with camp nurse at all times. '.
                    'Shake before use. Wait 1 full minute between puffs. '.
                    'If no relief after 2 puffs: administer 2 more and seek medical evaluation.',
            ]
        );
        $this->command->line('  [5/11] Medications created (Methylphenidate ER + Albuterol).');
    }

    private function createAllergies(Camper $camper): void
    {
        Allergy::firstOrCreate(
            ['camper_id' => $camper->id, 'allergen' => 'Penicillin (and related beta-lactam antibiotics)'],
            [
                'severity' => AllergySeverity::Moderate,
                'reaction' => 'Urticarial rash (hives), mild facial flushing, and localized swelling '.
                    'within 30–60 minutes of exposure. No anaphylaxis history.',
                'treatment' => 'Administer Diphenhydramine (Benadryl) 25 mg oral immediately. '.
                    'Monitor for progression. Contact parent and physician if symptoms spread '.
                    'or respiratory symptoms develop. No EpiPen required (no anaphylaxis history).',
            ]
        );

        Allergy::firstOrCreate(
            ['camper_id' => $camper->id, 'allergen' => 'Bee stings (Hymenoptera venom)'],
            [
                'severity' => AllergySeverity::Mild,
                'reaction' => 'Localized swelling and pain at sting site. Mild redness extending up to ~5 cm. '.
                    'No systemic reaction history.',
                'treatment' => 'Remove stinger (scrape — do NOT squeeze). Apply ice pack. '.
                    'Hydrocortisone cream topically for itch. Diphenhydramine 25 mg if pronounced swelling. '.
                    'Notify nurse for documentation.',
            ]
        );
        $this->command->line('  [6/11] Allergies created (Penicillin + Bee stings).');
    }

    private function createBehavioralProfile(Camper $camper): void
    {
        if (BehavioralProfile::where('camper_id', $camper->id)->exists()) {
            $this->command->line('  [7/11] Behavioral profile already exists — skipped.');

            return;
        }

        BehavioralProfile::create([
            'camper_id' => $camper->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => false,
            'developmental_delay' => false,
            'functioning_age_level' => 'Age-appropriate (11 years)',
            'communication_methods' => ['verbal'],
            'notes' => 'Kat is socially engaged, talkative, and enthusiastic. ADHD behaviors '.
                '(fidgeting, difficulty sitting still, occasional impulsivity) are manageable '.
                'with structure and brief positive reinforcement. No aggression. No self-injurious '.
                'behavior. No elopement history. When frustrated, prefers a 5-min quiet break '.
                'before re-engaging. Responds very well to specific praise.',
            'functional_reading' => true,
            'functional_writing' => true,
            'independent_mobility' => true,
            'verbal_communication' => true,
            'social_skills' => true,
            'behavior_plan' => false,
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => false,
            'follows_instructions' => true,
            'group_participation' => true,
            'attends_school' => true,
            'classroom_type' => 'General education with pull-out resource support (math and reading)',
        ]);
        $this->command->line('  [7/11] Behavioral profile created.');
    }

    private function createPersonalCarePlan(Camper $camper): void
    {
        if (PersonalCarePlan::where('camper_id', $camper->id)->exists()) {
            $this->command->line('  [8/11] Personal care plan already exists — skipped.');

            return;
        }

        PersonalCarePlan::create([
            'camper_id' => $camper->id,
            'bathing_level' => 'verbal_cue',
            'bathing_notes' => 'Independently manages bathing but needs a reminder to wash hair thoroughly. Prompt once — she follows through without further assistance.',
            'toileting_level' => 'independent',
            'toileting_notes' => null,
            'nighttime_toileting' => false,
            'nighttime_notes' => 'No nighttime concerns. Falls asleep readily after active days.',
            'dressing_level' => 'verbal_cue',
            'dressing_notes' => 'Independent for most clothing. May need a verbal prompt to ensure attire is appropriate for the activity or weather.',
            'oral_hygiene_level' => 'independent',
            'oral_hygiene_notes' => null,
            'positioning_notes' => null,
            'sleep_notes' => 'Standard sleep routine. No special positioning required.',
            'falling_asleep_issues' => false,
            'sleep_walking' => false,
            'night_wandering' => false,
            'bowel_control_notes' => null,
            'urinary_catheter' => false,
            'irregular_bowel' => false,
            'irregular_bowel_notes' => null,
            'menstruation_support' => false,
        ]);
        $this->command->line('  [8/11] Personal care plan created.');
    }

    private function createActivityPermissions(Camper $camper): void
    {
        $permissions = [
            'sports_games' => [
                ActivityPermissionLevel::Restricted,
                'Permitted with modification — avoid sustained high-intensity runs > 10 min without a water break due to asthma. Pre-exercise albuterol protocol applies. All other sports and games fully permitted.',
            ],
            'arts_crafts' => [ActivityPermissionLevel::Yes, null],
            'nature' => [ActivityPermissionLevel::Yes, null],
            'fine_arts' => [ActivityPermissionLevel::Yes, null],
            'swimming' => [ActivityPermissionLevel::Yes, null],
            'boating' => [ActivityPermissionLevel::Yes, null],
            'camp_out' => [
                ActivityPermissionLevel::Restricted,
                'Permitted — ensure rescue inhaler travels with the group overnight. Check air quality before departure; cold night air may be a mild trigger. Ensure adequate layering.',
            ],
        ];

        foreach ($permissions as $slug => [$level, $notes]) {
            ActivityPermission::firstOrCreate(
                ['camper_id' => $camper->id, 'activity_name' => $slug],
                ['permission_level' => $level, 'restriction_notes' => $notes]
            );
        }
        $this->command->line('  [9/11] Activity permissions created (7 canonical slugs).');
    }

    private function updateApplicationNarratives(Application $app): void
    {
        $app->update([
            'first_application' => true,
            'attended_before' => false,

            'narrative_rustic_environment' => 'Kat is an active, outdoor-loving child who enjoys hiking and nature activities. '.
                'She has attended a 4-H day camp previously and adapted well to the outdoor environment. '.
                'She understands that camp conditions differ from home and is genuinely excited about '.
                'the experience. Her asthma is well-controlled and has not been a barrier to outdoor '.
                'activities when standard precautions are followed.',

            'narrative_staff_suggestions' => 'Kat does best when instructions are short and direct (1–2 steps at a time). '.
                'Brief, specific praise keeps her highly motivated. If she seems distracted, a '.
                '5-minute quiet break typically resets her focus. Morning hours before her '.
                'Methylphenidate takes effect (~7–9 AM) may require extra patience and gentle '.
                'redirection. She loves humor and connects quickly with warm, consistent staff.',

            'narrative_participation_concerns' => 'No significant concerns about full participation. The only physical limitation is '.
                'exercise-induced asthma, which is well-managed with her pre-exercise albuterol '.
                'protocol. Staff should ensure the rescue inhaler is accessible during all physical '.
                'activities. ADHD may occasionally affect group cohesion (impulsive comments), but '.
                'Kat is self-aware and responds positively to redirection.',

            'narrative_camp_benefit' => 'Camp Burnt Gin offers exactly the structured, supportive environment where Kat '.
                'thrives. She has a natural curiosity about nature and the arts, and flourishes '.
                'when given the chance to channel her energy into hands-on activities. Peer '.
                'connection is particularly important — camp provides an opportunity to build '.
                'friendships in a low-stakes, inclusive environment. We believe this experience '.
                'will build her confidence and independence significantly.',

            'narrative_heat_tolerance' => 'Kat tolerates heat reasonably well and is comfortable outdoors. Standard hydration '.
                'reminders are sufficient. Hot, humid air may occasionally exacerbate asthma, so '.
                'monitoring during peak afternoon heat is recommended. She should have regular water '.
                'breaks and access to shade during sustained outdoor activity.',

            'narrative_transportation' => 'No special transportation accommodations required. Kat can ride a standard camp bus. '.
                'She does not experience motion sickness. Ensure rescue inhaler is accessible during '.
                'transport (not in checked luggage).',

            'narrative_additional_info' => 'Kat is a bright, funny, and determined child who rises to challenges when given '.
                'the right support. She is highly motivated by creative activities and competitive '.
                'team games. Her favorite subjects are art and science. She has expressed '.
                'considerable excitement about the swimming and nature programs. Family will provide '.
                'a laminated copy of her asthma action plan to attach to her camp file.',

            'narrative_emergency_protocols' => 'For asthma emergencies: administer rescue inhaler (albuterol 2 puffs), have Kat '.
                'sit upright in a calm space, recheck in 20 minutes. If no improvement, call 911. '.
                'Primary contact: Jane Foster (980-254-3690). Secondary: Marcus Sparrow (803-555-7741). '.
                'Dr. Angela Pryor: 803-359-2200. For behavioral escalation, remove Kat from the '.
                'stimulating environment, offer quiet space, and contact parent if self-regulation '.
                'is not achieved within 15 minutes.',
        ]);
        $this->command->line('  [10/11] Application narratives and flags updated.');
    }

    private function createConsents(Application $app): void
    {
        $signedAt = now()->subDays(2);

        foreach (ApplicationConsent::requiredTypes() as $type) {
            ApplicationConsent::firstOrCreate(
                ['application_id' => $app->id, 'consent_type' => $type],
                [
                    'guardian_name' => 'Jane Foster',
                    'guardian_relationship' => 'Guardian',
                    'guardian_signature' => 'Jane Foster',
                    'applicant_signature' => null,
                    'signed_at' => $signedAt,
                ]
            );
        }
        $this->command->line('  [11/11] Application consents created (7 types, guardian: Jane Foster).');
    }

    private function printSummary(Camper $camper, Application $app): void
    {
        $app->refresh();

        $this->command->newLine();
        $this->command->info('=== Population complete ===');
        $this->command->table(
            ['Field', 'Value'],
            [
                ['Camper', "Katharina Sparrow (ID={$camper->id})"],
                ['Application', "ID={$app->id}, status=".$app->getRawOriginal('status')],
                ['submitted_at', $app->submitted_at ? $app->submitted_at->toDateTimeString() : 'NULL (draft — not submitted)'],
                ['Emergency contacts', (string) EmergencyContact::where('camper_id', $camper->id)->count()],
                ['Diagnoses', (string) \App\Models\Diagnosis::where('camper_id', $camper->id)->count()],
                ['Medications', (string) \App\Models\Medication::where('camper_id', $camper->id)->count()],
                ['Allergies', (string) \App\Models\Allergy::where('camper_id', $camper->id)->count()],
                ['Activity permissions', (string) \App\Models\ActivityPermission::where('camper_id', $camper->id)->count()],
                ['Consents', (string) \App\Models\ApplicationConsent::where('application_id', $app->id)->count()],
                ['Behavioral profile', BehavioralProfile::where('camper_id', $camper->id)->exists() ? 'created' : 'missing'],
                ['Personal care plan', PersonalCarePlan::where('camper_id', $camper->id)->exists() ? 'created' : 'missing'],
            ]
        );
        $this->command->newLine();
        $this->command->warn('Status is DRAFT. submitted_at is NULL. Application was NOT submitted.');
    }
}
