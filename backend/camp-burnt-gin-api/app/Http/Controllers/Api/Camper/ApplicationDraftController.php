<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Models\ApplicationDraft;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ApplicationDraftController — server-side save slots for in-progress forms.
 *
 * A draft is a raw JSON blob of the frontend FormState. It is not linked to
 * any camper or application record — those are created only on final Submit.
 * This resource is applicant-only; admins do not interact with drafts.
 *
 * Endpoints:
 *   GET    /application-drafts           List all drafts for the authenticated user
 *   POST   /application-drafts           Create a new (empty) draft
 *   GET    /application-drafts/{draft}   Retrieve a single draft
 *   PUT    /application-drafts/{draft}   Save (overwrite) the draft data
 *   DELETE /application-drafts/{draft}   Hard-delete the draft
 */
class ApplicationDraftController extends Controller
{
    /**
     * List all draft save slots for the authenticated user.
     *
     * GET /api/application-drafts
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ApplicationDraft::class);

        $drafts = ApplicationDraft::where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->get(['id', 'label', 'created_at', 'updated_at']);

        return response()->json(['data' => $drafts]);
    }

    /**
     * Create a new empty draft save slot.
     *
     * POST /api/application-drafts
     * Body: { label?: string }
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ApplicationDraft::class);

        $validated = $request->validate([
            'label' => ['sometimes', 'string', 'max:255'],
        ]);

        $draft = ApplicationDraft::create([
            'user_id' => $request->user()->id,
            'label' => $validated['label'] ?? 'New Application',
            'draft_data' => null,
        ]);

        return response()->json(['data' => $draft], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single draft (including its full draft_data).
     *
     * GET /api/application-drafts/{draft}
     */
    public function show(ApplicationDraft $draft): JsonResponse
    {
        $this->authorize('view', $draft);

        return response()->json(['data' => $draft]);
    }

    /**
     * Save (overwrite) the draft data. Called on every auto-save.
     *
     * PUT /api/application-drafts/{draft}
     * Body: { label?: string, draft_data: object }
     */
    public function update(Request $request, ApplicationDraft $draft): JsonResponse
    {
        $this->authorize('update', $draft);

        $validated = $request->validate([
            'label' => ['sometimes', 'string', 'max:255'],
            'draft_data' => ['required', 'array'],
        ]);

        $draft->update([
            'label' => $validated['label'] ?? $draft->label,
            'draft_data' => $validated['draft_data'],
        ]);

        return response()->json(['data' => $draft->only(['id', 'label', 'updated_at'])]);
    }

    /**
     * Permanently delete a draft. No audit log — drafts contain no finalised records.
     *
     * DELETE /api/application-drafts/{draft}
     */
    public function destroy(ApplicationDraft $draft): JsonResponse
    {
        $this->authorize('delete', $draft);

        $draft->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
