<?php

namespace App\Services\Medical;

use App\Enums\AllergySeverity;
use App\Enums\DiagnosisSeverity;
use App\Enums\MedicalComplexityTier;
use App\Enums\RiskReviewStatus;
use App\Enums\SupervisionLevel;
use App\Models\Camper;
use App\Models\RiskAssessment;
use App\Models\RiskFactor;
use App\Models\RiskRule;
use App\Models\RiskThreshold;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * SpecialNeedsRiskAssessmentService — Dynamic Medical Risk Scoring Engine
 *
 * Phase 18 refactor: all point values, thresholds, and conditional rules are now
 * loaded from the database (risk_factors, risk_rules, risk_thresholds tables).
 * Medical staff can configure scoring via the Risk Management UI without code changes.
 *
 * Architecture:
 *  - Detection logic stays in PHP (which model fields map to which factors).
 *  - Scoring config (points, thresholds) is in the database.
 *  - Cache: factor/threshold config is cached for 60 minutes to avoid per-request queries.
 *
 * Called by:
 *   RiskAssessmentController → show(), review(), override()
 *   DocumentEnforcementService for compliance checking
 *   Model observers (MedicalRecordObserver, DiagnosisObserver, etc.)
 */
class SpecialNeedsRiskAssessmentService
{
    // Score ceiling — absolute maximum regardless of factors.
    protected const RISK_SCORE_CAP = 100;

    // Cache keys for DB-loaded config (60 min TTL).
    protected const CACHE_FACTORS = 'risk_engine:factors';
    protected const CACHE_THRESHOLDS = 'risk_engine:thresholds';
    protected const CACHE_RULES = 'risk_engine:rules';
    protected const CACHE_TTL = 3600;

    /**
     * Run the full risk assessment for a camper and return a structured result.
     *
     * Single public entry point for all callers.
     *
     * @return array<string, mixed>
     */
    public function assessCamper(Camper $camper): array
    {
        $camper->loadMissing([
            'medicalRecord',
            'feedingPlan',
            'behavioralProfile',
            'assistiveDevices',
            'diagnoses',
            'allergies',
            'activityPermissions',
        ]);

        $factors = $this->loadFactors();
        $factorBreakdown = $this->buildFactorBreakdown($camper, $factors);
        $riskScore = $this->scoreFromBreakdown($factorBreakdown, $camper);
        $supervisionLevel = $this->determineSupervisionLevel($riskScore);
        $complexityTier = $this->determineComplexityTier($riskScore);
        $flags = $this->extractFlags($camper);

        $this->persistSupervisionLevel($camper, $supervisionLevel);
        $assessment = $this->persistRiskAssessment(
            $camper,
            $riskScore,
            $supervisionLevel,
            $complexityTier,
            $flags,
            $factorBreakdown
        );

        return [
            'risk_score' => $riskScore,
            'supervision_level' => $supervisionLevel,
            'medical_complexity_tier' => $complexityTier,
            'flags' => $flags,
            'factor_breakdown' => $factorBreakdown,
            'assessment' => $assessment,
        ];
    }

    /**
     * Load risk factors from DB, cached to avoid per-request queries.
     *
     * @return array<string, array<string, mixed>> Keyed by factor key.
     */
    protected function loadFactors(): array
    {
        return Cache::remember(self::CACHE_FACTORS, self::CACHE_TTL, function () {
            return RiskFactor::where('is_active', true)
                ->orderBy('sort_order')
                ->get()
                ->keyBy('key')
                ->map(fn ($f) => $f->toArray())
                ->toArray();
        });
    }

