<?php

namespace App\Services\Medical;

use App\Enums\DiagnosisSeverity;
use App\Enums\MedicalComplexityTier;
use App\Enums\SupervisionLevel;
use App\Models\Camper;

/**
 * SpecialNeedsRiskAssessmentService — Medical Risk Scoring and Supervision Planning
 *
 * This service calculates a numeric risk score (0–100) for each camper based
 * on their medical conditions, behavioral profile, and physical support needs.
 * The score drives two important decisions:
 *
 *  1. SupervisionLevel — determines the staff-to-camper ratio:
 *       Standard  (score  0–20): 1 staff to 6 campers (typical camp ratio)
 *       Enhanced  (score 21–40): 1 staff to 3 campers (increased supervision)
 *       OneToOne  (score   41+): 1 dedicated staff member per camper
 *
 *  2. MedicalComplexityTier — categorises overall medical care requirements:
 *       Low       (score  0–25): Minimal medical intervention needed
 *       Moderate  (score 26–50): Regular monitoring and medical support
 *       High      (score   51+): Intensive care and specialised staffing
 *
 * Risk factors and their point values are defined as class constants so
 * they can be reviewed and adjusted without changing the algorithm itself.
 *
 * The calculated supervision level is persisted back to the camper record
 * (quietly, to avoid triggering observer loops). Scores above 100 are capped.
 *
 * Called by: CamperController -> riskSummary() endpoint
 *            DocumentEnforcementService for compliance checking
 */
class SpecialNeedsRiskAssessmentService
{
    // ── Risk score point values ──────────────────────────────────────────────
    // Each constant represents how many risk points a specific condition adds.
    // Higher numbers = more complex support need.

    /** Seizure history — high risk requiring an action plan */
    protected const RISK_SEIZURES = 20;

    /** G-tube (gastrostomy tube) feeding — requires trained staff */
    protected const RISK_G_TUBE = 20;

    /** Wandering risk — requires constant physical proximity */
    protected const RISK_WANDERING = 15;

    /** History of aggression — requires intervention-trained staff */
    protected const RISK_AGGRESSION = 15;

    /** Behavioural profile explicitly requires one-to-one supervision */
    protected const RISK_ONE_TO_ONE = 30;

    /** Physical transfer assistance required for mobility devices */
    protected const RISK_TRANSFER_ASSISTANCE = 10;

    /** Developmental delay — requires adapted programming */
    protected const RISK_DEVELOPMENTAL_DELAY = 10;

    /** Severe diagnosis on file */
    protected const RISK_DIAGNOSIS_SEVERE = 5;

    /** Moderate diagnosis on file */
    protected const RISK_DIAGNOSIS_MODERATE = 3;

    // ── Score ceiling ────────────────────────────────────────────────────────
    /** Scores are capped at 100 regardless of how many conditions are present */
    protected const RISK_SCORE_CAP = 100;

    // ── Supervision thresholds ───────────────────────────────────────────────
    /** Scores at or below this value → Standard supervision */
    protected const SUPERVISION_STANDARD_MAX = 20;

    /** Scores at or below this value (but above STANDARD_MAX) → Enhanced supervision */
    protected const SUPERVISION_ENHANCED_MAX = 40;

    // ── Complexity tier thresholds ───────────────────────────────────────────
    /** Scores at or below this value → Low complexity tier */
    protected const COMPLEXITY_LOW_MAX = 25;

    /** Scores at or below this value (but above LOW_MAX) → Moderate complexity tier */
    protected const COMPLEXITY_MODERATE_MAX = 50;

    /**
     * Run the full risk assessment for a camper and return a structured result.
     *
     * This is the public entry point. It:
     *  1. Eagerly loads all relationships to avoid N+1 queries
     *  2. Calculates the numeric risk score
     *  3. Determines the supervision level and complexity tier from the score
     *  4. Extracts a plain-English list of active risk flags
     *  5. Persists the supervision level to the camper record (only if changed)
     *
     * PERFORMANCE: All required relationships are loaded in one loadMissing() call
     * to prevent multiple database round-trips.
     *
     * @param  Camper  $camper  The camper to assess
     * @return array<string, mixed>  risk_score, supervision_level, medical_complexity_tier, flags
     */
    public function assessCamper(Camper $camper): array
    {
        // Load all relationships needed for assessment in a single call to prevent N+1 queries
        $camper->loadMissing([
            'medicalRecord',
            'feedingPlan',
            'behavioralProfile',
            'assistiveDevices',
            'diagnoses',
            'allergies',
            'activityPermissions',
        ]);

        $riskScore = $this->calculateRiskScore($camper);
        $supervisionLevel = $this->determineSupervisionLevel($riskScore);
        $complexityTier = $this->determineComplexityTier($riskScore);
        $flags = $this->extractFlags($camper);

        // Write supervision level back to the database if it has changed
        $this->persistSupervisionLevel($camper, $supervisionLevel);

        return [
            'risk_score' => $riskScore,
            'supervision_level' => $supervisionLevel,
            'medical_complexity_tier' => $complexityTier,
            'flags' => $flags,
        ];
    }

