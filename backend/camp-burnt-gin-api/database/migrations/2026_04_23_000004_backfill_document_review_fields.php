<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill migration — populates the new document review columns from existing data.
 *
 * Strategy:
 *  1. approved_by / approved_at: copy from verified_by / verified_at where
 *     verification_status = 'approved'.
 *  2. rejected_by / rejected_at: same for 'rejected'.
 *  3. document_request_id: match existing documents to document_requests via
 *     (documentable_id matches application_id, or via camper join) + document_type.
 *     Uses the OLDEST open or resolved request for each (camper, type) pair so that
 *     documents uploaded in response to the first request get the correct FK.
 *  4. Seed one document_review_events row per document whose verification_status is
 *     not pending, giving the new timeline a starting point.
 *
 * This migration is deliberately permissive — unmatched documents are left with
 * NULL document_request_id rather than aborting, because legacy records may have
 * been uploaded without a formal request.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Step 1 & 2: Copy approved/rejected fields from verified_by / verified_at ──

        DB::table('documents')
            ->where('verification_status', 'approved')
            ->whereNotNull('verified_by')
            ->whereNull('approved_by')
            ->update([
                'approved_by' => DB::raw('verified_by'),
                'approved_at' => DB::raw('verified_at'),
            ]);

        DB::table('documents')
            ->where('verification_status', 'rejected')
            ->whereNotNull('verified_by')
            ->whereNull('rejected_by')
            ->update([
                'rejected_by' => DB::raw('verified_by'),
                'rejected_at' => DB::raw('verified_at'),
            ]);

        // ── Step 3: Link documents to document_requests ──────────────────────────────
        // Using query-builder PHP loops (DB-agnostic) to support both MySQL
        // (production) and SQLite (test environment).

        // Path A: document is attached to an Application.
        // Match via document_requests.application_id + document_type.
        DB::table('documents')
            ->where('documentable_type', 'App\\Models\\Application')
            ->whereNull('document_request_id')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->each(function ($doc) {
                $request = DB::table('document_requests')
                    ->where('application_id', $doc->documentable_id)
                    ->where('document_type', $doc->document_type)
                    ->whereNull('deleted_at')
                    ->orderBy('created_at')
                    ->first();

                if ($request) {
                    DB::table('documents')
                        ->where('id', $doc->id)
                        ->update(['document_request_id' => $request->id]);
                }
            });

        // Path B: document is attached to a Camper directly.
        // Match via document_requests.camper_id + document_type.
        DB::table('documents')
            ->where('documentable_type', 'App\\Models\\Camper')
            ->whereNull('document_request_id')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->each(function ($doc) {
                $request = DB::table('document_requests')
                    ->where('camper_id', $doc->documentable_id)
                    ->where('document_type', $doc->document_type)
                    ->whereNull('deleted_at')
                    ->orderBy('created_at')
                    ->first();

                if ($request) {
                    DB::table('documents')
                        ->where('id', $doc->id)
                        ->update(['document_request_id' => $request->id]);
                }
            });

        // ── Step 4: Seed review events for already-reviewed documents ─────────────────

        $now = now()->toDateTimeString();

        // Approved documents → one 'approved' event
        $approved = DB::table('documents')
            ->where('verification_status', 'approved')
            ->whereNotNull('approved_at')
            ->whereNull('deleted_at')
            ->select([
                'id as document_id',
                'document_request_id',
                'approved_by as performed_by',
                'approved_at as created_at',
            ])
            ->get();

        foreach ($approved as $doc) {
            $applicationId = $this->resolveApplicationId($doc->document_id);
            $camperId = $this->resolveCamperId($doc->document_id);

            DB::table('document_review_events')->insert([
                'document_id' => $doc->document_id,
                'document_request_id' => $doc->document_request_id,
                'application_id' => $applicationId,
                'camper_id' => $camperId,
                'action' => 'approved',
                'performed_by' => $doc->performed_by,
                'reason' => null,
                'notes' => null,
                'metadata' => null,
                'created_at' => $doc->created_at ?? $now,
            ]);
        }

        // Rejected documents → one 'rejected' event
        $rejected = DB::table('documents')
            ->where('verification_status', 'rejected')
            ->whereNotNull('rejected_at')
            ->whereNull('deleted_at')
            ->select([
                'id as document_id',
                'document_request_id',
                'rejected_by as performed_by',
                'rejected_at as created_at',
                'rejection_reason as reason',
            ])
            ->get();

        foreach ($rejected as $doc) {
            $applicationId = $this->resolveApplicationId($doc->document_id);
            $camperId = $this->resolveCamperId($doc->document_id);

            DB::table('document_review_events')->insert([
                'document_id' => $doc->document_id,
                'document_request_id' => $doc->document_request_id,
                'application_id' => $applicationId,
                'camper_id' => $camperId,
                'action' => 'rejected',
                'performed_by' => $doc->performed_by,
                'reason' => $doc->reason,
                'notes' => null,
                'metadata' => null,
                'created_at' => $doc->created_at ?? $now,
            ]);
        }
    }

    public function down(): void
    {
        // Clear backfilled data only — do not drop columns (that is M1's rollback).
        DB::table('documents')->update([
            'document_request_id' => null,
            'rejection_reason' => null,
            'approved_by' => null,
            'approved_at' => null,
            'rejected_by' => null,
            'rejected_at' => null,
        ]);

        DB::table('document_review_events')->truncate();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private function resolveApplicationId(int $documentId): ?int
    {
        $doc = DB::table('documents')->where('id', $documentId)
            ->select('documentable_type', 'documentable_id')
            ->first();

        if (! $doc) {
            return null;
        }

        if ($doc->documentable_type === 'App\\Models\\Application') {
            return $doc->documentable_id;
        }

        // Camper-attached: look for an application linked to this camper
        if ($doc->documentable_type === 'App\\Models\\Camper') {
            $app = DB::table('applications')
                ->where('camper_id', $doc->documentable_id)
                ->orderBy('created_at', 'desc')
                ->value('id');

            return $app ?: null;
        }

        return null;
    }

    private function resolveCamperId(int $documentId): ?int
    {
        $doc = DB::table('documents')->where('id', $documentId)
            ->select('documentable_type', 'documentable_id')
            ->first();

        if (! $doc) {
            return null;
        }

        if ($doc->documentable_type === 'App\\Models\\Camper') {
            return $doc->documentable_id;
        }

        if ($doc->documentable_type === 'App\\Models\\Application') {
            return DB::table('applications')
                ->where('id', $doc->documentable_id)
                ->value('camper_id');
        }

        return null;
    }
};
