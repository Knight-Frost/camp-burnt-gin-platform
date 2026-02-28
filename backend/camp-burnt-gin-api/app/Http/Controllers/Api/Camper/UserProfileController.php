<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

/**
 * Controller for user profile management.
 *
 * Provides profile data and pre-fill information for returning applicants.
 * Implements FR-7: Pre-fill recurring fields for returning applicants.
 */
class UserProfileController extends Controller
{
    /**
     * Get the current user's profile.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('role');

        return response()->json([
            'data' => $user,
        ]);
    }

    /**
     * Update the current user's profile.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$request->user()->id],
        ]);

        $request->user()->update($request->only(['name', 'email']));

        return response()->json([
            'message' => 'Profile updated successfully.',
            'data' => $request->user(),
        ]);
    }

    /**
     * Get the current user's notification preferences.
     *
     * Returns the stored preferences merged with defaults so the frontend
     * always receives all known keys.
     */
    public function getNotificationPreferences(Request $request): JsonResponse
    {
        $defaults = [
            'application_updates' => true,
            'announcements' => true,
            'messages' => true,
            'deadlines' => true,
        ];

        $prefs = array_merge($defaults, $request->user()->notification_preferences ?? []);

        return response()->json(['data' => $prefs]);
    }

    /**
     * Update the current user's notification preferences.
     */
    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_updates' => ['sometimes', 'boolean'],
            'announcements'       => ['sometimes', 'boolean'],
            'messages'            => ['sometimes', 'boolean'],
            'deadlines'           => ['sometimes', 'boolean'],
        ]);

        $current = $request->user()->notification_preferences ?? [];
        $merged = array_merge($current, $validated);

        $request->user()->update(['notification_preferences' => $merged]);

        return response()->json([
            'message' => 'Notification preferences updated.',
            'data' => $merged,
        ]);
    }

    /**
     * Change the current user's password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password'      => ['required', 'string'],
            'password'              => ['required', 'confirmed', Password::min(8)],
            'password_confirmation' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'The current password is incorrect.',
                'errors'  => ['current_password' => ['The current password is incorrect.']],
            ], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * Get pre-fill data for returning applicants.
     *
     * Returns commonly used data from previous applications to speed up
     * the application process for returning families.
     * Implements FR-7: Pre-fill recurring fields.
     */
    public function prefillData(Request $request): JsonResponse
    {
        $user = $request->user();

        $latestCamper = $user->campers()
            ->with(['emergencyContacts', 'medicalRecord'])
            ->latest()
            ->first();

        $prefillData = [
            'parent' => [
                'name' => $user->name,
                'email' => $user->email,
            ],
            'campers' => $user->campers->map(function ($camper) {
                return [
                    'id' => $camper->id,
                    'first_name' => $camper->first_name,
                    'last_name' => $camper->last_name,
                    'date_of_birth' => $camper->date_of_birth->format('Y-m-d'),
                    'gender' => $camper->gender,
                ];
            }),
            'emergency_contacts' => $latestCamper?->emergencyContacts->map(function ($contact) {
                return [
                    'name' => $contact->name,
                    'relationship' => $contact->relationship,
                    'phone_primary' => $contact->phone_primary,
                    'phone_secondary' => $contact->phone_secondary,
                    'email' => $contact->email,
                    'is_primary' => $contact->is_primary,
                    'is_authorized_pickup' => $contact->is_authorized_pickup,
                ];
            }) ?? [],
            'medical' => $latestCamper?->medicalRecord ? [
                'physician_name' => $latestCamper->medicalRecord->physician_name,
                'physician_phone' => $latestCamper->medicalRecord->physician_phone,
                'insurance_provider' => $latestCamper->medicalRecord->insurance_provider,
                'insurance_policy_number' => $latestCamper->medicalRecord->insurance_policy_number,
            ] : null,
        ];

        return response()->json([
            'data' => $prefillData,
        ]);
    }
}
