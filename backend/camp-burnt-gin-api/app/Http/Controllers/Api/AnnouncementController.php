<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Announcement controller.
 *
 * GET  /api/announcements          — list published announcements (audience-filtered)
 * POST /api/announcements          — create (admin)
 * GET  /api/announcements/{id}     — show single
 * PUT  /api/announcements/{id}     — update (admin, author)
 * DELETE /api/announcements/{id}   — delete (admin, author)
 * POST /api/announcements/{id}/pin — toggle pin (admin)
 */
class AnnouncementController extends Controller
{
    /**
     * List published announcements, filtered by the caller's role audience.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Announcement::with('author:id,name')
            ->published()
            ->ordered();

        // Non-admins only see announcements for their audience (all | accepted | parent)
        if (! $user->isAdmin()) {
            $query->forAudience('all');
        }

        $limit = min((int) $request->query('limit', 20), 50);

        $announcements = $query->paginate($limit);

        return response()->json($announcements);
    }

    /**
     * Store a new announcement (admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $data = $request->validate([
            'title'             => ['required', 'string', 'max:200'],
            'body'              => ['required', 'string', 'max:5000'],
            'is_pinned'         => ['boolean'],
            'is_urgent'         => ['boolean'],
            'audience'          => ['required', Rule::in(['all', 'accepted', 'staff', 'session'])],
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            'published_at'      => ['nullable', 'date'],
        ]);

        $announcement = Announcement::create([
            ...$data,
            'author_id'    => $user->id,
            'published_at' => $data['published_at'] ?? now(),
        ]);

        $announcement->load('author:id,name');

        return response()->json([
            'message' => 'Announcement published.',
            'data'    => $announcement,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show a single announcement.
     *
     * Non-admins are restricted to published, all-audience announcements —
     * consistent with the audience gate applied in index().
     */
    public function show(Request $request, Announcement $announcement): JsonResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            abort_unless(
                $announcement->published_at !== null &&
                $announcement->published_at <= now() &&
                $announcement->audience === 'all',
                Response::HTTP_FORBIDDEN,
                'Not authorized to view this announcement.'
            );
        }

        $announcement->load('author:id,name', 'targetSession:id,name');

        return response()->json(['data' => $announcement]);
    }

    /**
     * Update an announcement (admin or original author).
     */
    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user->isAdmin() || $announcement->author_id === $user->id,
            Response::HTTP_FORBIDDEN,
            'Not authorized to edit this announcement.'
        );

        $data = $request->validate([
            'title'             => ['sometimes', 'string', 'max:200'],
            'body'              => ['sometimes', 'string', 'max:5000'],
            'is_pinned'         => ['boolean'],
            'is_urgent'         => ['boolean'],
            'audience'          => ['sometimes', Rule::in(['all', 'accepted', 'staff', 'session'])],
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            'published_at'      => ['nullable', 'date'],
        ]);

        $announcement->update($data);

        return response()->json([
            'message' => 'Announcement updated.',
            'data'    => $announcement->fresh(['author:id,name']),
        ]);
    }

    /**
     * Delete an announcement.
     */
    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user->isAdmin() || $announcement->author_id === $user->id,
            Response::HTTP_FORBIDDEN,
            'Not authorized to delete this announcement.'
        );

        $announcement->delete();

        return response()->json(['message' => 'Announcement deleted.']);
    }

    /**
     * Toggle pin status (admin only).
     */
    public function togglePin(Request $request, Announcement $announcement): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $announcement->update(['is_pinned' => ! $announcement->is_pinned]);

        return response()->json([
            'message'   => $announcement->is_pinned ? 'Announcement pinned.' : 'Announcement unpinned.',
            'is_pinned' => $announcement->is_pinned,
        ]);
    }
}