    /**
     * Load active conditional rules from DB, cached.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function loadRules(): array
    {
        return Cache::remember(self::CACHE_RULES, self::CACHE_TTL, function () {
            return RiskRule::where('is_active', true)
                ->get()
                ->map(fn ($r) => $r->toArray())
                ->toArray();
        });
    }

    /**
     * Load supervision and complexity thresholds from DB, cached.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    protected function loadThresholds(): array
    {
        return Cache::remember(self::CACHE_THRESHOLDS, self::CACHE_TTL, function () {
            $all = RiskThreshold::orderBy('min_score')->get();

            return [
                'supervision' => $all->where('threshold_type', 'supervision')
                    ->values()
                    ->map(fn ($t) => $t->toArray())
                    ->toArray(),
                'complexity' => $all->where('threshold_type', 'complexity')
                    ->values()
                    ->map(fn ($t) => $t->toArray())
                    ->toArray(),
            ];
        });
    }

    /**
     * Build the factor breakdown using DB-loaded point values.
     *
     * Detection logic stays in PHP — the DB supplies the point values and tooltips.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function buildFactorBreakdown(Camper $camper, array $factors): array
    {
        $breakdown = [];

        $mr = $camper->medicalRecord;
        $fp = $camper->feedingPlan;
        $bp = $camper->behavioralProfile;
        $devices = $camper->assistiveDevices;
        $diagnoses = $camper->diagnoses;
        $allergies = $camper->allergies;

        // ── Detection map: key → presence boolean ─────────────────────────────
        $hasLifeThreatening = $allergies->contains(
            fn ($a) => $a->severity === AllergySeverity::LifeThreatening
        );
        $needsTransfer = $devices->contains('requires_transfer_assistance', true);
        $hasCpap = $devices->contains(fn ($d) => stripos((string) $d->device_type, 'cpap') !== false)
                || $devices->contains(fn ($d) => stripos((string) $d->device_type, 'bipap') !== false);

        $severeCount = $diagnoses->filter(fn ($d) => $d->severity_level === DiagnosisSeverity::Severe)->count();
        $moderateCount = $diagnoses->filter(fn ($d) => $d->severity_level === DiagnosisSeverity::Moderate)->count();

        $detectionMap = [
            'seizures' => (bool) ($mr && $mr->has_seizures),
            'neurostimulator' => (bool) ($mr && $mr->has_neurostimulator),
            'life_threatening_allergy' => $hasLifeThreatening,
            'g_tube' => (bool) ($fp && $fp->g_tube),
            'special_diet' => (bool) ($fp && $fp->special_diet),
            'one_to_one_required' => (bool) ($bp && $bp->one_to_one_supervision),
            'wandering_risk' => (bool) ($bp && $bp->wandering_risk),
            'aggression' => (bool) ($bp && $bp->aggression),
            'self_abuse' => (bool) ($bp && $bp->self_abuse),
            'developmental_delay' => (bool) ($bp && $bp->developmental_delay),
            'transfer_assistance' => $needsTransfer,
            'cpap_bipap' => $hasCpap,
            'severe_diagnosis' => $severeCount > 0,
            'moderate_diagnosis' => $moderateCount > 0,
        ];

        // Count map for per_item factors.
        $countMap = [
            'severe_diagnosis' => $severeCount,
            'moderate_diagnosis' => $moderateCount,
        ];

        // Build breakdown from DB factors, preserving display order.
        foreach ($factors as $key => $factor) {
            $present = $detectionMap[$key] ?? false;
            $count = $countMap[$key] ?? 1;

            $entry = [
                'key' => $key,
                'label' => $factor['label'],
                'category' => $factor['category'],
                'points' => (int) $factor['points'],
                'present' => $present,
                'source' => $factor['source_model'] ?? '',
                'tooltip' => $factor['tooltip'] ?? '',
            ];

            if ($factor['per_item']) {
                $entry['count'] = $count;
                $entry['per_item'] = true;
                $entry['label'] = $factor['label'].' ('.$count.' on file)';
            }

            $breakdown[] = $entry;
        }

        return $breakdown;
    }

    /**
     * Calculate the total risk score from a factor breakdown.
     *
     * Also applies any active conditional rules that fire based on detected factors.
     */
    public function scoreFromBreakdown(array $factors, ?Camper $camper = null): int
    {
        $score = 0;

        foreach ($factors as $factor) {
            if (! $factor['present']) {
                continue;
            }

            $points = (int) ($factor['points'] ?? 0);
            $isPerItem = $factor['per_item'] ?? false;
            $count = $isPerItem ? ($factor['count'] ?? 1) : 1;
            $score += $points * $count;
        }

        // Apply conditional rule bonuses.
        $detectedKeys = array_column(
            array_filter($factors, fn ($f) => $f['present']),
            'key'
        );
        $score += $this->applyConditionalRules($detectedKeys);

        return min($score, self::RISK_SCORE_CAP);
    }

