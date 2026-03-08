<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Models\UserEmergencyContact;
use App\Services\SystemNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

/**
 * Controller for user profile management.
 *
 * Handles personal information, avatar upload, address fields,
 * emergency contacts, notification preferences, password changes,
 * and account data/deletion requests.
 */
class UserProfileController extends Controller
{
    // -------------------------------------------------------------------------
    // Profile — read / update
    // -------------------------------------------------------------------------

    /**
     * Get the current user's profile, including avatar URL.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('role', 'userEmergencyContacts');

        $data = $user->toArray();
        $data['avatar_url'] = $user->avatar_path
            ? Storage::disk('public')->url($user->avatar_path)
            : null;

        return response()->json(['data' => $data]);
    }

    /**
     * Update the current user's profile fields.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'name'           => ['sometimes', 'string', 'max:255'],
            'preferred_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'email'          => ['sometimes', 'email', 'unique:users,email,' . $request->user()->id],
            'phone'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'address_line_1' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address_line_2' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city'           => ['sometimes', 'nullable', 'string', 'max:100'],
            'state'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'postal_code'    => ['sometimes', 'nullable', 'string', 'max:20'],
            'country'        => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $user->update($request->only([
            'name', 'preferred_name', 'email', 'phone',
            'address_line_1', 'address_line_2', 'city',
            'state', 'postal_code', 'country',
        ]));

        $data = $user->fresh('userEmergencyContacts')->toArray();
        $data['avatar_url'] = $user->avatar_path
            ? Storage::disk('public')->url($user->avatar_path)
            : null;

        return response()->json([
            'message' => 'Profile updated successfully.',
            'data'    => $data,
        ]);
    }

    // -------------------------------------------------------------------------
    // Avatar
    // -------------------------------------------------------------------------

    /**
     * Upload or replace the user's profile avatar.
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:8192'],
        ]);

        $user = $request->user();

        // Remove old avatar if present
        if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $request->file('avatar')->store("avatars/{$user->id}", 'public');

        $user->update(['avatar_path' => $path]);

        return response()->json([
            'message'    => 'Avatar uploaded successfully.',
            'avatar_url' => Storage::disk('public')->url($path),
        ]);
    }

    /**
     * Remove the user's profile avatar.
     */
    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $user->update(['avatar_path' => null]);

