<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Models\UserEmergencyContact;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder — extended user variety for RBAC, state, and profile testing.
 *
 * Adds users beyond the basic UserSeeder set to cover:
 *
 *   Staff / Admin variants:
 *     medical2@campburntgin.org    — Second medical staff (Nurse Jamie Santos)
 *     admin3@campburntgin.org      — Camp coordinator (Taylor Brooks)
 *     inactive@example.com         — Deactivated admin (is_active = false) — tests
 *                                    "inactive user" admin UI state and login rejection
 *     mfa.admin@campburntgin.org   — Admin with MFA enabled — tests MFA UI/TOTP flow
 *
 *   Applicant variants:
 *     james.carter@example.com     — New family (Henry Carter) — used for paper application
 *     locked.applicant@example.com — Applicant with lockout active — tests lockout UI
 *
 *   User profile data:
 *     Existing applicant accounts get address/phone data to exercise profile fields
 *     that were left NULL by the base ApplicantSeeder.
 *
 *   UserEmergencyContacts:
 *     Seeds account-level emergency contacts for key applicant users (distinct from
 *     per-camper EmergencyContact records, which are separately seeded in ApplicantSeeder).
 *
 * Safe to re-run — firstOrCreate guards prevent duplicate creation.
 */
class ExtendedUserSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole   = Role::where('name', 'admin')->firstOrFail();
        $medicalRole = Role::where('name', 'medical')->firstOrFail();
        $parentRole  = Role::where('name', 'applicant')->firstOrFail();

        // ── Additional medical staff ──────────────────────────────────────────

        User::firstOrCreate(
            ['email' => 'medical2@campburntgin.org'],
            [
                'name'              => 'Nurse Jamie Santos',
                'preferred_name'    => 'Jamie',
                'role_id'           => $medicalRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
                'phone'             => '803-555-0310',
                'is_active'         => true,
                'notification_preferences' => [
                    'email_notifications'   => true,
                    'application_updates'   => true,
                    'new_messages'          => true,
                    'medical_alerts'        => true,
                ],
            ]
        );

        // ── Additional admin staff ────────────────────────────────────────────

        User::firstOrCreate(
            ['email' => 'admin3@campburntgin.org'],
            [
                'name'              => 'Taylor Brooks',
                'preferred_name'    => 'Taylor',
                'role_id'           => $adminRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
                'phone'             => '803-555-0320',
                'address_line_1'    => '42 Pinewood Drive',
                'city'              => 'Orangeburg',
                'state'             => 'SC',
                'postal_code'       => '29115',
                'country'           => 'US',
                'is_active'         => true,
                'notification_preferences' => [
                    'email_notifications'   => true,
                    'application_updates'   => true,
                    'new_messages'          => true,
                    'medical_alerts'        => false,
                ],
            ]
        );

        // ── Deactivated admin — tests is_active=false login rejection ─────────

        User::firstOrCreate(
            ['email' => 'inactive@example.com'],
            [
                'name'              => 'Chris Dale',
                'role_id'           => $adminRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now()->subMonths(6),
                'is_active'         => false,  // CRITICAL: must be denied login
                'notification_preferences' => [
                    'email_notifications' => false,
                    'application_updates' => false,
                    'new_messages'        => false,
                ],
            ]
        );

        // ── MFA-enabled admin — tests TOTP enforcement UI ─────────────────────

        User::firstOrCreate(
            ['email' => 'mfa.admin@campburntgin.org'],
            [
                'name'              => 'Morgan Ellis',
                'role_id'           => $adminRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active'         => true,
                // mfa_enabled=true but no real mfa_secret — this simulates an account
                // that has MFA configured in the system. The secret value here is a
                // placeholder; real TOTP verification would fail, which is intentional
                // for dev testing of the MFA enforcement gate UI.
                'mfa_enabled'       => true,
                'mfa_secret'        => 'JBSWY3DPEHPK3PXP',  // Base32 placeholder
                'mfa_verified_at'   => now()->subDays(7),
                'notification_preferences' => [
                    'email_notifications' => true,
                    'application_updates' => true,
                    'new_messages'        => true,
                ],
            ]
        );

        // ── Locked-out applicant — tests lockout UI and login rejection ───────

        $lockedUser = User::firstOrCreate(
            ['email' => 'locked.applicant@example.com'],
            [
                'name'              => 'Chris Locke',
                'role_id'           => $parentRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now()->subWeek(),
                'is_active'         => true,
                'failed_login_attempts' => 5,
                'last_failed_login_at'  => now()->subMinutes(2),
                'lockout_until'         => now()->addMinutes(3),  // locked for 3 more minutes
            ]
        );

        // ── New applicant family — James Carter (paper application family) ────

        $carterFamily = User::firstOrCreate(
            ['email' => 'james.carter@example.com'],
            [
                'name'              => 'James Carter',
                'role_id'           => $parentRole->id,
                'password'          => Hash::make('password'),
                'email_verified_at' => now()->subDays(3),
                'phone'             => '803-555-0390',
                'address_line_1'    => '1892 Oak Street',
                'city'              => 'Columbia',
                'state'             => 'SC',
                'postal_code'       => '29201',
                'country'           => 'US',
                'is_active'         => true,
                'notification_preferences' => [
                    'email_notifications' => true,
                    'application_updates' => true,
                    'new_messages'        => true,
                ],
            ]
        );

        // ── Backfill address data on existing applicants ──────────────────────
        // Base ApplicantSeeder left phone/address blank. Fill in here.

        $addressData = [
            'sarah.johnson@example.com' => [
                'phone'          => '803-555-0100',
                'address_line_1' => '245 Magnolia Lane',
                'city'           => 'Columbia',
                'state'          => 'SC',
                'postal_code'    => '29205',
                'country'        => 'US',
            ],
            'david.martinez@example.com' => [
                'phone'          => '803-555-0112',
                'address_line_1' => '78 Riverside Boulevard',
                'city'           => 'Charleston',
                'state'          => 'SC',
                'postal_code'    => '29401',
                'country'        => 'US',
            ],
            'jennifer.thompson@example.com' => [
                'phone'          => '803-555-0124',
                'address_line_1' => '310 Cedar Hill Drive',
                'city'           => 'Greenville',
                'state'          => 'SC',
                'postal_code'    => '29601',
                'country'        => 'US',
            ],
            'michael.williams@example.com' => [
                'phone'          => '803-555-0136',
                'address_line_1' => '55 Sunset Court',
                'address_line_2' => 'Apt 2B',
                'city'           => 'Spartanburg',
                'state'          => 'SC',
                'postal_code'    => '29301',
                'country'        => 'US',
            ],
            'patricia.davis@example.com' => [
                'phone'          => '803-555-0148',
                'address_line_1' => '920 Peach Tree Road',
                'city'           => 'Orangeburg',
                'state'          => 'SC',
                'postal_code'    => '29115',
                'country'        => 'US',
            ],
            'grace.wilson@example.com' => [
                'phone'          => '803-555-0160',
                'address_line_1' => '1440 Pine Crest Way',
                'city'           => 'Sumter',
                'state'          => 'SC',
                'postal_code'    => '29150',
                'country'        => 'US',
            ],
        ];

        foreach ($addressData as $email => $fields) {
            $user = User::where('email', $email)->first();
            if ($user && ! $user->phone) {
                $user->update($fields);
            }
        }

        // ── User-level emergency contacts for key applicants ──────────────────

        $this->seedUserEmergencyContacts($carterFamily);
        $this->seedUserEmergencyContactsForExistingUsers();

        $this->command->line('  Extended users seeded (inactive, locked, MFA, additional staff, address data).');
    }

    private function seedUserEmergencyContacts(User $carterFamily): void
    {
        if (UserEmergencyContact::where('user_id', $carterFamily->id)->exists()) {
            return;
        }
        UserEmergencyContact::create([
            'user_id'      => $carterFamily->id,
            'name'         => 'Diane Carter',
            'relationship' => 'Spouse',
            'phone'        => '803-555-0391',
            'email'        => 'diane.carter@example.com',
            'is_primary'   => true,
        ]);
    }

    private function seedUserEmergencyContactsForExistingUsers(): void
    {
        $contacts = [
            'sarah.johnson@example.com' => [
                ['name' => 'Robert Johnson', 'rel' => 'Spouse', 'phone' => '803-555-0121', 'email' => 'robert.johnson@example.com', 'primary' => true],
                ['name' => 'Ellen Johnson',  'rel' => 'Mother',  'phone' => '803-555-0122', 'email' => null,                        'primary' => false],
            ],
            'david.martinez@example.com' => [
                ['name' => 'Rosa Martinez',  'rel' => 'Spouse', 'phone' => '803-555-0135', 'email' => 'rosa.m@example.com', 'primary' => true],
            ],
            'jennifer.thompson@example.com' => [
                ['name' => 'Mark Thompson',  'rel' => 'Spouse', 'phone' => '803-555-0146', 'email' => 'mark.t@example.com', 'primary' => true],
            ],
        ];

        foreach ($contacts as $email => $userContacts) {
            $user = User::where('email', $email)->first();
            if (! $user || UserEmergencyContact::where('user_id', $user->id)->exists()) {
                continue;
            }
            foreach ($userContacts as $c) {
                UserEmergencyContact::create([
                    'user_id'      => $user->id,
                    'name'         => $c['name'],
                    'relationship' => $c['rel'],
                    'phone'        => $c['phone'],
                    'email'        => $c['email'],
                    'is_primary'   => $c['primary'],
                ]);
            }
        }
    }
}
