<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Announcement model — system-wide and session-specific notices.
 *
 * Supports pinning, urgency flags, audience targeting, and scheduled publishing.
 */
class Announcement extends Model
{
    protected $fillable = [
        'author_id',
        'title',
        'body',
        'is_pinned',
        'is_urgent',
        'audience',
        'target_session_id',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'is_pinned'    => 'boolean',
            'is_urgent'    => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────────────────────────────────────

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function targetSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'target_session_id');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /** Only published announcements (published_at in the past). */
    public function scopePublished(Builder $query): Builder
    {
        return $query->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /** Pinned first, then most recent. */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderByDesc('is_pinned')->orderByDesc('published_at');
    }

    /** Filter by audience: returns announcements targeting 'all' or the given audience. */
    public function scopeForAudience(Builder $query, string $audience): Builder
    {
        return $query->where(function (Builder $q) use ($audience) {
            $q->where('audience', 'all')->orWhere('audience', $audience);
        });
    }
}
