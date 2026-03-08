<?php

namespace Database\Seeders;

use App\Models\Camper;
use App\Models\MedicalProviderLink;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder — medical provider link workflow scenarios.
 *
 * Creates provider links in every meaningful lifecycle state so the
 * provider-link UI, admin views, and notification flows can all be tested
 * without any real email delivery.
 *
 * States seeded:
 *   1. Sofia  Martinez → Dr. James Owens  → ACTIVE,   not yet accessed   (sent 2 days ago)
 *   2. Tyler  Wilson   → Dr. Anne Bradley → ACTIVE,   accessed, not submitted (link opened 3h ago)
 *   3. Noah   Thompson → Dr. Rachel Kim   → SUBMITTED (provider completed form)
 *   4. Lucas  Williams → Dr. Maria Gonzalez → EXPIRED, never submitted (72h+ elapsed, no action)
 *   5. Mia    Davis    → Dr. Kevin Patel  → REVOKED   (admin revoked before provider accessed)
 *   6. Lily   Johnson  → Dr. Sandra Hill  → ACTIVE,   just sent today
 *   7. Ethan  Johnson  → Dr. Hill (regen) → SUBMITTED (regenerated after earlier expired link)
 *
 * For testing: the token field stores a bcrypt hash of the plain token.
 * Plain tokens are NOT stored anywhere — use the admin "resend" flow in the
 * UI to generate real links in local dev.
 *
 * Safe to re-run — duplicate detection is based on camper_id + provider_email + expires_at.
 */
