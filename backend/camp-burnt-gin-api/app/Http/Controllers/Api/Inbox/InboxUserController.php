<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * InboxUserController provides a role-aware user search for the compose window.
 *
 * Role restrictions:
 * - parent: can only see admin and medical users (cannot message other parents)
 * - admin / super_admin: can see all users
 * - medical: can see admin and parent users
 *
 * GET /api/inbox/users?search=...
 */
class InboxUserController extends Controller
{
    /**
     * Search for users that the authenticated user is allowed to message.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => 'nullable|string|max:100',
        ]);

        $authUser = $request->user();
        $search   = trim($request->string('search', ''));

        $query = User::query()
            ->with('role')
            ->where('id', '!=', $authUser->id);   // exclude self

        // Role-based recipient restrictions
        if ($authUser->isApplicant()) {
            // Parents can only message admins
            $query->whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']));
        } elseif ($authUser->isMedicalProvider()) {
            // Medical can message admins and parents
            $query->whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin', 'applicant']));
        }
        // admin / super_admin see all users (no additional filter)

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('name')->limit(20)->get();

        return response()->json([
            'success' => true,
            'data' => $users->map(fn (User $u) => [
                'id'    => $u->id,
                'name'  => $u->name,
                'email' => $u->email,
                'role'  => $u->role?->name ?? 'unknown',
            ])->values(),
        ]);
    }
}
