<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\EmergencyContact;
use App\Models\MedicalRecord;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder — waitlisted, draft, paper-entered, and returning-applicant applications.
 *
 * Fills critical status and workflow gaps from the base ApplicationSeeder:
 *
 *   ApplicationStatus::Waitlisted — NEVER previously seeded
 *   Draft (is_draft=true, no submission) — pure in-progress draft scenario
 *   Paper-entered application — represents admin manual-entry workflow
 *   Returning applicant — camper with past approved session + new 2026 draft
 *
 * New scenarios:
 *   A. Tyler Wilson         → WAITLISTED   (Session 1 2026)
 *      Tyler was registered but not applied; this seeds his waitlisted application.
 *   B. Mia Davis            → IN-PROGRESS DRAFT (Session 1 2026)
 *      Mia attended 2025; her parent started the 2026 application and saved a draft.
 *      This models the returning-applicant in-progress state.
 *   C. Henry Carter (new)   → APPROVED, PAPER-ENTERED (Session 1 2026)
 *      Admin manually entered this application from a paper form submitted by
 *      the Carter family (who may not yet have a portal account).
 *   D. Henry Carter         → PENDING (Session 2 2026)
 *      Second application demonstrating multi-session scenario.
 *
 * Henry Carter family:
 *   Parent: James Carter (james.carter@example.com — seeded in ExtendedUserSeeder)
 *   Camper: Henry Carter, DOB 2016-03-22, Male, YL
 *   Diagnosis: Mild intellectual disability
 *   Emergency contact: Diane Carter (seeded here)
 *
 * Safe to re-run — duplicate detection on camper_id + camp_session_id.
 */
class WaitlistedApplicationSeeder extends Seeder
{
    public function run(): void
    {
        $admin  = User::where('email', 'admin@example.com')->firstOrFail();
        $parent = Role::where('name', 'applicant')->firstOrFail();

        $session1Past     = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();
        $session1Upcoming = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2Upcoming = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        $tyler = Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail();
        $mia   = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();

        // ── A. Tyler Wilson — Waitlisted (Session 1 2026) ──────────────────────

        Application::firstOrCreate(
            ['camper_id' => $tyler->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'            => ApplicationStatus::Waitlisted,
                'is_draft'          => false,
                'submitted_at'      => now()->subDays(25),
                'reviewed_at'       => now()->subDays(15),
                'reviewed_by'       => $admin->id,
                'notes'             => 'Session 1 is at capacity. Tyler has been placed on the waitlist and will be notified if a spot opens. Application is complete and meets all requirements.',
                'signature_name'    => 'Grace Wilson',
                'signed_at'         => now()->subDays(25),
                'signed_ip_address' => '10.0.3.77',
            ]
        );

        // ── B. Mia Davis — In-Progress Draft (Session 1 2026, returning applicant) ─

        Application::firstOrCreate(
            ['camper_id' => $mia->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'            => ApplicationStatus::Pending,   // status won't matter while is_draft=true
                'is_draft'          => true,                          // KEY: draft in progress
                'submitted_at'      => null,                          // not yet submitted
                'reviewed_at'       => null,
                'reviewed_by'       => null,
                'notes'             => null,
                'signature_name'    => null,
                'signed_at'         => null,
                'signed_ip_address' => null,
            ]
        );

        // ── C. Henry Carter — Create family and paper application ─────────────

        $jamesCarter = User::firstOrCreate(
            ['email' => 'james.carter@example.com'],
            [
                'name'              => 'James Carter',
                'role_id'           => $parent->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now()->subDays(3),
                'phone'             => '803-555-0390',
                'address_line_1'    => '1892 Oak Street',
                'city'              => 'Columbia',
                'state'             => 'SC',
                'postal_code'       => '29201',
                'country'           => 'US',
                'is_active'         => true,
            ]
        );

        $henry = Camper::firstOrCreate(
            ['user_id' => $jamesCarter->id, 'first_name' => 'Henry', 'last_name' => 'Carter'],
            [
                'date_of_birth' => '2016-03-22',
                'gender'        => 'male',
                'tshirt_size'   => 'YL',
            ]
        );

        // Emergency contact for Henry
        if (! EmergencyContact::where('camper_id', $henry->id)->exists()) {
            EmergencyContact::create([
                'camper_id'            => $henry->id,
                'name'                 => 'Diane Carter',
                'relationship'         => 'Mother',
                'phone_primary'        => '803-555-0391',
                'phone_secondary'      => '803-555-0392',  // second number — tests secondary phone UI
                'email'                => 'diane.carter@example.com',
                'is_primary'           => true,
                'is_authorized_pickup' => true,
            ]);
            // Non-primary, non-pickup secondary contact
            EmergencyContact::create([
                'camper_id'            => $henry->id,
                'name'                 => 'Raymond Carter',
                'relationship'         => 'Grandfather',
                'phone_primary'        => '803-555-0393',
                'phone_secondary'      => null,
                'email'                => null,
                'is_primary'           => false,
                'is_authorized_pickup' => false,
            ]);
        }

        // Minimal medical record for Henry
        if (! MedicalRecord::where('camper_id', $henry->id)->exists()) {
            MedicalRecord::create([
                'camper_id'               => $henry->id,
                'physician_name'          => 'Dr. Lisa Huang',
                'physician_phone'         => '803-555-0400',
                'insurance_provider'      => 'United Healthcare',
                'insurance_policy_number' => 'UHC-CART-2026-001',
                'special_needs'           => 'Mild intellectual disability. Requires simple, direct instructions. Responds well to visual cues and consistent routine.',
                'dietary_restrictions'    => null,
                'notes'                   => 'Henry is an enthusiastic, happy child. He does well with structured activities and 1-2 step instructions. No behavioral concerns. Cleared for all camp activities.',
            ]);
        }

        // Paper-entered application — approved (admin entered from physical form)
        Application::firstOrCreate(
            ['camper_id' => $henry->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'            => ApplicationStatus::Approved,
                'is_draft'          => false,
                'submitted_at'      => now()->subDays(12),
                'reviewed_at'       => now()->subDays(7),
                'reviewed_by'       => $admin->id,
                'notes'             => 'PAPER APPLICATION — Entered manually by admin from physical form received 2026-02-24. Original paper form scanned and uploaded. All documents verified. Family does not yet have portal account — will be contacted to set up login after approval.',
                'signature_name'    => 'James Carter',   // guardian who signed the paper form
                'signed_at'         => now()->subDays(14),
                'signed_ip_address' => null,              // null = paper signature, not digital
            ]
        );

        // ── D. Henry Carter — Pending (Session 2 2026) ───────────────────────

        Application::firstOrCreate(
            ['camper_id' => $henry->id, 'camp_session_id' => $session2Upcoming->id],
            [
                'status'            => ApplicationStatus::Pending,
                'is_draft'          => false,
                'submitted_at'      => now()->subDays(5),
                'reviewed_at'       => null,
                'reviewed_by'       => null,
                'notes'             => null,
                'signature_name'    => 'James Carter',
                'signed_at'         => now()->subDays(5),
                'signed_ip_address' => '192.168.10.45',
            ]
        );

        $this->command->line('  Waitlisted/draft/paper applications seeded (Tyler waitlisted, Mia draft, Henry Carter paper).');
    }
}