        return response()->json(['message' => 'Avatar removed.']);
    }

    // -------------------------------------------------------------------------
    // Emergency contacts
    // -------------------------------------------------------------------------

    /**
     * List the authenticated user's personal emergency contacts.
     */
    public function listEmergencyContacts(Request $request): JsonResponse
    {
        $contacts = $request->user()
            ->userEmergencyContacts()
            ->get();

        return response()->json(['data' => $contacts]);
    }

    /**
     * Add a personal emergency contact to the user's account.
     */
    public function storeEmergencyContact(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'         => ['required', 'string', 'max:255'],
            'relationship' => ['required', 'string', 'max:100'],
            'phone'        => ['required', 'string', 'max:20'],
            'email'        => ['sometimes', 'nullable', 'email', 'max:255'],
            'is_primary'   => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();

        // If new contact is primary, demote all others
        if (! empty($validated['is_primary'])) {
            $user->userEmergencyContacts()->update(['is_primary' => false]);
        }

        $contact = $user->userEmergencyContacts()->create($validated);

        return response()->json([
            'message' => 'Emergency contact added.',
            'data'    => $contact,
        ], 201);
    }

    /**
     * Update a personal emergency contact.
     */
    public function updateEmergencyContact(Request $request, UserEmergencyContact $contact): JsonResponse
    {
        $this->authorize('update', $contact);

        $validated = $request->validate([
            'name'         => ['sometimes', 'string', 'max:255'],
            'relationship' => ['sometimes', 'string', 'max:100'],
            'phone'        => ['sometimes', 'string', 'max:20'],
            'email'        => ['sometimes', 'nullable', 'email', 'max:255'],
            'is_primary'   => ['sometimes', 'boolean'],
        ]);

        // If promoting this contact to primary, demote all others
        if (! empty($validated['is_primary'])) {
            $request->user()->userEmergencyContacts()
                ->where('id', '!=', $contact->id)
                ->update(['is_primary' => false]);
        }

        $contact->update($validated);

        return response()->json([
            'message' => 'Emergency contact updated.',
            'data'    => $contact->fresh(),
        ]);
    }

    /**
     * Delete a personal emergency contact.
     */
    public function destroyEmergencyContact(Request $request, UserEmergencyContact $contact): JsonResponse
    {
        $this->authorize('delete', $contact);

        $contact->delete();

        return response()->json(['message' => 'Emergency contact removed.']);
    }

    // -------------------------------------------------------------------------
    // Notification preferences
    // -------------------------------------------------------------------------

    /**
     * Get the current user's notification preferences.
     */
    public function getNotificationPreferences(Request $request): JsonResponse
    {
        $defaults = [
            'application_updates' => true,
            'announcements'       => true,
            'messages'            => true,
            'deadlines'           => true,
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

        $defaults = [
            'application_updates' => true,
            'announcements'       => true,
            'messages'            => true,
            'deadlines'           => true,
        ];

        $current = $request->user()->notification_preferences ?? [];
        $merged  = array_merge($current, $validated);

        $request->user()->update(['notification_preferences' => $merged]);

        return response()->json([
            'message' => 'Notification preferences updated.',
            'data'    => array_merge($defaults, $merged),
        ]);
    }

    // -------------------------------------------------------------------------
    // Password
    // -------------------------------------------------------------------------

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

        app(SystemNotificationService::class)->passwordChanged($user);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    // -------------------------------------------------------------------------
    // Pre-fill
    // -------------------------------------------------------------------------

    /**
     * Get pre-fill data for returning applicants.
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
                'name'  => $user->name,
                'email' => $user->email,
            ],
            'campers' => $user->campers->map(fn ($camper) => [
                'id'            => $camper->id,
                'first_name'    => $camper->first_name,
                'last_name'     => $camper->last_name,
                'date_of_birth' => $camper->date_of_birth->format('Y-m-d'),
                'gender'        => $camper->gender,
            ]),
            'emergency_contacts' => $latestCamper?->emergencyContacts->map(fn ($c) => [
                'name'                 => $c->name,
                'relationship'         => $c->relationship,
                'phone_primary'        => $c->phone_primary,
                'phone_secondary'      => $c->phone_secondary,
                'email'                => $c->email,
                'is_primary'           => $c->is_primary,
                'is_authorized_pickup' => $c->is_authorized_pickup,
            ]) ?? [],
            'medical' => $latestCamper?->medicalRecord ? [
                'physician_name'         => $latestCamper->medicalRecord->physician_name,
                'physician_phone'        => $latestCamper->medicalRecord->physician_phone,
                'insurance_provider'     => $latestCamper->medicalRecord->insurance_provider,
                'insurance_policy_number' => $latestCamper->medicalRecord->insurance_policy_number,
            ] : null,
        ];

        return response()->json(['data' => $prefillData]);
    }

    // -------------------------------------------------------------------------
    // Data & account controls
    // -------------------------------------------------------------------------

    /**
     * Queue a personal data export for the current user.
     *
     * Acknowledges the request and records it; actual export delivery
     * is handled asynchronously by the operations team.
     */
    public function requestDataExport(Request $request): JsonResponse
    {
        // Log the export request for audit purposes
        \Log::info('Data export requested', [
            'user_id' => $request->user()->id,
            'email'   => $request->user()->email,
            'ip'      => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Data export request received. You will receive an email with your data within 30 days.',
        ]);
    }

    /**
     * Request account deletion for the current user.
     *
     * Requires password confirmation. Marks the account as inactive
     * and schedules it for deletion by an administrator.
     */
    public function deleteAccount(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! $user->isApplicant()) {
            return response()->json([
                'message' => 'Account deletion is not available for administrative accounts.',
            ], 403);
        }

        if (! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'The password you entered is incorrect.',
                'errors'  => ['password' => ['Password is incorrect.']],
            ], 422);
        }

        // Deactivate the account and revoke all tokens
        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        \Log::info('Account deletion requested', [
            'user_id' => $user->id,
            'email'   => $user->email,
            'ip'      => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Your account has been deactivated and is scheduled for deletion. All sessions have been terminated.',
        ]);
    }
}
