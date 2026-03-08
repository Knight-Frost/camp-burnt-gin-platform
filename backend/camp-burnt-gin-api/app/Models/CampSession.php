<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * CampSession model — a specific, scheduled run of a Camp program.
 *
 * While Camp is the program (e.g. "Burnt Gin Summer Camp"), a CampSession is a
 * concrete occurrence with real dates and limits (e.g. "Session A — June 9-15, 2026").
 * Parents browse sessions, pick one, and submit an Application for their camper.
 *
 * Key session constraints:
 *  - capacity      : Maximum number of enrolled campers.
 *  - min_age/max_age: Age window checked at session start_date via Camper::ageAsOf().
 *  - registration_opens_at / registration_closes_at: The window when applicants can apply.
 *  - is_active: Admins can take a session off the portal without deleting it.
 */
class CampSession extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camp_id',                  // The parent Camp this session belongs to.
        'name',                     // Human-readable label (e.g. "Session A").
        'start_date',               // First day of the session.
        'end_date',                 // Last day of the session.
        'capacity',                 // Total spots available.
        'min_age',                  // Minimum camper age (inclusive) at session start.
        'max_age',                  // Maximum camper age (inclusive) at session start.
        'registration_opens_at',    // Date/time applications begin being accepted.
        'registration_closes_at',   // Date/time after which no new applications are accepted.
        'is_active',                // Controls whether the session shows in the portal.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Carbon date objects for start/end enable easy duration and overlap checks.
            'start_date'              => 'date',
            'end_date'                => 'date',
            // Integer casts ensure arithmetic (e.g. capacity - enrolled) works correctly.
            'capacity'                => 'integer',
            'min_age'                 => 'integer',
            'max_age'                 => 'integer',
            // Full datetime objects for the registration window (includes time-of-day).
            'registration_opens_at'   => 'datetime',
            'registration_closes_at'  => 'datetime',
            'is_active'               => 'boolean',
        ];
    }

    /**
     * Get the Camp program this session is an instance of.
     */
    public function camp(): BelongsTo
    {
        return $this->belongsTo(Camp::class);
    }

    /**
     * Get all applications submitted for this session.
     *
     * Applications across all status values (draft, submitted, approved, etc.)
     * are returned here. Filter by status using Application scopes as needed.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }
}
