<?php

namespace App\Http\Controllers\Api\Family;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * FamilyController — Family-first admin view of guardian accounts and their campers.
 *
 * A "family" in this system is an applicant User who has registered one or more campers.
 * There is no separate Family model — the User record with role=applicant IS the family.
 * This controller exposes the family-centric view of that data for admin workflows.
 *
 * Two endpoints:
 *   GET /api/families        → paginated summary cards for the Families index page
 *   GET /api/families/{user} → full workspace data for a single family
 *
 * Authorization: admin and super_admin only (via the 'view-families' Gate ability).
 *
 * PHI safety: NO medical record data is loaded anywhere in this controller.
 * Only structural/application data is returned: names, DOB, session assignments, statuses.
 */
class FamilyController extends Controller
{
    /**
     * Return a paginated, searchable list of families (applicant accounts with their campers).
     *
     * GET /api/families
     *
     * Each item in the response is a "family card" containing:
     *   - guardian name, email, phone, city/state
     *   - camper count
     *   - per-camper: name, DOB, application count, latest application + session
     *   - aggregate: active application count, unique application statuses
     *
     * Supported query params:
     *   search      — guardian name, email, or child name (first/last)
     *   session_id  — restrict to families who have campers in this session
     *   status      — restrict to families with at least one application of this status
     *   multi_camper — if truthy, restrict to families with 2+ campers
     *   page        — pagination page number (default 1, 20 per page)
     */
    public function index(Request $request): JsonResponse
    {
        // 'view-families' Gate ability requires admin or super_admin role.
        $this->authorize('view-families');

        // Start with all applicant accounts — these are the "families".
        $query = User::whereHas('role', fn ($q) => $q->where('name', 'applicant'))
            // Count of campers is computed at the DB level — avoids loading all campers just to count them.
            ->withCount('campers')
            ->with([
                // Load each camper with their application count and most recent applications.
                // Applications are ordered newest-first so $camper->applications->first() is the latest.
                // We include campSession:id,name so we can display the session name on the summary card.
                // Intentionally NOT loading medicalRecord — PHI must not appear in list views.
                'campers' => fn ($q) => $q
                    ->withCount('applications')
                    ->with([
                        'applications' => fn ($q2) => $q2
                            ->select(['id', 'camper_id', 'status', 'camp_session_id', 'submitted_at', 'created_at'])
                            ->with('campSession:id,name')
                            ->latest(),
                    ]),
            ]);

        // Full-text search across guardian identity and child names.
        // Wrapped in a single where() group so it does not corrupt any additional scopes below.
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhereHas('campers', fn ($q2) => $q2
                      ->where(function ($q3) use ($search) {
                          $q3->where('first_name', 'like', "%{$search}%")
                             ->orWhere('last_name', 'like', "%{$search}%");
                      }));
            });
        }

        // Session filter — narrow to families who have at least one camper in the given session.
        if ($request->filled('session_id')) {
            $query->whereHas('campers.applications', fn ($q) =>
                $q->where('camp_session_id', (int) $request->input('session_id'))
            );
        }

        // Status filter — narrow to families who have at least one application with this status.
        if ($request->filled('status')) {
            $query->whereHas('campers.applications', fn ($q) =>
                $q->where('status', $request->input('status'))
            );
        }

        // Multi-camper filter — only show families with two or more registered campers.
        if ($request->boolean('multi_camper')) {
            $query->has('campers', '>=', 2);
        }

        // Paginate by family (not by camper) — 20 families per page.
        $families = $query->orderBy('name')->paginate(20);

        // Shape each User into a family summary card.
        $data = $families->map(function (User $user): array {
            $campers = $user->campers->map(function ($camper): array {
                // The applications collection is already ordered newest-first by the eager-load.
                $latestApp = $camper->applications->first();

                return [
                    'id'                 => $camper->id,
                    'first_name'         => $camper->first_name,
                    'last_name'          => $camper->last_name,
                    'full_name'          => $camper->full_name,
                    'date_of_birth'      => $camper->date_of_birth,
                    'gender'             => $camper->gender,
                    'applications_count' => $camper->applications_count,
                    'latest_application' => $latestApp ? [
                        'id'          => $latestApp->id,
                        'status'      => $latestApp->status instanceof \BackedEnum
                                            ? $latestApp->status->value
                                            : $latestApp->status,
                        'submitted_at' => $latestApp->submitted_at,
                        'session_name' => $latestApp->campSession?->name,
                        'session_id'   => $latestApp->camp_session_id,
                    ] : null,
                ];
            })->values()->all();

            // Flatten all applications across all campers to compute aggregate stats.
            $allApplications = $user->campers->flatMap(fn ($c) => $c->applications);

            $activeStatuses = ['pending', 'under_review', 'waitlisted', 'approved'];
            $activeCount = $allApplications->filter(function ($app) use ($activeStatuses): bool {
                $value = $app->status instanceof \BackedEnum ? $app->status->value : $app->status;
                return in_array($value, $activeStatuses, true);
            })->count();

            $uniqueStatuses = $allApplications
                ->map(fn ($app) => $app->status instanceof \BackedEnum ? $app->status->value : $app->status)
                ->unique()
                ->values()
                ->all();

            return [
                'id'                        => $user->id,
                'name'                      => $user->name,
                'email'                     => $user->email,
                'phone'                     => $user->phone,
                'city'                      => $user->city,
                'state'                     => $user->state,
                'created_at'                => $user->created_at,
                'campers_count'             => $user->campers_count,
                'campers'                   => $campers,
                'active_applications_count' => $activeCount,
                'application_statuses'      => $uniqueStatuses,
            ];
        })->values()->all();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $families->currentPage(),
                'last_page'    => $families->lastPage(),
                'per_page'     => $families->perPage(),
                'total'        => $families->total(),
            ],
        ]);
    }

    /**
     * Return the full family workspace for a single guardian account.
     *
     * GET /api/families/{user}
     *
     * Returns the guardian's contact information plus all their campers, each with
     * their complete application history (including session details). This data
     * powers the Family Workspace page (Level 2 of the family-first IA).
     *
     * PHI safety: medical records are intentionally not loaded. Camper names, DOB,
     * gender, and application records are structural data, not PHI.
     */
    public function show(User $user): JsonResponse
    {
        $this->authorize('view-families');

        // This endpoint is only meaningful for applicant (parent/guardian) accounts.
        if (! $user->isApplicant()) {
            return response()->json(['message' => 'Family not found.'], 404);
        }

        // Load all campers belonging to this guardian, with each camper's full application
        // history sorted newest-first, plus session details for each application.
        // No medical data is loaded — PHI stays off this endpoint.
        $user->load([
            'campers' => fn ($q) => $q->with([
                'applications' => fn ($q2) => $q2
                    ->with('campSession:id,name,start_date,end_date,is_active')
                    ->latest(),
            ]),
        ]);

        $campers = $user->campers->map(function ($camper): array {
            $applications = $camper->applications->map(function ($app): array {
                return [
                    'id'              => $app->id,
                    'status'          => $app->status instanceof \BackedEnum
                                            ? $app->status->value
                                            : $app->status,
                    'submitted_at'    => $app->submitted_at,
                    'reviewed_at'     => $app->reviewed_at,
                    'created_at'      => $app->created_at,
                    'camp_session_id' => $app->camp_session_id,
                    // Keyed as 'session' to match the Application type in admin.types.ts.
                    'session' => $app->campSession ? [
                        'id'         => $app->campSession->id,
                        'name'       => $app->campSession->name,
                        'start_date' => $app->campSession->start_date,
                        'end_date'   => $app->campSession->end_date,
                        'is_active'  => $app->campSession->is_active,
                    ] : null,
                ];
            })->values()->all();

            return [
                'id'            => $camper->id,
                'first_name'    => $camper->first_name,
                'last_name'     => $camper->last_name,
                'full_name'     => $camper->full_name,
                'date_of_birth' => $camper->date_of_birth,
                'gender'        => $camper->gender,
                'tshirt_size'   => $camper->tshirt_size,
                'created_at'    => $camper->created_at,
                'applications'  => $applications,
            ];
        })->values()->all();

        return response()->json([
            'data' => [
                'id'             => $user->id,
                'name'           => $user->name,
                'email'          => $user->email,
                'phone'          => $user->phone,
                'address_line_1' => $user->address_line_1,
                'address_line_2' => $user->address_line_2,
                'city'           => $user->city,
                'state'          => $user->state,
                'postal_code'    => $user->postal_code,
                'created_at'     => $user->created_at,
                'campers'        => $campers,
            ],
        ]);
    }
}
