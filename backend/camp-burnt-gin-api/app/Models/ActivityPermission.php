<?php

namespace App\Models;

use App\Enums\ActivityPermissionLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ActivityPermission model representing participation restrictions for activities.
 *
 * Each permission tracks whether a camper can participate in a specific
 * camp activity, with documentation of any restrictions or accommodations
 * required for safe participation.
 */
class ActivityPermission extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'activity_name',
        'permission_level',
        'restriction_notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'permission_level' => ActivityPermissionLevel::class,
        ];
    }

    /**
     * Get the camper this activity permission belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this activity is fully permitted.
     */
    public function isPermitted(): bool
    {
        return $this->permission_level === ActivityPermissionLevel::Yes;
    }

    /**
     * Determine if this activity is not permitted.
     */
    public function isNotPermitted(): bool
    {
        return $this->permission_level === ActivityPermissionLevel::No;
    }

    /**
     * Determine if this activity has restrictions.
     */
    public function hasRestrictions(): bool
    {
        return $this->permission_level === ActivityPermissionLevel::Restricted;
    }

    /**
     * Determine if restriction notes are required for this permission.
     *
     * Restricted activities must document specific limitations or
     * accommodations required for safe participation.
     */
    public function requiresRestrictionNotes(): bool
    {
        return $this->permission_level->requiresNotes();
    }
}
