<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * AuditLog model — an immutable ledger of security and compliance events.
 *
 * Every significant action in the system (logins, PHI access, admin changes)
 * is written here so administrators and compliance auditors can reconstruct
 * exactly what happened, who did it, and from where.
 *
 * Design decisions:
 *  - UPDATED_AT is set to null because audit log rows are never modified after
 *    creation — altering an audit trail would defeat its purpose.
 *  - created_at is included in $fillable so that the exact event timestamp can
 *    be passed in programmatically (e.g. when the log is created async).
 *  - request_id links all log entries generated during a single HTTP request
 *    together, making it easy to trace a complete transaction in the audit view.
 *  - auditable is a polymorphic relationship pointing to whichever model was
 *    acted upon (a Camper, Application, User, etc.).
 *
 * HIPAA requirement:
 *  - Every read of Protected Health Information (PHI) must be logged with
 *    logPhiAccess(). This satisfies the HIPAA Audit Controls standard (§164.312(b)).
 */
class AuditLog extends Model
{
    // Disable the updated_at timestamp — audit records must never be mutated.
    public const UPDATED_AT = null;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'request_id',      // UUID linking all log entries from one HTTP request.
        'user_id',         // The user who performed the action (null for anonymous/system).
        'event_type',      // High-level category constant (e.g. EVENT_TYPE_PHI_ACCESS).
        'auditable_type',  // Class name of the affected model (polymorphic type).
        'auditable_id',    // Primary key of the affected record (polymorphic id).
        'action',          // Short verb describing what happened (e.g. "login.success").
        'description',     // Optional human-readable sentence explaining the event.
        'old_values',      // JSON snapshot of the record before a change (data_change events).
        'new_values',      // JSON snapshot of the record after a change.
        'metadata',        // Flexible JSON bag for extra context (e.g. session_id, role).
        'ip_address',      // Client IP address — important for security investigations.
        'user_agent',      // Browser/client string — helps identify the device used.
        'created_at',      // Explicit so we can set the exact timestamp programmatically.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * JSON columns are decoded to PHP arrays automatically on read.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_values' => 'array',    // Before-state snapshot decoded to an associative array.
            'new_values' => 'array',    // After-state snapshot decoded to an associative array.
            'metadata' => 'array',    // Flexible context data decoded to an associative array.
            'created_at' => 'datetime',
        ];
    }

    /**
     * Get the user who performed the logged action.
     *
     * Returns null for system-generated events or anonymous actions such as
     * a failed login attempt where no user session exists.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the model instance that was acted upon (polymorphic).
     *
     * morphTo() resolves the class from auditable_type and the record from
     * auditable_id. May return null if the related record has been deleted.
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    // -------------------------------------------------------------------------
    // Event type constants — used as standardised category labels across the app.
    // -------------------------------------------------------------------------

    /** Login, logout, failed login, MFA events. */
    public const EVENT_TYPE_AUTH = 'authentication';

    /** Any read or write of Protected Health Information (HIPAA requirement). */
    public const EVENT_TYPE_PHI_ACCESS = 'phi_access';

    /** Administrative actions such as role changes, user activation/deactivation. */
    public const EVENT_TYPE_ADMIN_ACTION = 'admin_action';

    /** Security alerts: lockouts, suspicious IP, permission denials. */
    public const EVENT_TYPE_SECURITY = 'security';

    /** Create / update / delete events on any data model. */
    public const EVENT_TYPE_DATA_CHANGE = 'data_change';

    /** File upload, download, scan, and verification events. */
    public const EVENT_TYPE_FILE_ACCESS = 'file_access';

    /**
     * Write an authentication event to the audit log.
     *
     * Called by LoginController, LogoutController, and MFA-related controllers.
     * $user may be null for anonymous events (e.g. failed login for unknown email).
     */
    public static function logAuth(string $action, ?User $user, array $metadata = []): self
    {
        return static::create([
            // Use the X-Request-ID header if present, otherwise generate a fresh UUID.
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user?->id,
            'event_type' => static::EVENT_TYPE_AUTH,
            'action' => $action,
            'metadata' => $metadata,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Write a PHI access event to the audit log.
     *
     * Must be called every time any user reads or modifies a camper's health data.
     * $auditable is the model being accessed (e.g. a MedicalRecord or Allergy instance).
     */
    public static function logPhiAccess(string $action, User $user, $auditable, array $metadata = []): self
    {
        return static::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => static::EVENT_TYPE_PHI_ACCESS,
            // Store the full class name so morphTo() can reload the record later.
            'auditable_type' => get_class($auditable),
            'auditable_id' => $auditable->id,
            'action' => $action,
            'metadata' => $metadata,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Write an administrative action event to the audit log.
     *
     * Use this for any admin-only operation that doesn't involve PHI directly
     * (e.g. changing a user's role, toggling a feature flag, bulk-exporting records).
     */
    public static function logAdminAction(string $action, User $user, ?string $description = null, array $metadata = []): self
    {
        return static::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => static::EVENT_TYPE_ADMIN_ACTION,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Write a content-change event to the audit log.
     *
     * Called whenever a user edits application narrative or notes fields.
     * Records a field-level before/after snapshot so the full change history
     * can be reconstructed by compliance auditors.
     *
     * $changedFields is the subset of fields that actually differ between
     * oldValues and newValues — stored in metadata for quick filtering.
     *
     * @param  \Illuminate\Database\Eloquent\Model  $auditable  The record that was modified.
     * @param  User  $editor  The user who made the change.
     * @param  array<string, mixed>  $oldValues  Field snapshot before the change.
     * @param  array<string, mixed>  $newValues  Field snapshot after the change.
     */
    public static function logContentChange(
        \Illuminate\Database\Eloquent\Model $auditable,
        User $editor,
        array $oldValues,
        array $newValues,
    ): self {
        $changedFields = array_keys(array_filter(
            $newValues,
            fn ($v, $k) => ($oldValues[$k] ?? null) !== $v,
            ARRAY_FILTER_USE_BOTH,
        ));

        return static::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $editor->id,
            'event_type' => static::EVENT_TYPE_DATA_CHANGE,
            'auditable_type' => get_class($auditable),
            'auditable_id' => $auditable->getKey(),
            'action' => 'content.edited',
            'description' => 'Application content fields edited by '.$editor->role.' (user #'.$editor->id.').',
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'metadata' => [
                'editor_role' => $editor->role,
                'changed_fields' => $changedFields,
                'field_count' => count($changedFields),
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }
}
