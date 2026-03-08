<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * CalendarEventController — manages camp calendar events.
 *
 * Calendar events represent important dates on the camp calendar — deadlines for applications,
 * session start/end dates, staff meetings, orientations, and other internal milestones.
 * They are displayed on the admin dashboard and applicant portal calendar views.
 *
 * Authorization model:
 *   - Listing (index): any authenticated user; non-admins see only "all"-audience events
 *   - Viewing (show): same audience restriction for non-admins
 *   - Creating, updating, deleting: admin and super_admin only
 *
 * Date range support:
 *   - Provide ?start=&end= to load events for a specific month or week view
 *   - Without those params, defaults to upcoming events in the next 60 days
 *
 * Routes:
 *   GET    /api/calendar           — list events
 *   POST   /api/calendar           — create an event (admin)
 *   GET    /api/calendar/{id}      — view a single event
 *   PUT    /api/calendar/{id}      — update an event (admin)
 *   DELETE /api/calendar/{id}      — delete an event (admin)
 */
class CalendarEventController extends Controller
{
    /**
     * List calendar events, filtered by date range and audience.
     *
     * Date range mode: if both ?start= and ?end= are provided, returns events in that window.
     * Upcoming mode: defaults to events from today through the next 60 days.
     *
     * Admins see all audience segments; non-admins only see "all"-audience events.
     * Results are ordered by start time ascending (soonest first).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Eager-load the creator to display the author name in the calendar UI
        $query = CalendarEvent::with('creator:id,name')
            ->orderBy('starts_at');

        if ($request->filled('start') && $request->filled('end')) {
            // Range mode: use the provided date window (for month/week calendar views)
            $query->inRange($request->query('start'), $request->query('end'));
        } else {
            // Upcoming mode: next 60 days from now; prevents loading past events by default
            $query->upcoming()->where('starts_at', '<=', now()->addDays(60));
        }

        // Non-admins only see events intended for all audiences — staff/internal events are hidden
        if (! $user->isAdmin()) {
            $query->forAudience('all');
        }

        // Return all matching events as an array — calendar views typically need all events at once
        return response()->json(['data' => $query->get()]);
    }

    /**
     * Create a new calendar event (admin only).
     *
     * The creator is automatically set to the authenticated admin user.
     * event_type must be one of the values in CalendarEvent::TYPES (defined on the model).
     */
    public function store(Request $request): JsonResponse
    {
        // Hard gate: only admins may add events to the camp calendar
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $data = $request->validate([
            'title'             => ['required', 'string', 'max:200'],
            'description'       => ['nullable', 'string', 'max:2000'],
            // Must be one of the defined event type constants on CalendarEvent::TYPES
            'event_type'        => ['required', Rule::in(CalendarEvent::TYPES)],
            // Optional hex or named color for calendar display (e.g., "#FF5733" or "red")
            'color'             => ['nullable', 'string', 'max:30'],
            'starts_at'         => ['required', 'date'],
            // ends_at must be on or after starts_at if provided
            'ends_at'           => ['nullable', 'date', 'after_or_equal:starts_at'],
            'all_day'           => ['boolean'],
            'audience'          => ['required', Rule::in(['all', 'accepted', 'staff', 'session'])],
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
        ]);

        $event = CalendarEvent::create([
            ...$data,
            // Attach this event to the admin who created it
            'created_by' => $request->user()->id,
        ]);

        // Load creator relationship so the response includes the author name
        $event->load('creator:id,name');

        return response()->json([
            'message' => 'Calendar event created.',
            'data'    => $event,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show a single calendar event.
     *
     * Non-admins are restricted to "all"-audience events to prevent them from
     * discovering staff meetings or internal deadlines they shouldn't know about.
     */
    public function show(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            // Block access to staff-only or session-specific events for non-admins
            abort_unless(
                $calendarEvent->audience === 'all',
                Response::HTTP_FORBIDDEN,
                'Not authorized to view this event.'
            );
        }

        // Load creator and session names for the detail view
        $calendarEvent->load('creator:id,name', 'targetSession:id,name');

        return response()->json(['data' => $calendarEvent]);
    }

    /**
     * Update a calendar event (admin only).
     *
     * Uses "sometimes" rules so partial updates work — only the fields in the
     * request body are validated and changed.
     */
    public function update(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $data = $request->validate([
            // "sometimes" means each field is only validated if present in the request
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
            // fresh() re-reads the record so the response reflects the saved state
            'data'    => $calendarEvent->fresh(),
        ]);
    }

    /**
     * Delete a calendar event (admin only).
     *
     * Removes the event permanently from the calendar. Consider updating instead
     * (e.g., changing date) rather than deleting events that applicants may have seen.
     */
    public function destroy(Request $request, CalendarEvent $calendarEvent): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $calendarEvent->delete();

        return response()->json(['message' => 'Calendar event deleted.']);
    }
}
