<?php

namespace App\Models;

use App\Enums\MedicalComplexityTier;
use App\Enums\RiskReviewStatus;
use App\Enums\SupervisionLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * RiskAssessment — persistent record of a camper risk evaluation.
 *
 * Each time the scoring engine runs for a camper, it either creates a new assessment
 * (if the score changed) or updates the timestamp on the existing current record.
 * Medical staff add review state (clinical notes, validation, or override) to the
 * current record — that state survives future recalculations unless the score shifts
 * by more than SCORE_CHANGE_THRESHOLD points, at which point it is reset to prompt
 * a fresh review.
 *
 * PHI note: clinical_notes and override_reason may contain clinical observations
 * about the camper. They are stored encrypted at the database level.
 *
 * Relationships:
 *   camper()          — the assessed camper
 *   reviewer()        — medical/admin user who validated the assessment
 *   overriddenByUser() — medical/admin user who applied a supervision override
 */
class RiskAssessment extends Model
{
    use HasFactory, SoftDeletes;
    /**
     * Score delta (points) that triggers a review-status reset.
     *
     * If a recalculation changes the risk score by more than this amount, any existing
     * clinical review is considered potentially stale and the status resets to
     * 'system_calculated' to prompt a fresh review from medical staff.
     */
    public const SCORE_CHANGE_THRESHOLD = 5;

    protected $fillable = [
        'camper_id',
        'calculated_at',
        'risk_score',
        'supervision_level',
        'medical_complexity_tier',
        'flags',
        'factor_breakdown',
        'is_current',
        'review_status',
        'reviewed_by',
        'reviewed_at',
        'clinical_notes',
        'override_supervision_level',
        'override_reason',
        'overridden_by',
        'overridden_at',
        'staff_recommendations',
    ];

    protected $casts = [
        'calculated_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'overridden_at' => 'datetime',
        'risk_score' => 'integer',
        'is_current' => 'boolean',
        'flags' => 'array',
        'factor_breakdown' => 'array',
        'supervision_level' => SupervisionLevel::class,
        'medical_complexity_tier' => MedicalComplexityTier::class,
        'review_status' => RiskReviewStatus::class,
        'override_supervision_level' => SupervisionLevel::class,
        'clinical_notes' => 'encrypted',
        'override_reason' => 'encrypted',
        'staff_recommendations' => 'array',
    ];

    // ── Relationships ────────────────────────────────────────────────────────

    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function overriddenByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'overridden_by');
    }

    // ── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Limit to the current (most recent) assessment per camper.
     */
    public function scopeCurrent($query)
    {
        return $query->where('is_current', true);
    }

    // ── Computed helpers ─────────────────────────────────────────────────────

    /**
     * The supervision level that staff should actually use.
     *
     * If a clinician has overridden the system calculation, the override takes
     * precedence. Otherwise the system-calculated level applies.
     */
    public function effectiveSupervisionLevel(): SupervisionLevel
    {
        if ($this->review_status === RiskReviewStatus::Overridden && $this->override_supervision_level) {
            return $this->override_supervision_level;
        }

        return $this->supervision_level;
    }

    /**
     * Whether the effective supervision level differs from the system calculation.
     */
    public function isOverridden(): bool
    {
        return $this->review_status === RiskReviewStatus::Overridden
            && $this->override_supervision_level !== null
            && $this->override_supervision_level !== $this->supervision_level;
    }

    /**
     * Risk level label derived from the medical complexity tier.
     *
     * The complexity tier is DB-configured (via risk_thresholds), so this label
     * automatically reflects whatever thresholds the medical director has set —
     * no hardcoded score values. Low / Moderate / High map 1:1 to the three tiers.
     */
    public function riskLevelLabel(): string
    {
        return match ($this->medical_complexity_tier) {
            MedicalComplexityTier::High     => 'High',
            MedicalComplexityTier::Moderate => 'Moderate',
            default                         => 'Low',
        };
    }

    /**
     * Semantic colour key for the risk level.
     *
     * Derived from the DB-configured complexity tier rather than hardcoded score
     * thresholds so that gauge zone colours stay aligned with configured boundaries.
     */
    public function riskLevelColor(): string
    {
        return match ($this->medical_complexity_tier) {
            MedicalComplexityTier::High     => 'high',
            MedicalComplexityTier::Moderate => 'moderate',
            default                         => 'low',
        };
    }
}
