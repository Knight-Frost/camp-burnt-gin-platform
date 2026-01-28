<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * MedicalProviderLink model for secure provider access tokens.
 *
 * Represents a time-limited, single-use link that allows medical providers
 * to access and complete designated medical fields for a camper.
 */
class MedicalProviderLink extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'created_by',
        'token',
        'provider_email',
        'provider_name',
        'expires_at',
        'accessed_at',
        'submitted_at',
        'revoked_at',
        'revoked_by',
        'is_used',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accessed_at' => 'datetime',
            'submitted_at' => 'datetime',
            'revoked_at' => 'datetime',
            'is_used' => 'boolean',
        ];
    }

    /**
     * Default link expiration in hours.
     */
    public const DEFAULT_EXPIRATION_HOURS = 72;

    /**
     * Generate a secure random token.
     */
    public static function generateToken(): string
    {
        return Str::random(64);
    }

    /**
     * Get the camper this link provides access to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the user who created this link.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who revoked this link.
     */
    public function revoker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    /**
     * Check if the link is currently valid.
     */
    public function isValid(): bool
    {
        return !$this->is_used
            && !$this->isRevoked()
            && !$this->isExpired();
    }

    /**
     * Check if the link has been revoked.
     */
    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    /**
     * Check if the link has expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if the link has been submitted.
     */
    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    /**
     * Mark the link as accessed.
     */
    public function markAsAccessed(): void
    {
        if (!$this->accessed_at) {
            $this->update(['accessed_at' => now()]);
        }
    }

    /**
     * Mark the link as used after form submission.
     */
    public function markAsUsed(): void
    {
        $this->update([
            'is_used' => true,
            'submitted_at' => now(),
        ]);
    }

    /**
     * Revoke this link.
     */
    public function revoke(User $user): void
    {
        $this->update([
            'revoked_at' => now(),
            'revoked_by' => $user->id,
        ]);
    }

    /**
     * Scope to filter only valid (unexpired, unrevoked, unused) links.
     */
    public function scopeValid($query)
    {
        return $query->where('is_used', false)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now());
    }
}
