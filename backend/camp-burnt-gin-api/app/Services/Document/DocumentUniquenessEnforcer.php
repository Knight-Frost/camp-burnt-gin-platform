<?php

namespace App\Services\Document;

use App\Models\Document;
use Illuminate\Support\Facades\DB;

/**
 * DocumentUniquenessEnforcer — enforce the invariant
 * "one live document per (documentable_type, documentable_id, document_type)".
 *
 * Shared by:
 *   • the archive migration (2026_04_19_000003) — one-shot cleanup of
 *     existing duplicates so the unique index can be created.
 *   • the artisan command (`docs:dedupe-active`) — ad-hoc ops tool to run
 *     against production or dev databases.
 *   • DocumentService::upload (at write time) — archive-old + create-new
 *     pattern that prevents new duplicates from landing.
 *
 * "Live" = archived_at IS NULL AND deleted_at IS NULL AND message_id IS NULL.
 * Message attachments are intentionally exempt — a thread can legitimately
 * carry many attachments of the same type.
 */
class DocumentUniquenessEnforcer
{
    /**
     * Archive duplicate live documents so the remaining live set satisfies
     * the uniqueness invariant. Keeps the newest row per group (highest id,
     * newest created_at tiebreaker); archives the rest.
     *
     * @param  bool  $dryRun  When true, no rows are mutated. Returns the plan.
     * @return array{groups_found: int, rows_archived: int, groups: list<array{key: string, kept: int, archived: list<int>}>}
     */
    public function archiveDuplicates(bool $dryRun = false): array
    {
        $duplicateGroups = DB::table('documents')
            ->select('documentable_type', 'documentable_id', 'document_type', DB::raw('COUNT(*) as n'))
            ->whereNotNull('documentable_type')
            ->whereNotNull('documentable_id')
            ->whereNotNull('document_type')
            ->whereNull('archived_at')
            ->whereNull('deleted_at')
            ->whereNull('message_id')
            ->groupBy('documentable_type', 'documentable_id', 'document_type')
            ->having('n', '>', 1)
            ->get();

        $result = [
            'groups_found'  => $duplicateGroups->count(),
            'rows_archived' => 0,
            'groups'        => [],
        ];

        foreach ($duplicateGroups as $g) {
            $rows = Document::where('documentable_type', $g->documentable_type)
                ->where('documentable_id', $g->documentable_id)
                ->where('document_type', $g->document_type)
                ->whereNull('archived_at')
                ->whereNull('deleted_at')
                ->whereNull('message_id')
                ->orderByDesc('id')            // newest id first
                ->get();

            $keeper   = $rows->shift();
            $archiveIds = $rows->pluck('id')->all();

            if (! empty($archiveIds) && ! $dryRun) {
                Document::whereIn('id', $archiveIds)->update(['archived_at' => now()]);
            }

            $result['rows_archived'] += count($archiveIds);
            $result['groups'][] = [
                'key'      => class_basename((string) $g->documentable_type)
                             .':'.$g->documentable_id
                             .':'.$g->document_type,
                'kept'     => $keeper?->id ?? 0,
                'archived' => $archiveIds,
            ];
        }

        return $result;
    }
}
