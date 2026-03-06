<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder — applications across all status variants.
 *
 * Covers every application status and common multi-application scenarios:
 *
 *   Ethan Johnson    → approved  (Session 1 2026)
 *   Lily Johnson     → pending   (Session 1 2026)
 *   Sofia Martinez   → under_review (Session 1 2026)
 *   Noah Thompson    → rejected  (Session 1 2026) + pending (Session 2 2026)
 *   Ava Williams     → approved  (Session 2 2026)
 *   Lucas Williams   → pending   (Session 1 2026) + cancelled (Session 2 2026)
 *   Mia Davis        → approved  (Session 1 2025 — past session)
 *   Tyler Wilson     → (none)    — tests "registered, not applied" admin view
 *
 * Note: There is no "draft" case in ApplicationStatus. The "cancelled" entry
 * for Lucas represents an application started then abandoned — the closest
 * equivalent for UI testing of a non-active terminal state.
 */
class ApplicationSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();

        $session1Past     = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();
        $session1Upcoming = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2Upcoming = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $lily  = Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $noah  = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $ava   = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $mia   = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();

        // Ethan Johnson — approved, Session 1 2026 — fully completed form with signature
        Application::firstOrCreate(
            ['camper_id' => $ethan->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'          => ApplicationStatus::Approved,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(20),
                'reviewed_at'     => now()->subDays(10),
                'reviewed_by'     => $admin->id,
                'notes'           => 'Ethan has attended Camp Burnt Gin twice before. Medical team familiar with his care needs. Approved.',
                'signature_name'  => 'Sarah Johnson',
                'signed_at'       => now()->subDays(20),
                'signed_ip_address' => '192.168.1.100',
            ]
        );

        // Lily Johnson — pending, Session 1 2026 — submitted with signature
        Application::firstOrCreate(
            ['camper_id' => $lily->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'          => ApplicationStatus::Pending,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(5),
                'reviewed_at'     => null,
                'reviewed_by'     => null,
                'notes'           => null,
                'signature_name'  => 'Sarah Johnson',
                'signed_at'       => now()->subDays(5),
                'signed_ip_address' => '192.168.1.100',
            ]
        );

        // Sofia Martinez — under review, Session 1 2026 — fully completed form with signature
        Application::firstOrCreate(
            ['camper_id' => $sofia->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'          => ApplicationStatus::UnderReview,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(14),
                'reviewed_at'     => null,
                'reviewed_by'     => null,
                'notes'           => 'Awaiting updated immunization records and physician clearance letter.',
                'signature_name'  => 'David Martinez',
                'signed_at'       => now()->subDays(14),
                'signed_ip_address' => '10.0.0.45',
            ]
        );

        // Noah Thompson — rejected, Session 1 2026 (session at capacity)
        Application::firstOrCreate(
            ['camper_id' => $noah->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'          => ApplicationStatus::Rejected,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(30),
                'reviewed_at'     => now()->subDays(22),
                'reviewed_by'     => $admin->id,
                'notes'           => 'Session 1 is at capacity. Applicant has been notified and encouraged to apply for Session 2.',
                'signature_name'  => 'Jennifer Thompson',
                'signed_at'       => now()->subDays(30),
                'signed_ip_address' => '10.0.1.22',
            ]
        );

        // Noah Thompson — pending, Session 2 2026 (reapplication after rejection)
        Application::firstOrCreate(
            ['camper_id' => $noah->id, 'camp_session_id' => $session2Upcoming->id],
            [
                'status'          => ApplicationStatus::Pending,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(2),
                'reviewed_at'     => null,
                'reviewed_by'     => null,
                'notes'           => null,
                'signature_name'  => 'Jennifer Thompson',
                'signed_at'       => now()->subDays(2),
                'signed_ip_address' => '10.0.1.22',
            ]
        );

        // Ava Williams — approved, Session 2 2026 — fully completed form with signature
        Application::firstOrCreate(
            ['camper_id' => $ava->id, 'camp_session_id' => $session2Upcoming->id],
            [
                'status'          => ApplicationStatus::Approved,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(18),
                'reviewed_at'     => now()->subDays(8),
                'reviewed_by'     => $admin->id,
                'notes'           => 'All documents received and verified. Approved.',
                'signature_name'  => 'Michael Williams',
                'signed_at'       => now()->subDays(18),
                'signed_ip_address' => '172.16.0.5',
            ]
        );

        // Lucas Williams — pending, Session 1 2026
        Application::firstOrCreate(
            ['camper_id' => $lucas->id, 'camp_session_id' => $session1Upcoming->id],
            [
                'status'          => ApplicationStatus::Pending,
                'is_draft'        => false,
                'submitted_at'    => now()->subDays(3),
                'reviewed_at'     => null,
                'reviewed_by'     => null,
                'notes'           => null,
                'signature_name'  => 'Michael Williams',
                'signed_at'       => now()->subDays(3),
                'signed_ip_address' => '172.16.0.5',
            ]
        );

        // Lucas Williams — cancelled, Session 2 2026 (draft/abandoned)
        Application::firstOrCreate(
            ['camper_id' => $lucas->id, 'camp_session_id' => $session2Upcoming->id],
            [
                'status'          => ApplicationStatus::Cancelled,
                'is_draft'        => true,
                'submitted_at'    => null,
                'reviewed_at'     => null,
                'reviewed_by'     => null,
                'notes'           => 'Parent cancelled application — decided to apply only for Session 1.',
                'signature_name'  => null,
                'signed_at'       => null,
            ]
        );

        // Mia Davis — approved, past session (Summer 2025) — fully completed form
        Application::firstOrCreate(
            ['camper_id' => $mia->id, 'camp_session_id' => $session1Past->id],
            [
                'status'          => ApplicationStatus::Approved,
                'is_draft'        => false,
                'submitted_at'    => '2025-04-10 10:00:00',
                'reviewed_at'     => '2025-04-20 14:00:00',
                'reviewed_by'     => $admin->id,
                'notes'           => 'Mia attended successfully. Eligible to re-apply.',
                'signature_name'  => 'Patricia Davis',
                'signed_at'       => '2025-04-10 10:00:00',
                'signed_ip_address' => '10.0.2.88',
            ]
        );

        // Tyler Wilson — no applications (intentional — tests admin "applied" filter)
    }
}
