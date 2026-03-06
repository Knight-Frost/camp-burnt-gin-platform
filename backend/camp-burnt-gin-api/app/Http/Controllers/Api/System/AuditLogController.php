<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Controller for audit log retrieval and export.
 *
 * Provides super administrators with paginated, filterable access to the
 * system audit log for HIPAA compliance monitoring and security review.
 * Access is restricted to the super_admin role.
 *
 * Supported filters:
 *   search      - text across action, description, entity type
 *   user_id     - filter by actor
 *   action      - filter by action name
 *   event_type  - category filter (authentication, messaging, applications, etc.)
 *   entity_type - short model name (Conversation, Message, Application, etc.)
 *   from / to   - date range
 *
 * Export: GET /audit-log/export?format=csv|json
 */
class AuditLogController extends Controller
{
    /**
     * Return a paginated list of audit log entries.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search'      => ['nullable', 'string', 'max:255'],
            'user_id'     => ['nullable', 'integer', 'exists:users,id'],
            'action'      => ['nullable', 'string', 'max:100'],
            'event_type'  => ['nullable', 'string', 'max:100'],
            'entity_type' => ['nullable', 'string', 'max:100'],
            'from'        => ['nullable', 'date'],
            'to'          => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $query = $this->buildQuery($request);

        $entries = $query->paginate($request->integer('per_page', 25));

        return response()->json([
            'data' => $this->formatEntries($entries->items()),
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

    /**
     * Export audit log entries as CSV or JSON.
     *
     * GET /audit-log/export?format=csv|json&...filters
     *
     * Same filter parameters as index(). Capped at 5,000 rows to prevent
     * accidental over-export; add pagination for larger exports.
     */
    public function export(Request $request): Response|JsonResponse
    {
        $request->validate([
            'format'      => ['nullable', 'string', 'in:csv,json'],
            'search'      => ['nullable', 'string', 'max:255'],
            'user_id'     => ['nullable', 'integer', 'exists:users,id'],
            'action'      => ['nullable', 'string', 'max:100'],
            'event_type'  => ['nullable', 'string', 'max:100'],
            'entity_type' => ['nullable', 'string', 'max:100'],
            'from'        => ['nullable', 'date'],
            'to'          => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $format  = $request->input('format', 'csv');
        $entries = $this->buildQuery($request)->limit(5000)->get();
        $rows    = $this->formatEntries($entries->all());

        if ($format === 'json') {
            $json     = json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $filename = 'audit-log-' . now()->format('Y-m-d') . '.json';
            return response($json, 200, [
                'Content-Type'        => 'application/json',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            ]);
        }

        // CSV
        $filename = 'audit-log-' . now()->format('Y-m-d') . '.csv';
        $headers  = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $columns = ['id', 'timestamp', 'category', 'action', 'description', 'user', 'user_id', 'entity', 'entity_id', 'ip_address', 'user_agent'];
        $csvRows = [];
        $csvRows[] = implode(',', array_map(fn ($c) => '"' . $c . '"', $columns));

        foreach ($rows as $row) {
            $csvRows[] = implode(',', [
                $row['id'],
                '"' . ($row['created_at'] ?? '') . '"',
                '"' . ($row['event_type'] ?? '') . '"',
                '"' . addslashes($row['action'] ?? '') . '"',
                '"' . addslashes($row['description'] ?? '') . '"',
                '"' . addslashes($row['user']['name'] ?? 'System') . '"',
                $row['user_id'] ?? '',
                '"' . addslashes($this->shortEntityType($row['auditable_type'] ?? '')) . '"',
                $row['auditable_id'] ?? '',
                '"' . ($row['ip_address'] ?? '') . '"',
                '"' . addslashes(substr($row['user_agent'] ?? '', 0, 80)) . '"',
            ]);
        }

        return response(implode("\n", $csvRows), 200, $headers);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function buildQuery(Request $request)
    {
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
            $query->where('action', 'like', '%' . $request->string('action') . '%');
        }

        if ($request->filled('event_type')) {
            $query->where('event_type', $request->string('event_type'));
        }

        if ($request->filled('entity_type')) {
            // Accept short names like "Conversation" or full "App\Models\Conversation"
            $entityType = $request->string('entity_type');
            $query->where(function ($q) use ($entityType) {
                $q->where('auditable_type', 'like', "%{$entityType}%");
            });
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        return $query;
    }

    /**
     * Format raw AuditLog models into a consistent API response shape.
     * Adds derived fields: human_description, category, short entity name.
     */
    private function formatEntries(array $items): array
    {
        return array_map(function (AuditLog $entry) {
            $shortEntity = $this->shortEntityType($entry->auditable_type ?? '');
            $userName    = $entry->user?->name ?? 'System';

            return [
                'id'               => $entry->id,
                'request_id'       => $entry->request_id,
                'user_id'          => $entry->user_id,
                'user'             => $entry->user ? [
                    'id'    => $entry->user->id,
                    'name'  => $entry->user->name,
                    'email' => $entry->user->email,
                ] : null,
                'event_type'       => $entry->event_type,
                'category'         => $this->mapCategory($entry->event_type),
                'action'           => $entry->action,
                'description'      => $entry->description,
                'human_description'=> $this->buildHumanDescription($userName, $entry->action, $shortEntity, $entry->auditable_id, $entry->description),
                'auditable_type'   => $entry->auditable_type,
                'auditable_id'     => $entry->auditable_id,
                'entity_label'     => $shortEntity,
                'old_values'       => $entry->old_values,
                'new_values'       => $entry->new_values,
                'metadata'         => $entry->metadata,
                'ip_address'       => $entry->ip_address,
                'user_agent'       => $entry->user_agent,
                'created_at'       => $entry->created_at?->toISOString(),
            ];
        }, $items);
    }

    /**
     * Convert a fully-qualified model class name to a short display label.
     * "App\Models\Conversation" → "Conversation"
     */
    private function shortEntityType(string $type): string
    {
        if (!$type) return '';
        $parts = explode('\\', $type);
        return end($parts);
    }

    /**
     * Map event_type values to human-readable category labels.
     */
    private function mapCategory(string $eventType): string
    {
        return match ($eventType) {
            'authentication', 'auth'           => 'Authentication',
            'message', 'conversation'           => 'Messaging',
            'message_attachment'                => 'Messaging',
            'application'                       => 'Applications',
            'notification'                      => 'Notifications',
            'security', 'mfa'                   => 'Security',
            'phi_access', 'medical'             => 'Medical',
            'admin_action', 'data_change'       => 'Administrative',
            'file_access', 'document'           => 'Documents',
            'system', 'user'                    => 'System',
            default                             => 'System',
        };
    }

    /**
     * Build a plain-English sentence describing what happened.
     *
     * Prefers the stored description when it is already informative.
     * Falls back to a generated phrase for common actions.
     */
    private function buildHumanDescription(
        string $userName,
        string $action,
        string $entityLabel,
        ?int   $entityId,
        ?string $storedDescription
    ): string {
        // Use stored description if it reads naturally (longer than a bare action word)
        if ($storedDescription && strlen($storedDescription) > 20) {
            return $storedDescription;
        }

        $entity = $entityLabel && $entityId
            ? "{$entityLabel} #{$entityId}"
            : ($entityLabel ?: 'record');

        return match ($action) {
            'created'             => "{$userName} created {$entity}",
            'updated'             => "{$userName} updated {$entity}",
            'deleted', 'soft_deleted' => "{$userName} deleted {$entity}",
            'archived'            => "{$userName} archived {$entity}",
            'unarchived'          => "{$userName} restored {$entity} from archive",
            'trashed'             => "{$userName} moved {$entity} to trash",
            'restored_from_trash' => "{$userName} restored {$entity} from trash",
            'sent'                => "{$userName} sent a message in {$entity}",
            'read'                => "{$userName} read {$entity}",
            'viewed', 'view'      => "{$userName} viewed {$entity}",
            'login'               => "{$userName} logged in",
            'logout'              => "{$userName} logged out",
            'login_failed'        => "Failed login attempt for {$userName}",
            'mfa_enabled'         => "{$userName} enabled two-factor authentication",
            'mfa_disabled'        => "{$userName} disabled two-factor authentication",
            'password_reset'      => "{$userName} reset their password",
            'approved'            => "{$userName} approved {$entity}",
            'rejected'            => "{$userName} rejected {$entity}",
            'starred'             => "{$userName} starred {$entity}",
            'participant_added'   => "{$userName} added a participant to {$entity}",
            'participant_removed' => "{$userName} removed a participant from {$entity}",
            'accessed'            => "{$userName} downloaded attachment on {$entity}",
            'attached'            => "{$userName} attached a file to {$entity}",
            default               => "{$userName} performed '{$action}' on {$entity}",
        };
    }
}
