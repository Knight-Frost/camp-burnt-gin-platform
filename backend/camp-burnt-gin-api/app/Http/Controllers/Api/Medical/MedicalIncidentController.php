<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MedicalIncident;
use App\Models\User;
use App\Notifications\Medical\CriticalIncidentLoggedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\HttpFoundation\Response;

/**
 * MedicalIncidentController
 *
 * Phase 18 updates:
 *  - index() now accepts ?session_id for session-scoped queries
 *  - store() dispatches CriticalIncidentLoggedNotification for severity >= severe
 *  - All list responses include full camper display name for visibility
 */
class MedicalIncidentController extends Controller
{
    /**
     * List medical incidents with optional filters (paginated).
     *
     * Phase 18: Accepts session_id to scope results to a specific camp session.
     * Results include camper name and recorder for immediate identification.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MedicalIncident::class);

        $query = MedicalIncident::with(['camper', 'recorder'])
            ->orderByDesc('incident_date')
            ->orderByDesc('incident_time');

        // Session scope: filter to incidents recorded during a specific session.
        if ($request->filled('session_id')) {
            $query->where('camp_session_id', $request->integer('session_id'));
        }

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->input('severity'));
        }

        if ($request->filled('from')) {
            $query->whereDate('incident_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('incident_date', '<=', $request->input('to'));
        }

        if ($request->boolean('escalation_required')) {
            $query->where('escalation_required', true);
        }

        $incidents = $query->paginate(25);

        // Shape each incident to include a prominent camper display name.
        $items = collect($incidents->items())->map(fn ($incident) => $this->shapeIncident($incident));

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $incidents->currentPage(),
                'last_page' => $incidents->lastPage(),
                'per_page' => $incidents->perPage(),
                'total' => $incidents->total(),
            ],
        ]);
    }

    /**
     * Record a new medical incident.
     *
     * Phase 18: Accepts optional camp_session_id for session binding.
     * Dispatches critical/severe incident notifications to admin and medical staff.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', MedicalIncident::class);

        $validated = $request->validate([
            'camper_id' => 'required|integer|exists:campers,id',
            'camp_session_id' => 'nullable|integer|exists:camp_sessions,id',
            'treatment_log_id' => 'nullable|integer|exists:treatment_logs,id',
            'type' => 'required|string|in:behavioral,medical,injury,environmental,emergency,other',
            'severity' => 'required|string|in:minor,moderate,severe,critical',
            'location' => 'nullable|string|max:255',
            'title' => 'required|string|max:500',
            'description' => 'required|string|max:5000',
            'witnesses' => 'nullable|string|max:2000',
            'escalation_required' => 'boolean',
            'escalation_notes' => 'nullable|string|max:2000',
            'incident_date' => 'required|date|before_or_equal:today',
            'incident_time' => 'nullable|date_format:H:i',
        ]);

        $incident = MedicalIncident::create(array_merge(
            $validated,
            ['recorded_by' => $request->user()->id]
        ));

        AuditLog::logPhiAccess('incident.created', $request->user(), $incident, [
            'camper_id' => $incident->camper_id,
            'type' => $incident->type,
            'severity' => $incident->severity,
        ]);

        $incident->load(['camper', 'recorder']);

        // Notify medical staff and admins of critical/severe incidents.
        if (in_array($incident->severity, ['severe', 'critical'], true)) {
            $this->notifyMedicalStaff($incident);
        }

        return response()->json([
            'message' => 'Medical incident recorded successfully.',
            'data' => $this->shapeIncident($incident),
        ], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single incident with full detail.
     */
    public function show(MedicalIncident $medicalIncident): JsonResponse
    {
        $this->authorize('view', $medicalIncident);

        $medicalIncident->load(['camper', 'recorder', 'treatmentLog']);

        return response()->json(['data' => $this->shapeIncident($medicalIncident)]);
    }

    /**
     * Update an existing incident report.
     */
    public function update(Request $request, MedicalIncident $medicalIncident): JsonResponse
    {
        $this->authorize('update', $medicalIncident);

        $validated = $request->validate([
            'camp_session_id' => 'nullable|integer|exists:camp_sessions,id',
            'type' => 'sometimes|string|in:behavioral,medical,injury,environmental,emergency,other',
            'severity' => 'sometimes|string|in:minor,moderate,severe,critical',
            'location' => 'nullable|string|max:255',
            'title' => 'sometimes|string|max:500',
            'description' => 'sometimes|string|max:5000',
            'witnesses' => 'nullable|string|max:2000',
            'escalation_required' => 'boolean',
            'escalation_notes' => 'nullable|string|max:2000',
            'incident_date' => 'sometimes|date|before_or_equal:today',
            'incident_time' => 'nullable|date_format:H:i',
            'treatment_log_id' => 'nullable|integer|exists:treatment_logs,id',
        ]);

        $oldValues = $medicalIncident->only(array_keys($validated));
        $medicalIncident->update($validated);

        AuditLog::logContentChange($medicalIncident, $request->user(), $oldValues, $medicalIncident->only(array_keys($validated)));

        $medicalIncident->load(['camper', 'recorder']);

        return response()->json([
            'message' => 'Medical incident updated successfully.',
            'data' => $this->shapeIncident($medicalIncident),
        ]);
    }

    /**
     * Delete an incident report (admin only).
     */
    public function destroy(MedicalIncident $medicalIncident): JsonResponse
    {
        $this->authorize('delete', $medicalIncident);

        AuditLog::logAdminAction('incident.deleted', request()->user(), 'Medical incident deleted', [
            'incident_id' => $medicalIncident->id,
            'camper_id' => $medicalIncident->camper_id,
            'type' => $medicalIncident->type,
            'severity' => $medicalIncident->severity,
        ]);

        $medicalIncident->delete();

        return response()->json(['message' => 'Medical incident deleted successfully.']);
    }

    /**
     * Shape a single incident for API response.
     * Adds a prominent camper_name field and session context.
     */
    protected function shapeIncident(MedicalIncident $incident): array
    {
        $data = $incident->toArray();

        // Surface camper name prominently at the top of the response. The
        // camper relation may be null if the row was soft-deleted after the
        // incident was recorded; guard with ?-> and surface null cleanly.
        $data['camper_name'] = $incident->camper
            ? trim(($incident->camper->first_name ?? '').' '.($incident->camper->last_name ?? ''))
            : null;

        $data['recorder_name'] = $incident->recorder?->name;

        return $data;
    }

    /**
     * Dispatch notifications to all medical staff and admins for critical incidents.
     * Uses the database + mail channels. No PHI in notification body.
     *
     * User has a singular `role` relation (one role_id FK), not a many-to-many
     * `roles`. Using whereHas('roles', ...) throws RelationNotFoundException
     * when the first critical incident ever fires — exactly the worst time.
     */
    protected function notifyMedicalStaff(MedicalIncident $incident): void
    {
        $recipients = User::whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin', 'medical'])
        )->get();

        foreach ($recipients as $recipient) {
            // Don't notify the person who logged the incident.
            if ($recipient->id === $incident->recorded_by) {
                continue;
            }

            $recipient->notify(new CriticalIncidentLoggedNotification($incident));
        }
    }
}
