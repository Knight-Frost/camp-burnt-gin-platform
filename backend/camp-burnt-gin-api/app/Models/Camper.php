<?php

namespace App\Models;

use App\Enums\SupervisionLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Camper model representing a child who attends camp programs.
 *
 * Campers are managed by users (parents or guardians) and can have
 * multiple applications submitted for different camp sessions.
 *
 * HIPAA COMPLIANCE NOTE:
 * This model uses soft deletes to maintain audit trail and record retention
 * requirements. Camper records are never physically deleted from the database,
 * ensuring compliance with medical record retention regulations.
 */
class Camper extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'date_of_birth',
        'gender',
        'supervision_level',
        'record_retention_until',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'supervision_level' => SupervisionLevel::class,
            'record_retention_until' => 'date',
        ];
    }

    /**
     * Get the user (parent/guardian) who manages this camper.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all applications submitted for this camper.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Get the camper's full name.
     */
    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Calculate the camper's age as of a given date.
     */
    public function ageAsOf(\DateTimeInterface $date): int
    {
        return $this->date_of_birth->diffInYears($date);
    }

    /**
     * Get the medical record for this camper.
     */
    public function medicalRecord(): HasOne
    {
        return $this->hasOne(MedicalRecord::class);
    }

    /**
     * Get all emergency contacts for this camper.
     */
    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(EmergencyContact::class);
    }

    /**
     * Get all allergies for this camper.
     */
    public function allergies(): HasMany
    {
        return $this->hasMany(Allergy::class);
    }

    /**
     * Get all medications for this camper.
     */
    public function medications(): HasMany
    {
        return $this->hasMany(Medication::class);
    }

    /**
     * Get all medical provider links for this camper.
     */
    public function medicalProviderLinks(): HasMany
    {
        return $this->hasMany(MedicalProviderLink::class);
    }

    /**
     * Get all diagnoses for this camper.
     */
    public function diagnoses(): HasMany
    {
        return $this->hasMany(Diagnosis::class);
    }

    /**
     * Get the behavioral profile for this camper.
     */
    public function behavioralProfile(): HasOne
    {
        return $this->hasOne(BehavioralProfile::class);
    }

    /**
     * Get the feeding plan for this camper.
     */
    public function feedingPlan(): HasOne
    {
        return $this->hasOne(FeedingPlan::class);
    }

    /**
     * Get all assistive devices for this camper.
     */
    public function assistiveDevices(): HasMany
    {
        return $this->hasMany(AssistiveDevice::class);
    }

    /**
     * Get all activity permissions for this camper.
     */
    public function activityPermissions(): HasMany
    {
        return $this->hasMany(ActivityPermission::class);
    }

    /**
     * Determine if this camper has any allergies requiring immediate attention.
     *
     * Returns true if any allergy is classified as severe or life-threatening.
     *
     * PERFORMANCE: Uses relationship collection if already loaded to avoid N+1 queries.
     * Callers should eager load allergies: Camper::with('allergies')->get()
     */
    public function requiresImmediateAttention(): bool
    {
        // Use loaded relationship if available to prevent N+1 query
        $allergies = $this->relationLoaded('allergies')
            ? $this->allergies
            : $this->allergies()->get();

        return $allergies->contains(
            fn ($allergy) => $allergy->requiresImmediateAttention()
        );
    }
}
