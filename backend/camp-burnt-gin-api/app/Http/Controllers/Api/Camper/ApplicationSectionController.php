<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Http\Requests\Application\ReplaceSectionRequest;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Services\Camper\ApplicationCompletenessService;
use App\Services\Camper\ApplicationSectionReplacer;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Atomic single-section update endpoint for the digital application form.
 *
 * POST /api/applications/{application}/sections/{key}
 *
 * Replaces the entire data set for one section in a single transaction.
 * The frontend's per-section navigation flush calls this endpoint exactly
 * once per section. There is no partial-write window — either every field
 * lands or none do, and `sections_reviewed[$key]` is stamped only on
 * success.
 *
 * Companion artefacts:
 *   - ReplaceSectionRequest    — per-section validation rules
 *   - ApplicationSectionReplacer — DB::transaction-wrapped writer
 *   - ApplicationPolicy::replaceSection — authorization gate
 *
 * Why this exists at all: the previous per-row CRUD pattern (8 different
 * endpoints, 1–15 individual awaits per section flush) had no transaction
 * boundary. A network drop midway left the database in a partial state
 * the next flush couldn't reconcile. See the 2026-04-22 forensic audit
 * (RC-3, RC-4, RC-5) for the full breakdown.
 */
class ApplicationSectionController extends Controller
{
    public function __construct(
        protected ApplicationSectionReplacer $replacer,
        protected ApplicationCompletenessService $completenessService,
    ) {}

    /**
     * Replace one section atomically.
     *
     * Returns the refreshed application + the rich validation report so the
     * client can update its completion-status display in a single round
     * trip. No second `getApplicationCompleteness()` call needed.
     */
    public function replace(
        ReplaceSectionRequest $request,
        Application $application,
    ): JsonResponse {
        $this->authorize('replaceSection', $application);

        $sectionKey = $request->sectionKey();

        $fresh = $this->replacer->replace(
            $application,
            $sectionKey,
            $request->payload(),
            $request->attestation(),
        );

        // Re-evaluate completeness against the freshly written state so the
        // client gets an authoritative answer in the same response. This
        // closes the race where the client refetched validation before the
        // section save committed.
        $validation = $this->completenessService->evaluate($fresh);

        return response()->json([
            'data' => new ApplicationResource($fresh),
            'validation' => $validation,
            'section' => $sectionKey,
        ], Response::HTTP_OK);
    }
}
