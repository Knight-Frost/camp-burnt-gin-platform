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
 * UserProfileController — Everything a user can manage about their own account.
 *
 * This controller is scoped entirely to the authenticated user — no user can
 * touch another user's profile data through these endpoints.
 *
 * Responsibilities:
 *   - Read and update personal information (name, phone, address, email).
 *   - Upload and remove a profile avatar image.
 *   - Manage personal emergency contacts (separate from camper emergency contacts).
 *   - Read and update notification preferences (email/in-app toggles).
 *   - Change the account password (requires current password verification).
 *   - Provide pre-fill data so returning applicants don't re-enter common fields.
 *   - Request a personal data export (GDPR-style).
 *   - Request account deletion (applicant accounts only).
 */
class UserProfileController extends Controller
{
    // -------------------------------------------------------------------------
    // Profile — read / update
    // -------------------------------------------------------------------------

    /**
     * Get the current user's profile, including avatar URL.
     *
     * GET /api/profile
     *
     * Appends a public avatar_url derived from the stored avatar_path,
     * or null if no avatar has been uploaded yet.
     */
    public function show(Request $request): JsonResponse
    {
        // Load the role and personal emergency contacts in one query to avoid N+1.
        $user = $request->user()->load('role', 'userEmergencyContacts');

        $data = $user->toArray();
        // Build the public URL for the avatar image, or null if the user has none.
        $data['avatar_url'] = $user->avatar_path
            ? Storage::disk('public')->url($user->avatar_path)
            : null;

        return response()->json(['data' => $data]);
    }

