<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Calendar event controller.
 *
 * GET  /api/calendar               — list events (date range or upcoming)
 * POST /api/calendar               — create (admin)
 * GET  /api/calendar/{id}          — show
 * PUT  /api/calendar/{id}          — update (admin)
 * DELETE /api/calendar/{id}        — delete (admin)
 */
class CalendarEventController extends Controller
{
    /**
     * List calendar events. Supports ?start=&end= for range queries, or
     * defaults to upcoming 60 days.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = CalendarEvent::with('creator:id,name')
            ->orderBy('starts_at');

        if ($request->filled('start') && $request->filled('end')) {
            $query->inRange($request->query('start'), $request->query('end'));
        } else {
            $query->upcoming()->where('starts_at', '<=', now()->addDays(60));
        }

        // Non-admins only see public audience events
        if (! $user->isAdmin()) {
            $query->forAudience('all');
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Create a calendar event (admin only).
     */
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $data = $request->validate([
            'title'             => ['required', 'string', 'max:200'],
            'description'       => ['nullable', 'string', 'max:2000'],
            'event_type'        => ['required', Rule::in(CalendarEvent::TYPES)],
            'color'             => ['nullable', 'string', 'max:30'],
            'starts_at'         => ['required', 'date'],
            'ends_at'           => ['nullable', 'date', 'after_or_equal:starts_at'],
            'all_day'           => ['boolean'],
            'audience'          => ['required', Rule::in(['all', 'accepted', 'staff', 'session'])],
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
        ]);

        $event = CalendarEvent::create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        $event->load('creator:id,name');

        return response()->json([
            'message' => 'Calendar event created.',
            'data'    => $event,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show a single event.
     *
     * Non-admins are restricted to all-audience events — consistent with
     * the audience gate applied in index().
     */
    public function show(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            abort_unless(
                $calendarEvent->audience === 'all',
                Response::HTTP_FORBIDDEN,
                'Not authorized to view this event.'
            );
        }

        $calendarEvent->load('creator:id,name', 'targetSession:id,name');

        return response()->json(['data' => $calendarEvent]);
    }

    /**
     * Update an event (admin only).
     */
    public function update(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $data = $request->validate([
            'title'             => ['sometimes', 'string', 'max:200'],
            'description'       => ['nullable', 'string', 'max:2000'],
            'event_type'        => ['sometimes', Rule::in(CalendarEvent::TYPES)],
            'color'             => ['nullable', 'string', 'max:30'],
            'starts_at'         => ['sometimes', 'date'],
            'ends_at'           => ['nullable', 'date'],
            'all_day'           => ['boolean'],
            'audience'          => ['sometimes', Rule::in(['all', 'accepted', 'staff', 'session'])],
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
        ]);

        $calendarEvent->update($data);

        return response()->json([
            'message' => 'Calendar event updated.',
            'data'    => $calendarEvent->fresh(),
        ]);
    }

    /**
     * Delete an event.
     */
    public function destroy(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $calendarEvent->delete();

        return response()->json(['message' => 'Calendar event deleted.']);
    }
}
