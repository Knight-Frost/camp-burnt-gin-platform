<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * MedicalProviderLink model — secure, time-limited access links sent to external medical providers.
 *
 * When a camp admin needs a doctor or nurse outside the system to fill in medical information
 * for a camper, they create a MedicalProviderLink. The link is emailed to the provider with a
 * unique 64-character random token embedded in a URL. The provider clicks the link, fills the
 * form, and the link is automatically marked as used so it cannot be submitted again.
 *
 * Security design:
 *   - The token is hashed with bcrypt before being stored in the database. Even if someone
 *     reads the database directly, they cannot reconstruct the original URL.
 *   - The "token" column is hidden from API serialization to prevent accidental exposure.
 *   - Links expire after DEFAULT_EXPIRATION_HOURS (72 h) and can be revoked by an admin.
 *
 * Lifecycle: created → [emailed] → accessed → submitted (is_used = true)
 *                                           OR revoked (revoked_at set)
 *                                           OR expired (expires_at in past)
 *
 * Relationships:
 *   - belongs to Camper
 *   - belongs to User (creator via created_by)
 *   - belongs to User (revoker via revoked_by)
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
     * Fields hidden from JSON serialization.
     *
     * Even though the token is already hashed, exposing hashed tokens in API responses
     * could allow timing-based enumeration attacks — so we hide it entirely.
     *
     * @var list<string>
     */
    protected $hidden = [
        // Hashed token — never expose in API responses even though it's a bcrypt hash
        'token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * All timestamps are cast to Carbon for readable comparisons like ->isPast().
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
     * Default link lifetime in hours (3 days).
     *
     * After this window the link is considered expired and access is refused,
     * even if the provider has not yet submitted the form.
     */
    public const DEFAULT_EXPIRATION_HOURS = 72;

    // ──────────────────────────────────────────────────────────────────────────
    // Static Token Utilities
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Generate a cryptographically random 64-character token.
     *
     * This plain-text token is what gets embedded in the email URL. It is NEVER
     * stored in the database — only its bcrypt hash is stored.
     */
    public static function generateToken(): string
    {
        return Str::random(64);
    }

    /**
     * Hash a plain-text token for safe database storage using bcrypt.
     *
     * Uses Laravel's Hash facade which applies bcrypt with an appropriate cost factor.
     */
    public static function hashToken(string $token): string
    {
        return Hash::make($token);
    }

    /**
     * Verify a plain-text token against a stored bcrypt hash.
     *
     * Used during form access to confirm the URL token matches the stored hash
     * without revealing the original token value.
     */
    public static function verifyToken(string $plainToken, string $hashedToken): bool
    {
        return Hash::check($plainToken, $hashedToken);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper whose medical record this link grants access to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the admin user who generated this provider link.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the admin user who revoked this link (if revoked).
     */
    public function revoker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // State Checks
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Check if the link is currently valid for use.
     *
     * All three conditions must be true: not yet used, not revoked, not expired.
     */
    public function isValid(): bool
    {
        return ! $this->is_used
            && ! $this->isRevoked()
            && ! $this->isExpired();
    }

    /**
     * Check if an admin has manually revoked this link.
     *
     * A non-null revoked_at timestamp means revocation has occurred.
     */
    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    /**
     * Check if the link's time window has passed.
     *
     * isPast() returns true if expires_at is earlier than the current moment.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Check if the provider has already submitted the medical form via this link.
     */
    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // State Mutations
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Record the first time the provider clicked the link (opened the form page).
     *
     * Only records the first access; subsequent page views do not overwrite the timestamp.
     */
    public function markAsAccessed(): void
    {
        // Guard prevents overwriting the original access timestamp on repeat visits
        if (! $this->accessed_at) {
            $this->update(['accessed_at' => now()]);
        }
    }

    /**
     * Mark the link as fully used after the provider submits the medical form.
     *
     * Once is_used is true, the link is permanently invalid regardless of expiry.
     */
    public function markAsUsed(): void
    {
        $this->update([
            'is_used' => true,
            'submitted_at' => now(),
        ]);
    }

    /**
     * Revoke this link, recording which admin performed the action.
     *
     * Revoked links immediately become invalid; the provider will receive a
     * "revoked" error message if they try to use the URL afterward.
     */
    public function revoke(User $user): void
    {
        $this->update([
            'revoked_at' => now(),
            'revoked_by' => $user->id,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Scope: filter to only links that are currently active and usable.
     *
     * Matches the three conditions in isValid() but as a database-level query
     * so it can be combined efficiently with other where clauses.
     */
    public function scopeValid($query)
    {
        return $query->where('is_used', false)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now());
    }
}
