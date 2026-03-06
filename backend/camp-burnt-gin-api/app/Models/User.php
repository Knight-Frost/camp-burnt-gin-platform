<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User model representing an authenticated user within the system.
 *
 * Users are assigned roles that determine their access level and
 * permissions. Common roles include administrators, staff members,
 * and applicants (parents or guardians of campers).
 */
class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'mfa_enabled',
        'mfa_secret',
        'mfa_verified_at',
        'failed_login_attempts',
        'lockout_until',
        'last_failed_login_at',
        'notification_preferences',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'mfa_secret',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'mfa_enabled' => 'boolean',
            'mfa_verified_at' => 'datetime',
            'lockout_until' => 'datetime',
            'last_failed_login_at' => 'datetime',
            'notification_preferences' => 'array',
        ];
    }

    /**
     * Boot the model and apply event listeners.
     *
     * Prevents deletion of the last super administrator to avoid system lockout.
     */
    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($user) {
            // Prevent deletion of the last super administrator
            if ($user->isSuperAdmin()) {
                $superAdminCount = static::whereHas('role', function ($query) {
                    $query->where('name', 'super_admin');
                })->count();

                if ($superAdminCount <= 1) {
                    throw new \Exception('Cannot delete the last super administrator. At least one super administrator must exist in the system.');
                }
            }
        });
    }

    /**
     * Get the role assigned to this user.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Get all campers managed by this user.
     */
    public function campers(): HasMany
    {
        return $this->hasMany(Camper::class);
    }

    /**
     * Get all applications reviewed by this user.
     */
    public function reviewedApplications(): HasMany
    {
        return $this->hasMany(Application::class, 'reviewed_by');
    }

    /**
     * Determine if the user has a specific role by name.
     */
    public function hasRole(string $roleName): bool
    {
        return $this->role !== null && $this->role->name === $roleName;
    }

    /**
     * Determine if the user is a super administrator.
     *
     * Super administrators have absolute system authority and can manage
     * system-level configurations, feature flags, and role assignments.
     */
    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    /**
     * Determine if the user is an administrator.
     *
     * This includes both regular administrators and super administrators.
     * Super administrators inherit all admin privileges.
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin') || $this->hasRole('super_admin');
    }

    /**
     * Determine if the user is an applicant (parent or guardian of a camper).
     */
    public function isApplicant(): bool
    {
        return $this->hasRole('applicant');
    }

    /**
     * Determine if the user is a medical provider.
     */
    public function isMedicalProvider(): bool
    {
        return $this->hasRole('medical');
    }

    /**
     * Determine if the user owns (manages) the given camper.
     */
    public function ownsCamper(Camper $camper): bool
    {
        return $this->id === $camper->user_id;
    }

    /**
     * Check if account is currently locked due to failed login attempts.
     */
    public function isLockedOut(): bool
    {
        if (! $this->lockout_until) {
            return false;
        }

        if ($this->lockout_until->isFuture()) {
            return true;
        }

        $this->update([
            'lockout_until' => null,
            'failed_login_attempts' => 0,
        ]);

        return false;
    }

    /**
     * Increment failed login attempts and lock account if threshold reached.
     */
    public function recordFailedLogin(): void
    {
        $attempts = $this->failed_login_attempts + 1;
        $lockoutMinutes = 5;

        $data = [
            'failed_login_attempts' => $attempts,
            'last_failed_login_at' => now(),
        ];

        if ($attempts >= 5) {
            $data['lockout_until'] = now()->addMinutes($lockoutMinutes);
        }

        $this->update($data);
    }

    /**
     * Reset failed login attempts after successful login.
     */
    public function resetFailedLogins(): void
    {
        $this->update([
            'failed_login_attempts' => 0,
            'lockout_until' => null,
            'last_failed_login_at' => null,
        ]);
    }

    /**
     * Get minutes remaining until account lockout expires.
     */
    public function getLockoutMinutesRemaining(): ?int
    {
        if (! $this->lockout_until || $this->lockout_until->isPast()) {
            return null;
        }

        return now()->diffInMinutes($this->lockout_until, false);
    }
}
