<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Audit Log model for tracking security and compliance events.
 *
 * Captures all PHI access, administrative actions, and security events
 * for HIPAA compliance and security monitoring.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'request_id',
        'user_id',
        'event_type',
        'auditable_type',
        'auditable_id',
        'action',
        'description',
        'old_values',
        'new_values',
        'metadata',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Get the user who performed the action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the parent auditable model.
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Event types for categorization and filtering.
     */
    public const EVENT_TYPE_AUTH = 'authentication';

    public const EVENT_TYPE_PHI_ACCESS = 'phi_access';

    public const EVENT_TYPE_ADMIN_ACTION = 'admin_action';

    public const EVENT_TYPE_SECURITY = 'security';

    public const EVENT_TYPE_DATA_CHANGE = 'data_change';

    public const EVENT_TYPE_FILE_ACCESS = 'file_access';

    /**
     * Log an authentication event.
     */
    public static function logAuth(string $action, ?User $user, array $metadata = []): self
    {
        return static::create([
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
     * Log PHI access event.
     */
    public static function logPhiAccess(string $action, User $user, $auditable, array $metadata = []): self
    {
        return static::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => static::EVENT_TYPE_PHI_ACCESS,
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
     * Log administrative action.
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
}
