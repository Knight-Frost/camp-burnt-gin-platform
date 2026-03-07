<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Models\MedicalFollowUp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class MedicalFollowUpController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MedicalFollowUp::class);

        $query = MedicalFollowUp::with(['camper', 'creator', 'assignee'])
            ->orderBy('due_date')
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'medium', 'low')");

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->integer('assigned_to'));
        }
        if ($request->boolean('overdue')) {
            $query->whereNotIn('status', ['completed', 'cancelled'])
                  ->whereDate('due_date', '<', now()->toDateString());
        }

        $followUps = $query->paginate(25);

        return response()->json([
            'data' => $followUps->items(),
            'meta' => [
                'current_page' => $followUps->currentPage(),
                'last_page'    => $followUps->lastPage(),
                'per_page'     => $followUps->perPage(),
                'total'        => $followUps->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', MedicalFollowUp::class);

        $validated = $request->validate([
            'camper_id'        => 'required|integer|exists:campers,id',
            'assigned_to'      => 'nullable|integer|exists:users,id',
            'treatment_log_id' => 'nullable|integer|exists:treatment_logs,id',
            'title'            => 'required|string|max:500',
            'notes'            => 'nullable|string|max:5000',
            'status'           => 'sometimes|string|in:pending,in_progress,completed,cancelled',
            'priority'         => 'sometimes|string|in:low,medium,high,urgent',
            'due_date'         => 'required|date',
        ]);

        $followUp = MedicalFollowUp::create(array_merge(
            $validated,
            ['created_by' => $request->user()->id]
        ));

        $followUp->load(['camper', 'creator', 'assignee']);

        return response()->json([
            'message' => 'Follow-up created successfully.',
            'data'    => $followUp,
        ], Response::HTTP_CREATED);
    }

    public function show(MedicalFollowUp $medicalFollowUp): JsonResponse
    {
        $this->authorize('view', $medicalFollowUp);
        $medicalFollowUp->load(['camper', 'creator', 'assignee', 'treatmentLog']);

        return response()->json(['data' => $medicalFollowUp]);
    }

    public function update(Request $request, MedicalFollowUp $medicalFollowUp): JsonResponse
    {
        $this->authorize('update', $medicalFollowUp);

        $validated = $request->validate([
            'assigned_to' => 'nullable|integer|exists:users,id',
            'title'       => 'sometimes|string|max:500',
            'notes'       => 'nullable|string|max:5000',
            'status'      => 'sometimes|string|in:pending,in_progress,completed,cancelled',
            'priority'    => 'sometimes|string|in:low,medium,high,urgent',
            'due_date'    => 'sometimes|date',
        ]);

        // Auto-set completed_at when marking complete
        if (isset($validated['status']) && $validated['status'] === 'completed') {
            $validated['completed_at'] = Carbon::now();
            $validated['completed_by'] = $request->user()->id;
        }

        $medicalFollowUp->update($validated);
        $medicalFollowUp->load(['camper', 'creator', 'assignee']);

        return response()->json([
            'message' => 'Follow-up updated successfully.',
            'data'    => $medicalFollowUp,
        ]);
    }

    public function destroy(MedicalFollowUp $medicalFollowUp): JsonResponse
    {
        $this->authorize('delete', $medicalFollowUp);
        $medicalFollowUp->delete();

        return response()->json(['message' => 'Follow-up deleted successfully.']);
    }
}
