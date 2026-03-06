<?php

namespace Database\Seeders;

use App\Models\Camper;
use App\Models\EmergencyContact;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder — applicant families and campers.
 *
 * Creates six applicant families with their campers and emergency contacts.
 * The sixth family (Grace Wilson / Tyler) has no applications — used to test
 * the "registered but not yet applied" state in admin views.
 *
 * Family → Campers:
 *   1. Sarah Johnson       → Ethan, Lily
 *   2. David Martinez      → Sofia
 *   3. Jennifer Thompson   → Noah
 *   4. Michael Williams    → Ava, Lucas
 *   5. Patricia Davis      → Mia
 *   6. Grace Wilson        → Tyler  ← no applications
 */
class ApplicantSeeder extends Seeder
{
    public function run(): void
    {
        $parentRole = Role::where('name', 'applicant')->firstOrFail();

        $families = [
            [
                'name'    => 'Sarah Johnson',
                'email'   => 'sarah.johnson@example.com',
                'contact' => ['name' => 'Robert Johnson', 'rel' => 'Father', 'phone' => '803-555-0121', 'email' => 'robert.johnson@example.com'],
                'campers' => [
                    ['first_name' => 'Ethan', 'last_name' => 'Johnson',  'dob' => '2013-04-12', 'gender' => 'male',   'tshirt_size' => 'YL'],
                    ['first_name' => 'Lily',  'last_name' => 'Johnson',  'dob' => '2015-09-03', 'gender' => 'female', 'tshirt_size' => 'YM'],
                ],
            ],
            [
                'name'    => 'David Martinez',
                'email'   => 'david.martinez@example.com',
                'contact' => ['name' => 'Carlos Martinez', 'rel' => 'Grandfather', 'phone' => '803-555-0134', 'email' => 'carlos.m@example.com'],
                'campers' => [
                    ['first_name' => 'Sofia', 'last_name' => 'Martinez', 'dob' => '2014-06-28', 'gender' => 'female', 'tshirt_size' => 'YM'],
                ],
            ],
            [
                'name'    => 'Jennifer Thompson',
                'email'   => 'jennifer.thompson@example.com',
                'contact' => ['name' => 'Linda Thompson', 'rel' => 'Grandmother', 'phone' => '803-555-0145', 'email' => 'linda.t@example.com'],
                'campers' => [
                    ['first_name' => 'Noah', 'last_name' => 'Thompson', 'dob' => '2012-11-17', 'gender' => 'male', 'tshirt_size' => 'YL'],
                ],
            ],
            [
                'name'    => 'Michael Williams',
                'email'   => 'michael.williams@example.com',
                'contact' => ['name' => 'Angela Williams', 'rel' => 'Mother', 'phone' => '803-555-0156', 'email' => 'angela.w@example.com'],
                'campers' => [
                    ['first_name' => 'Ava',   'last_name' => 'Williams', 'dob' => '2016-02-09', 'gender' => 'female', 'tshirt_size' => 'YS'],
                    ['first_name' => 'Lucas', 'last_name' => 'Williams', 'dob' => '2011-08-22', 'gender' => 'male',   'tshirt_size' => 'AM'],
                ],
            ],
            [
                'name'    => 'Patricia Davis',
                'email'   => 'patricia.davis@example.com',
                'contact' => ['name' => 'Thomas Davis', 'rel' => 'Father', 'phone' => '803-555-0167', 'email' => 'thomas.d@example.com'],
                'campers' => [
                    ['first_name' => 'Mia', 'last_name' => 'Davis', 'dob' => '2015-05-14', 'gender' => 'female', 'tshirt_size' => 'YM'],
                ],
            ],
            // Family 6 — no applications (tests "registered, not applied" state)
            [
                'name'    => 'Grace Wilson',
                'email'   => 'grace.wilson@example.com',
                'contact' => ['name' => 'Daniel Wilson', 'rel' => 'Father', 'phone' => '803-555-0178', 'email' => 'daniel.w@example.com'],
                'campers' => [
                    ['first_name' => 'Tyler', 'last_name' => 'Wilson', 'dob' => '2014-03-07', 'gender' => 'male', 'tshirt_size' => 'YM'],
                ],
            ],
        ];

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

            foreach ($family['campers'] as $c) {
                $camper = Camper::firstOrCreate(
                    ['user_id' => $user->id, 'first_name' => $c['first_name'], 'last_name' => $c['last_name']],
                    ['date_of_birth' => $c['dob'], 'gender' => $c['gender'], 'tshirt_size' => $c['tshirt_size']]
                );

                if (! EmergencyContact::where('camper_id', $camper->id)->exists()) {
                    EmergencyContact::create([
                        'camper_id'            => $camper->id,
                        'name'                 => $family['contact']['name'],
                        'relationship'         => $family['contact']['rel'],
                        'phone_primary'        => $family['contact']['phone'],
                        'phone_secondary'      => null,
                        'email'                => $family['contact']['email'],
                        'is_primary'           => true,
                        'is_authorized_pickup' => true,
                    ]);
                }
            }
        }

        $this->command->line('  Applicant families seeded (6 families, 7 campers).');
    }
}