    /**
     * Calculate the total numeric risk score for a camper (0–100).
     *
     * Works through each medical data category, adding points for each
     * positive risk factor found. The result is capped at RISK_SCORE_CAP (100)
     * so a camper with many conditions doesn't go past the maximum tier boundary.
     *
     * Scoring categories:
     *  - Medical record: seizure history
     *  - Feeding plan: G-tube dependency
     *  - Behavioral profile: wandering, aggression, one-to-one need, developmental delay
     *  - Assistive devices: transfer assistance requirement
     *  - Diagnoses: severity level (severe or moderate)
     *
     * @param  Camper  $camper  Camper with all relationships pre-loaded
     * @return int  Risk score from 0 to 100
     */
    public function calculateRiskScore(Camper $camper): int
    {
        $score = 0;

        // ── Medical record risk factors ──────────────────────────────────────
        $medicalRecord = $camper->medicalRecord;
        if ($medicalRecord) {
            if ($medicalRecord->has_seizures) {
                $score += self::RISK_SEIZURES;
            }
        }

        // ── Feeding plan risk factors ────────────────────────────────────────
        $feedingPlan = $camper->feedingPlan;
        if ($feedingPlan && $feedingPlan->g_tube) {
            $score += self::RISK_G_TUBE;
        }

        // ── Behavioral profile risk factors ──────────────────────────────────
        $behavioralProfile = $camper->behavioralProfile;
        if ($behavioralProfile) {
            if ($behavioralProfile->wandering_risk) {
                $score += self::RISK_WANDERING;
            }

            if ($behavioralProfile->aggression) {
                $score += self::RISK_AGGRESSION;
            }

            if ($behavioralProfile->one_to_one_supervision) {
                $score += self::RISK_ONE_TO_ONE;
            }

            if ($behavioralProfile->developmental_delay) {
                $score += self::RISK_DEVELOPMENTAL_DELAY;
            }
        }

        // ── Assistive device risk factors ────────────────────────────────────
        $assistiveDevices = $camper->assistiveDevices;
        foreach ($assistiveDevices as $device) {
            if ($device->requires_transfer_assistance) {
                $score += self::RISK_TRANSFER_ASSISTANCE;
                // Count transfer assistance only once even if multiple devices require it
                break;
            }
        }

        // ── Diagnosis severity risk factors ──────────────────────────────────
        $diagnoses = $camper->diagnoses;
        foreach ($diagnoses as $diagnosis) {
            if ($diagnosis->severity_level === DiagnosisSeverity::Severe) {
                $score += self::RISK_DIAGNOSIS_SEVERE;
            } elseif ($diagnosis->severity_level === DiagnosisSeverity::Moderate) {
                $score += self::RISK_DIAGNOSIS_MODERATE;
            }
        }

        // Cap the score at the maximum so it never exceeds the defined ceiling
        return min($score, self::RISK_SCORE_CAP);
    }

    /**
     * Map a numeric risk score to the appropriate supervision level.
     *
     * Supervision levels affect staffing ratios at camp:
     *  Standard  (≤20): 1:6 ratio — typical for campers with minimal needs
     *  Enhanced  (≤40): 1:3 ratio — increased supervision for moderate needs
     *  OneToOne    (>40): 1:1 ratio — a dedicated staff member per camper
     *
     * @param  int  $score  Risk score from 0 to 100
     */
    protected function determineSupervisionLevel(int $score): SupervisionLevel
    {
        if ($score <= self::SUPERVISION_STANDARD_MAX) {
            return SupervisionLevel::Standard;
        }

        if ($score <= self::SUPERVISION_ENHANCED_MAX) {
            return SupervisionLevel::Enhanced;
        }

        // Anything above Enhanced threshold requires dedicated one-to-one support
        return SupervisionLevel::OneToOne;
    }

