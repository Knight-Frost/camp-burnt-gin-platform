<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\SystemNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * UserController — Super-admin user management.
 *
 * Provides paginated user listing with search/role filtering,
 * role assignment, and account activation/deactivation.
 * All endpoints require the super_admin role.
 */
class UserController extends Controller
{
    /**
     * Return a paginated, filterable list of all users.
     *
     * GET /api/users
     *
     * Query parameters:
     *   - search: text match against name or email
     *   - role:   filter by role slug (e.g. "parent", "admin")
     *   - page:   pagination page
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role'   => ['nullable', 'string', 'max:50'],
        ]);

        $query = User::with('role')->orderBy('created_at', 'desc');

        if ($request->filled('search')) {
            $term = $request->string('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('email', 'like', "%{$term}%");
            });
        }

        if ($request->filled('role')) {
            $roleName = $request->string('role');
            $query->whereHas('role', fn($q) => $q->where('name', $roleName));
        }

        $users = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($users->items())->map(fn($u) => $this->formatUser($u))->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page'    => $users->lastPage(),
                'per_page'     => $users->perPage(),
                'total'        => $users->total(),
                'from'         => $users->firstItem(),
                'to'           => $users->lastItem(),
            ],
        ]);
    }

    /**
     * Assign a new role to the given user.
     *
     * PUT /api/users/{user}/role
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot modify your own role.'], 403);
        }

        $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        $oldRoleName = $user->role?->name ?? 'applicant';
        $role = Role::where('name', $request->string('role'))->firstOrFail();
        $user->role_id = $role->id;
        $user->save();
        $user->load('role');

        // System inbox notification: role changed
        app(SystemNotificationService::class)->roleChanged(
            $user, $oldRoleName, $role->name, $request->user()
        );

        return response()->json([
            'message' => 'Role updated.',
            'data'    => $this->formatUser($user),
        ]);
    }

    /**
     * Deactivate a user account.
     *
     * POST /api/users/{user}/deactivate
     *
     * Sets is_active = false. Does not affect email_verified_at.
     */
    public function deactivate(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 403);
        }

        $user->is_active = false;
        $user->save();

        // Revoke all active tokens so the user is immediately signed out.
        $user->tokens()->delete();

        return response()->json(['message' => 'User deactivated.']);
    }

    /**
     * Reactivate a user account.
     *
     * POST /api/users/{user}/reactivate
     *
     * Sets is_active = true.
     */
    public function reactivate(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot modify your own account status.'], 403);
        }

        $user->is_active = true;
        $user->save();

        return response()->json(['message' => 'User reactivated.']);
    }

    /**
     * Format a User model into the shape the frontend expects.
     *
     * The frontend User type expects a flat `role` string, not a relationship.
     */
    private function formatUser(User $user): array
    {
        return [
            'id'                => $user->id,
            'name'              => $user->name,
            'email'             => $user->email,
            'role'              => $user->role?->name ?? 'applicant',
            'is_active'         => (bool) $user->is_active,
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'mfa_enabled'       => (bool) $user->mfa_enabled,
            'created_at'        => $user->created_at->toISOString(),
        ];
    }
}