    /**
     * Evaluate all active conditional rules and return total bonus points.
     */
    protected function applyConditionalRules(array $detectedKeys): int
    {
        $rules = $this->loadRules();
        $bonus = 0;

        foreach ($rules as $ruleData) {
            // Evaluate conditions from raw array data.
            $matched = true;
            foreach ($ruleData['conditions'] as $condition) {
                $key = $condition['factor_key'] ?? null;
                $mustBePresent = $condition['present'] ?? true;
                $isPresent = in_array($key, $detectedKeys, true);

                if ($mustBePresent !== $isPresent) {
                    $matched = false;
                    break;
                }
            }

            if ($matched) {
                $bonus += (int) ($ruleData['points_adjustment'] ?? 0);
            }
        }

        return $bonus;
    }

    /**
     * Map a numeric risk score to a SupervisionLevel using DB thresholds.
     */
    public function determineSupervisionLevel(int $score): SupervisionLevel
    {
        $thresholds = $this->loadThresholds()['supervision'];

        return $this->resolveLevel($score, $thresholds, SupervisionLevel::Standard, function ($levelValue) {
            return SupervisionLevel::from($levelValue);
        });
    }

    /**
     * Map a numeric risk score to a MedicalComplexityTier using DB thresholds.
     */
    public function determineComplexityTier(int $score): MedicalComplexityTier
    {
        $thresholds = $this->loadThresholds()['complexity'];

        return $this->resolveLevel($score, $thresholds, MedicalComplexityTier::Low, function ($levelValue) {
            return MedicalComplexityTier::from($levelValue);
        });
    }

    /**
     * Generic threshold resolver: finds the level whose range covers the given score.
     */
    protected function resolveLevel(int $score, array $thresholds, mixed $default, callable $factory): mixed
    {
        $match = $default;

        foreach ($thresholds as $threshold) {
            $min = (int) $threshold['min_score'];
            // isset() already returns false when the key is unset OR the value
            // is null, so a second !== null check is redundant.
            $max = isset($threshold['max_score'])
                ? (int) $threshold['max_score']
                : PHP_INT_MAX;

            if ($score >= $min && $score <= $max) {
                try {
                    $match = $factory($threshold['level_value']);
                } catch (\ValueError) {
                    // If DB has an unknown enum value, fall through to default.
                }
                break;
            }

            // Keep tracking the last matched min so "above all ranges" resolves to highest.
            if ($score >= $min) {
                try {
                    $match = $factory($threshold['level_value']);
                } catch (\ValueError) {
                    // ignore
                }
            }
        }

        return $match;
    }

    /**
     * Legacy entry point: calculate numeric score directly from camper data.
     * Kept for backward compatibility with DocumentEnforcementService and tests.
     */
    public function calculateRiskScore(Camper $camper): int
    {
        $camper->loadMissing([
            'medicalRecord',
            'feedingPlan',
            'behavioralProfile',
            'assistiveDevices',
            'diagnoses',
            'allergies',
        ]);

        $factors = $this->loadFactors();

        return $this->scoreFromBreakdown($this->buildFactorBreakdown($camper, $factors), $camper);
    }

