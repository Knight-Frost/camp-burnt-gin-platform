<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for audit log retrieval.
 *
 * Provides super administrators with paginated, filterable access to the
 * system audit log for HIPAA compliance monitoring and security review.
 * Access is restricted to the super_admin role.
 */
class AuditLogController extends Controller
{
    /**
     * Return a paginated list of audit log entries.
     *
     * Supported query parameters:
     *   - search:   text search across action, description, and auditable_type
     *   - user_id:  filter by user who performed the action
     *   - action:   filter by action name (exact or partial match)
     *   - from:     earliest date (Y-m-d)
     *   - to:       latest date (Y-m-d)
     *   - page:     pagination page number
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search'  => ['nullable', 'string', 'max:255'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'action'  => ['nullable', 'string', 'max:100'],
            'from'    => ['nullable', 'date'],
            'to'      => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $query = AuditLog::with('user:id,name,email')
            ->orderBy('created_at', 'desc');

        if ($request->filled('search')) {
            $term = $request->string('search');
            $query->where(function ($q) use ($term) {
                $q->where('action', 'like', "%{$term}%")
                  ->orWhere('description', 'like', "%{$term}%")
                  ->orWhere('auditable_type', 'like', "%{$term}%");
            });
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', 'like', '%'.$request->string('action').'%');
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        $entries = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => $entries->items(),
            'meta' => [
                'current_page' => $entries->currentPage(),
                'last_page'    => $entries->lastPage(),
                'per_page'     => $entries->perPage(),
                'total'        => $entries->total(),
                'from'         => $entries->firstItem(),
                'to'           => $entries->lastItem(),
            ],
        ]);
    }
}