    /**
     * Map a numeric risk score to the appropriate medical complexity tier.
     *
     * Complexity tiers inform medical staffing levels and care plan complexity:
     *  Low      (≤25): Standard health monitoring; no specialist staffing needed
     *  Moderate (≤50): Regular medical check-ins; nurse on call at all times
     *  High      (>50): Continuous medical oversight; specialist staff required
     *
     * @param  int  $score  Risk score from 0 to 100
     */
    protected function determineComplexityTier(int $score): MedicalComplexityTier
    {
        if ($score <= self::COMPLEXITY_LOW_MAX) {
            return MedicalComplexityTier::Low;
        }

        if ($score <= self::COMPLEXITY_MODERATE_MAX) {
            return MedicalComplexityTier::Moderate;
        }

        return MedicalComplexityTier::High;
    }

    /**
     * Build a plain-English list of active risk flags from all medical data sections.
     *
     * Flags are short string identifiers (e.g. 'seizures', 'wandering_risk') that
     * give staff a quick checklist of what to watch for with this camper, without
     * needing to open every sub-section of the medical record.
     *
     * These flags are also used by DocumentEnforcementService to determine which
     * condition-specific documents are required for approval.
     *
     * @param  Camper  $camper  Camper with all relationships pre-loaded
     * @return array<string>  List of active risk flag identifiers
     */
    protected function extractFlags(Camper $camper): array
    {
        $flags = [];

        // ── Medical record flags ─────────────────────────────────────────────
        $medicalRecord = $camper->medicalRecord;
        if ($medicalRecord) {
            if ($medicalRecord->has_seizures) {
                $flags[] = 'seizures';
            }

            if ($medicalRecord->has_neurostimulator) {
                $flags[] = 'neurostimulator';
            }
        }

        // ── Feeding plan flags ───────────────────────────────────────────────
        $feedingPlan = $camper->feedingPlan;
        if ($feedingPlan) {
            if ($feedingPlan->g_tube) {
                $flags[] = 'g_tube';
            }

            if ($feedingPlan->special_diet) {
                $flags[] = 'special_diet';
            }
        }

        // ── Behavioral profile flags ─────────────────────────────────────────
        $behavioralProfile = $camper->behavioralProfile;
        if ($behavioralProfile) {
            if ($behavioralProfile->wandering_risk) {
                $flags[] = 'wandering_risk';
            }

            if ($behavioralProfile->aggression) {
                $flags[] = 'aggression';
            }

            if ($behavioralProfile->self_abuse) {
                $flags[] = 'self_abuse';
            }

            if ($behavioralProfile->one_to_one_supervision) {
                $flags[] = 'one_to_one_required';
            }

            if ($behavioralProfile->developmental_delay) {
                $flags[] = 'developmental_delay';
            }
        }

        // ── Assistive device flags ───────────────────────────────────────────
        $assistiveDevices = $camper->assistiveDevices;
        if ($assistiveDevices->isNotEmpty()) {
            // Flag that the camper uses at least one assistive device
            $flags[] = 'assistive_devices';

            if ($assistiveDevices->contains('requires_transfer_assistance', true)) {
                $flags[] = 'transfer_assistance';
            }

            // CPAP / BiPAP — requires physician waiver for overnight camp use
            $hasCpap = $assistiveDevices->contains(function ($device) {
                return stripos((string) $device->device_type, 'cpap') !== false;
            });
            if ($hasCpap) {
                $flags[] = 'cpap';
            }
        }

        // ── Diagnosis severity flag ──────────────────────────────────────────
        $diagnoses = $camper->diagnoses;
        // Check if any diagnosis has a "Severe" severity level
        $hasSevereDiagnosis = $diagnoses->contains(function ($diagnosis) {
            return $diagnosis->severity_level === DiagnosisSeverity::Severe;
        });

        if ($hasSevereDiagnosis) {
            $flags[] = 'severe_diagnosis';
        }

        return $flags;
    }

    /**
     * Persist the computed supervision level to the camper's database record.
     *
     * Only writes to the database if the level has actually changed, avoiding
     * unnecessary writes and preventing infinite observer loops (observers watch
     * camper saves and call this service again — saveQuietly() skips observers).
     *
     * @param  Camper           $camper  The camper being updated
     * @param  SupervisionLevel $level   The freshly computed supervision level
     */
    protected function persistSupervisionLevel(Camper $camper, SupervisionLevel $level): void
    {
        // Skip the database write entirely if the level hasn't changed
        if ($camper->supervision_level !== $level) {
            $camper->supervision_level = $level;
            // saveQuietly() saves without firing model events (prevents observer re-entry)
            $camper->saveQuietly();
        }
    }
}