class ProviderLinkSeeder extends Seeder
{
    public function run(): void
    {
        $admin   = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

        $campers = [
            'ethan' => Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail(),
            'lily'  => Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail(),
            'sofia' => Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail(),
            'noah'  => Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail(),
            'lucas' => Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail(),
            'mia'   => Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail(),
            'tyler' => Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail(),
        ];

        // 1. Sofia — active, not yet accessed (sent 2 days ago, expires tomorrow)
        $this->makeLink([
            'camper'         => $campers['sofia'],
            'created_by'     => $admin->id,
            'provider_email' => 'dr.owens@pediatrics.example.com',
            'provider_name'  => 'Dr. James Owens',
            'expires_at'     => now()->addHours(24),
            'accessed_at'    => null,
            'submitted_at'   => null,
            'revoked_at'     => null,
            'revoked_by'     => null,
            'is_used'        => false,
            'notes'          => 'Sent to Dr. Owens for Sofia\'s physician clearance and catheterization protocol documentation.',
        ]);

        // 2. Tyler — active, accessed but not submitted (provider opened the link 3h ago)
        $this->makeLink([
            'camper'         => $campers['tyler'],
            'created_by'     => $admin->id,
            'provider_email' => 'dr.bradley@familymed.example.com',
            'provider_name'  => 'Dr. Anne Bradley',
            'expires_at'     => now()->addHours(48),
            'accessed_at'    => now()->subHours(3),
            'submitted_at'   => null,
            'revoked_at'     => null,
            'revoked_by'     => null,
            'is_used'        => false,
            'notes'          => 'Link sent for Tyler\'s annual wellness physical documentation. Provider has accessed but not yet submitted.',
        ]);

        // 3. Noah — submitted (provider completed the form, link used)
        $this->makeLink([
            'camper'         => $campers['noah'],
            'created_by'     => $admin->id,
            'provider_email' => 'dr.kim@pediatric-cardiology.example.com',
            'provider_name'  => 'Dr. Rachel Kim',
            'expires_at'     => now()->subDays(1),  // was 72h, now past (submitted before expiry)
            'accessed_at'    => now()->subDays(3),
            'submitted_at'   => now()->subDays(2),
            'revoked_at'     => null,
            'revoked_by'     => null,
            'is_used'        => true,
            'notes'          => 'Dr. Kim completed the cardiac clearance form and uploaded Down syndrome care protocol. All medical information received.',
        ]);

        // 4. Lucas — expired, never submitted (provider did not respond in time)
        $this->makeLink([
            'camper'         => $campers['lucas'],
            'created_by'     => $admin->id,
            'provider_email' => 'dr.gonzalez@neuromuscular.example.com',
            'provider_name'  => 'Dr. Maria Gonzalez',
            'expires_at'     => now()->subDays(2),  // expired 2 days ago
            'accessed_at'    => null,               // never opened
            'submitted_at'   => null,
            'revoked_at'     => null,
            'revoked_by'     => null,
            'is_used'        => false,
            'notes'          => 'First link sent to Dr. Gonzalez. Provider did not respond. A new link will need to be generated.',
        ]);

        // 5. Mia — revoked by admin before provider accessed
        $this->makeLink([
            'camper'         => $campers['mia'],
            'created_by'     => $admin->id,
            'provider_email' => 'dr.patel@hematology.example.com',
            'provider_name'  => 'Dr. Kevin Patel',
            'expires_at'     => now()->addDays(1),  // would still be valid but revoked
            'accessed_at'    => null,
            'submitted_at'   => null,
            'revoked_at'     => now()->subDays(1),
            'revoked_by'     => $admin->id,
            'is_used'        => false,
            'notes'          => 'Link revoked — Dr. Patel\'s office requested a direct fax instead. Medical documentation received via fax on 2026-03-06.',
        ]);

        // 6. Lily — active, just sent today (freshest link)
        $this->makeLink([
            'camper'         => $campers['lily'],
            'created_by'     => $admin->id,
            'provider_email' => 'dr.hill@childrens-pulmonology.example.com',
            'provider_name'  => 'Dr. Sandra Hill',
            'expires_at'     => now()->addHours(72),
            'accessed_at'    => null,
            'submitted_at'   => null,
            'revoked_at'     => null,
            'revoked_by'     => null,
            'is_used'        => false,
            'notes'          => 'Requesting asthma action plan and updated spirometry results for summer 2026 application.',
        ]);

        // 7. Ethan — EXPIRED earlier link (historical, never submitted)
        $this->makeLink([
            'camper'         => $campers['ethan'],
            'created_by'     => $medical->id,
            'provider_email' => 'dr.hill@childrens-pulmonology.example.com',
            'provider_name'  => 'Dr. Sandra Hill',
            'expires_at'     => now()->subDays(5),  // expired 5 days ago
            'accessed_at'    => null,
            'submitted_at'   => null,
            'revoked_at'     => null,
            'revoked_by'     => null,
            'is_used'        => false,
            'notes'          => 'First link — expired before provider responded. Regenerated link was sent directly by phone call.',
        ]);

        $this->command->line('  Provider links seeded (7 links across all lifecycle states).');
    }

    private function makeLink(array $data): void
    {
        $camper = $data['camper'];

        // Duplicate check: same camper + provider email + expires_at is unique enough
        $exists = MedicalProviderLink::where('camper_id', $camper->id)
            ->where('provider_email', $data['provider_email'])
            ->where('expires_at', $data['expires_at'])
            ->exists();

        if ($exists) {
            return;
        }

        // Generate and hash a dummy token — the plain token is not stored anywhere
        $plainToken = MedicalProviderLink::generateToken();

        MedicalProviderLink::create([
            'camper_id'      => $camper->id,
            'created_by'     => $data['created_by'],
            'token'          => MedicalProviderLink::hashToken($plainToken),
            'provider_email' => $data['provider_email'],
            'provider_name'  => $data['provider_name'],
            'expires_at'     => $data['expires_at'],
            'accessed_at'    => $data['accessed_at'],
            'submitted_at'   => $data['submitted_at'],
            'revoked_at'     => $data['revoked_at'],
            'revoked_by'     => $data['revoked_by'],
            'is_used'        => $data['is_used'],
            'notes'          => $data['notes'],
        ]);
    }
}