    /**
     * Update the current user's profile fields.
     *
     * PUT/PATCH /api/profile
     *
     * All fields are optional (sometimes) so callers can send a partial update.
     * The email uniqueness rule excludes the current user so they can re-submit
     * their own email without triggering a duplicate error.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'name'           => ['sometimes', 'string', 'max:255'],
            'preferred_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            // Exclude the current user's own ID from the unique check to allow no-op email updates.
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
        // Only update the whitelisted fields — never trust raw $request->all().
        $user->update($request->only([
            'name', 'preferred_name', 'email', 'phone',
            'address_line_1', 'address_line_2', 'city',
            'state', 'postal_code', 'country',
        ]));

        // fresh() re-fetches the model so the response reflects the saved values.
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
     *
     * POST /api/profile/avatar
     *
     * Accepts JPEG, JPG, PNG, or WebP images up to 8 MB.
     * The old avatar file is deleted from disk before storing the new one
     * so orphaned files don't accumulate.
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        // Enforce image type and size before touching the filesystem.
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:8192'],
        ]);

        $user = $request->user();

        // Remove old avatar if present
        // Clean up the old file to avoid leaving orphaned images on the storage disk.
        if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        // Store in a per-user subdirectory so avatar files are organized and isolated.
        $path = $request->file('avatar')->store("avatars/{$user->id}", 'public');

        $user->update(['avatar_path' => $path]);

        return response()->json([
            'message'    => 'Avatar uploaded successfully.',
            'avatar_url' => Storage::disk('public')->url($path),
        ]);
    }

    /**
     * Remove the user's profile avatar.
     *
     * DELETE /api/profile/avatar
     *
     * Deletes the file from disk and sets avatar_path to null in the database.
     * Safe to call even if the user currently has no avatar.
     */
    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        // Only attempt deletion if an avatar is actually stored — no-op otherwise.
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
     *
     * GET /api/profile/emergency-contacts
     *
     * These are the user's own emergency contacts (not the camper-level ones
     * stored on the camper record). They represent who to call if the parent
     * themselves has an emergency while at camp drop-off/pickup.
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
     *
     * POST /api/profile/emergency-contacts
     *
     * If the new contact is flagged as primary, all other contacts for this
     * user are demoted first to maintain a single-primary invariant.
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
        // Only one contact may be marked primary — clear the flag on all existing contacts first.
        if (! empty($validated['is_primary'])) {
            $user->userEmergencyContacts()->update(['is_primary' => false]);
        }

        // Create the new contact record linked to the authenticated user.
        $contact = $user->userEmergencyContacts()->create($validated);

        return response()->json([
            'message' => 'Emergency contact added.',
            'data'    => $contact,
        ], 201);
    }

    /**
     * Update a personal emergency contact.
     *
     * PUT/PATCH /api/profile/emergency-contacts/{contact}
     *
     * The UserEmergencyContactPolicy ensures users can only update their own contacts.
     * If is_primary is being set, other contacts are demoted first.
     */
    public function updateEmergencyContact(Request $request, UserEmergencyContact $contact): JsonResponse
    {
        // The policy checks that this contact belongs to the authenticated user.
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
            // Use != contact->id so the contact being updated is not accidentally cleared.
            $request->user()->userEmergencyContacts()
                ->where('id', '!=', $contact->id)
                ->update(['is_primary' => false]);
        }

        $contact->update($validated);

        return response()->json([
            'message' => 'Emergency contact updated.',
            // fresh() ensures the response contains post-save values, not the pre-update state.
            'data'    => $contact->fresh(),
        ]);
    }

    /**
     * Delete a personal emergency contact.
     *
     * DELETE /api/profile/emergency-contacts/{contact}
     *
     * The policy confirms the contact belongs to the authenticated user before deletion.
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
     *
     * GET /api/profile/notification-preferences
     *
     * Returns the stored preferences merged with defaults so every key is
     * always present, even for users who have never changed their settings.
     */
    public function getNotificationPreferences(Request $request): JsonResponse
    {
        // Defaults ensure new users have all notifications on until they choose otherwise.
        $defaults = [
            'application_updates' => true,
            'announcements'       => true,
            'messages'            => true,
            'deadlines'           => true,
        ];

        // Merge stored prefs over defaults — stored values take priority.
        $prefs = array_merge($defaults, $request->user()->notification_preferences ?? []);

        return response()->json(['data' => $prefs]);
    }

    /**
     * Update the current user's notification preferences.
     *
     * PUT/PATCH /api/profile/notification-preferences
     *
     * Only the supplied preference keys are changed; unmentioned keys keep
     * their current stored value. The full merged result is returned.
     */
    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        // All preference keys are optional — a partial update only touches what was sent.
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

        // Fetch what the user currently has saved (may be null for brand-new accounts).
        $current = $request->user()->notification_preferences ?? [];
        // Merge the new values on top of the existing ones so no keys are lost.
        $merged  = array_merge($current, $validated);

        $request->user()->update(['notification_preferences' => $merged]);

        return response()->json([
            'message' => 'Notification preferences updated.',
            // Return defaults merged with merged so the response is always complete.
            'data'    => array_merge($defaults, $merged),
        ]);
    }

    // -------------------------------------------------------------------------
    // Password
    // -------------------------------------------------------------------------

    /**
     * Change the current user's password.
     *
     * POST /api/profile/change-password
     *
     * Requires the user to know their current password before they can set a
     * new one — this prevents someone who grabbed an unlocked device from
     * silently changing the password. On success, a security notification is sent.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password'      => ['required', 'string'],
            // Use the same strong policy as the password reset flow: 12+ chars,
            // mixed case, numbers, symbols, and not found in known data breaches.
            'password'              => [
                'required',
                'confirmed',
                Password::min(12)
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(),
            ],
            'password_confirmation' => ['required', 'string'],
        ]);

        $user = $request->user();

        // Hash::check() safely compares the plain-text input with the stored bcrypt hash.
        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'The current password is incorrect.',
                'errors'  => ['current_password' => ['The current password is incorrect.']],
            ], 422);
        }

        // Hash::make() generates a new bcrypt hash — never store plain-text passwords.
        $user->update(['password' => Hash::make($request->password)]);

        // Alert the user via their in-app inbox that their password was changed.
        app(SystemNotificationService::class)->passwordChanged($user);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    // -------------------------------------------------------------------------
    // Pre-fill
    // -------------------------------------------------------------------------

    /**
     * Get pre-fill data for returning applicants.
     *
     * GET /api/profile/prefill
     *
     * Returns commonly re-used data so the application form can auto-populate
     * fields the parent has entered before, reducing data entry friction for
     * families applying for multiple sessions or subsequent years.
     *
     * Data returned: parent name/email, list of existing campers (basic info),
     * emergency contacts from the most recent camper, and physician/insurance
     * details from the most recent camper's medical record.
     */
    public function prefillData(Request $request): JsonResponse
    {
        $user = $request->user();

        // Fetch the most recently created camper to use as the default for pre-fill.
        $latestCamper = $user->campers()
            ->with(['emergencyContacts', 'medicalRecord'])
            ->latest()
            ->first();

        $prefillData = [
            'parent' => [
                'name'  => $user->name,
                'email' => $user->email,
            ],
            // Give a lightweight list of all campers so the form can offer a "copy from camper" picker.
            'campers' => $user->campers->map(fn ($camper) => [
                'id'            => $camper->id,
                'first_name'    => $camper->first_name,
                'last_name'     => $camper->last_name,
                'date_of_birth' => $camper->date_of_birth->format('Y-m-d'),
                'gender'        => $camper->gender,
            ]),
            // Pull emergency contacts from the latest camper — safest source for recurring families.
            'emergency_contacts' => $latestCamper?->emergencyContacts->map(fn ($c) => [
                'name'                 => $c->name,
                'relationship'         => $c->relationship,
                'phone_primary'        => $c->phone_primary,
                'phone_secondary'      => $c->phone_secondary,
                'email'                => $c->email,
                'is_primary'           => $c->is_primary,
                'is_authorized_pickup' => $c->is_authorized_pickup,
            ]) ?? [],
            // Physician and insurance fields are often reused from year to year.
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
     * POST /api/profile/request-data-export
     *
     * Acknowledges the request and records it; actual export delivery
     * is handled asynchronously by the operations team.
     *
     * This satisfies GDPR/privacy "right to access" obligations — a user may
     * request a copy of all data the system holds about them.
     */
    public function requestDataExport(Request $request): JsonResponse
    {
        // Log the export request for audit purposes
        // Write a structured log entry so the ops team can track and fulfill the request.
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
     * POST /api/profile/delete-account
     *
     * Requires password confirmation. Marks the account as inactive
     * and schedules it for deletion by an administrator.
     *
     * Only applicant (parent) accounts can self-request deletion — admin
     * accounts must be managed by a super_admin to prevent accidental
     * removal of critical operational accounts.
     *
     * The account is deactivated immediately and all tokens are revoked so
     * the user is logged out everywhere right away.
     */
    public function deleteAccount(Request $request): JsonResponse
    {
        // Require the password to confirm the user actually wants to delete their account.
        $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        // Admin and medical accounts cannot self-delete — they require super_admin action.
        if (! $user->isApplicant()) {
            return response()->json([
                'message' => 'Account deletion is not available for administrative accounts.',
            ], 403);
        }

        // Hash::check() verifies the supplied password matches the stored hash.
        if (! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'The password you entered is incorrect.',
                'errors'  => ['password' => ['Password is incorrect.']],
            ], 422);
        }

        // Deactivate the account and revoke all tokens
        // Setting is_active = false prevents login immediately, before an admin finalizes deletion.
        $user->update(['is_active' => false]);
        // Revoke all Sanctum tokens so the user is signed out on every device instantly.
        $user->tokens()->delete();

        // Write a structured audit log entry for GDPR and operational records.
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