    /**
     * Build a plain list of active risk flag identifiers.
     */
    public function extractFlags(Camper $camper): array
    {
        $flags = [];

        $mr = $camper->medicalRecord;
        if ($mr) {
            if ($mr->has_seizures) {
                $flags[] = 'seizures';
            }
            if ($mr->has_neurostimulator) {
                $flags[] = 'neurostimulator';
            }
        }

        if ($camper->allergies->contains(fn ($a) => $a->severity === AllergySeverity::LifeThreatening)) {
            $flags[] = 'life_threatening_allergy';
        }

        $fp = $camper->feedingPlan;
        if ($fp) {
            if ($fp->g_tube) {
                $flags[] = 'g_tube';
            }
            if ($fp->special_diet) {
                $flags[] = 'special_diet';
            }
        }

        $bp = $camper->behavioralProfile;
        if ($bp) {
            if ($bp->wandering_risk) {
                $flags[] = 'wandering_risk';
            }
            if ($bp->aggression) {
                $flags[] = 'aggression';
            }
            if ($bp->self_abuse) {
                $flags[] = 'self_abuse';
            }
            if ($bp->one_to_one_supervision) {
                $flags[] = 'one_to_one_required';
            }
            if ($bp->developmental_delay) {
                $flags[] = 'developmental_delay';
            }
        }

        $devices = $camper->assistiveDevices;
        if ($devices->isNotEmpty()) {
            $flags[] = 'assistive_devices';

            if ($devices->contains('requires_transfer_assistance', true)) {
                $flags[] = 'transfer_assistance';
            }

            $hasCpap = $devices->contains(fn ($d) => stripos((string) $d->device_type, 'cpap') !== false)
                    || $devices->contains(fn ($d) => stripos((string) $d->device_type, 'bipap') !== false);
            if ($hasCpap) {
                $flags[] = 'cpap';
            }
        }

        $hasSevere = $camper->diagnoses->contains(fn ($d) => $d->severity_level === DiagnosisSeverity::Severe);
        if ($hasSevere) {
            $flags[] = 'severe_diagnosis';
        }

        return $flags;
    }

    /** Invalidate the risk engine cache — called when medical staff update factors or thresholds. */
    public static function invalidateCache(): void
    {
        Cache::forget(self::CACHE_FACTORS);
        Cache::forget(self::CACHE_THRESHOLDS);
        Cache::forget(self::CACHE_RULES);
    }

    // ── Persistence (unchanged from Phase 16) ───────────────────────────────────

    public function persistSupervisionLevel(Camper $camper, SupervisionLevel $level): void
    {
        if ($camper->supervision_level !== $level) {
            $camper->supervision_level = $level;
            $camper->saveQuietly();
        }
    }

    protected function persistRiskAssessment(
        Camper $camper,
        int $riskScore,
        SupervisionLevel $supervisionLevel,
        MedicalComplexityTier $complexityTier,
        array $flags,
        array $factorBreakdown
    ): RiskAssessment {
        return DB::transaction(function () use (
            $camper, $riskScore, $supervisionLevel, $complexityTier, $flags, $factorBreakdown
        ) {
            $current = RiskAssessment::where('camper_id', $camper->id)
                ->where('is_current', true)
                ->first();

            $now = now();

            if (! $current) {
                return RiskAssessment::create([
                    'camper_id' => $camper->id,
                    'calculated_at' => $now,
                    'risk_score' => $riskScore,
                    'supervision_level' => $supervisionLevel,
                    'medical_complexity_tier' => $complexityTier,
                    'flags' => $flags,
                    'factor_breakdown' => $factorBreakdown,
                    'is_current' => true,
                    'review_status' => RiskReviewStatus::SystemCalculated,
                ]);
            }

            $scoreDelta = abs($current->risk_score - $riskScore);

            if ($scoreDelta === 0) {
                $current->calculated_at = $now;
                $current->factor_breakdown = $factorBreakdown;
                $current->save();

                return $current;
            }

            if ($scoreDelta <= RiskAssessment::SCORE_CHANGE_THRESHOLD) {
                $current->calculated_at = $now;
                $current->risk_score = $riskScore;
                $current->supervision_level = $supervisionLevel;
                $current->medical_complexity_tier = $complexityTier;
                $current->flags = $flags;
                $current->factor_breakdown = $factorBreakdown;
                $current->save();

                return $current;
            }

            $current->is_current = false;
            $current->save();

            return RiskAssessment::create([
                'camper_id' => $camper->id,
                'calculated_at' => $now,
                'risk_score' => $riskScore,
                'supervision_level' => $supervisionLevel,
                'medical_complexity_tier' => $complexityTier,
                'flags' => $flags,
                'factor_breakdown' => $factorBreakdown,
                'is_current' => true,
                'review_status' => RiskReviewStatus::SystemCalculated,
                'clinical_notes' => $current->clinical_notes,
            ]);
        });
    }
}
