<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * CalendarEvent model — camp deadlines, sessions, orientations, and internal events.
 */
class CalendarEvent extends Model
{
    protected $fillable = [
        'created_by',
        'title',
        'description',
        'event_type',
        'color',
        'starts_at',
        'ends_at',
        'all_day',
        'audience',
        'target_session_id',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at'   => 'datetime',
            'all_day'   => 'boolean',
        ];
    }

    public const TYPES = ['deadline', 'session', 'orientation', 'staff', 'internal'];

    // ──────────────────────────────────────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────────────────────────────────────

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function targetSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'target_session_id');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /** Events starting on or after the given date. */
    public function scopeUpcoming(Builder $query, ?string $from = null): Builder
    {
        return $query->where('starts_at', '>=', $from ?? now()->startOfDay());
    }

    /** Events within a date range (for month/week view). */
    public function scopeInRange(Builder $query, string $start, string $end): Builder
    {
        return $query->where('starts_at', '>=', $start)
            ->where('starts_at', '<=', $end);
    }

    /** Filter by audience. */
    public function scopeForAudience(Builder $query, string $audience): Builder
    {
        return $query->where(function (Builder $q) use ($audience) {
            $q->where('audience', 'all')->orWhere('audience', $audience);
        });
    }
}
