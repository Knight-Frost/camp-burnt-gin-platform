<?php

namespace App\Services;

use App\Enums\DiagnosisSeverity;
use App\Enums\MedicalComplexityTier;
use App\Enums\SupervisionLevel;
use App\Models\Camper;

/**
 * Service for special needs risk assessment and supervision level determination.
 *
 * This service calculates medical complexity risk scores based on camper
 * medical conditions, behavioral needs, and assistive device requirements.
 * Risk scores determine appropriate staff-to-camper supervision ratios
 * and medical complexity tiers for care planning.
 *
 * Scoring is deterministic and follows documented medical risk assessment
 * protocols for children and youth with special health care needs.
 */
class SpecialNeedsRiskAssessmentService
{
    /**
     * Risk score constants for medical conditions.
     */
    protected const RISK_SEIZURES = 20;

    protected const RISK_G_TUBE = 20;

    protected const RISK_WANDERING = 15;

    protected const RISK_AGGRESSION = 15;

    protected const RISK_ONE_TO_ONE = 30;

    protected const RISK_TRANSFER_ASSISTANCE = 10;

    protected const RISK_DEVELOPMENTAL_DELAY = 10;

    protected const RISK_DIAGNOSIS_SEVERE = 5;

    protected const RISK_DIAGNOSIS_MODERATE = 3;

    /**
     * Maximum risk score cap.
     */
    protected const RISK_SCORE_CAP = 100;

    /**
     * Supervision level thresholds.
     */
    protected const SUPERVISION_STANDARD_MAX = 20;

    protected const SUPERVISION_ENHANCED_MAX = 40;

    /**
     * Medical complexity tier thresholds.
     */
    protected const COMPLEXITY_LOW_MAX = 25;

    protected const COMPLEXITY_MODERATE_MAX = 50;

    /**
     * Assess a camper's medical complexity and supervision requirements.
     *
     * This method calculates the camper's risk score, determines appropriate
     * supervision level and medical complexity tier, extracts risk flags,
     * and persists the supervision level if changed.
     *
     * @return array<string, mixed> Assessment results with risk_score, supervision_level, medical_complexity_tier, and flags
     */
    public function assessCamper(Camper $camper): array
    {
        $riskScore = $this->calculateRiskScore($camper);
        $supervisionLevel = $this->determineSupervisionLevel($riskScore);
        $complexityTier = $this->determineComplexityTier($riskScore);
        $flags = $this->extractFlags($camper);

        $this->persistSupervisionLevel($camper, $supervisionLevel);

        return [
            'risk_score' => $riskScore,
            'supervision_level' => $supervisionLevel,
            'medical_complexity_tier' => $complexityTier,
            'flags' => $flags,
        ];
    }

    /**
     * Calculate the total risk score for a camper.
     *
     * Risk scoring algorithm considers:
     * - Medical conditions (seizures, G-tube feeding)
     * - Behavioral factors (wandering, aggression, supervision needs)
     * - Physical needs (assistive devices, developmental delays)
     * - Diagnosis severity levels
     *
     * Scores are capped at 100 to prevent overflow from multiple conditions.
     *
     * @return int Risk score from 0 to 100
     */
    public function calculateRiskScore(Camper $camper): int
    {
        $score = 0;

        // Medical record risk factors
        $medicalRecord = $camper->medicalRecord;
        if ($medicalRecord) {
            if ($medicalRecord->has_seizures) {
                $score += self::RISK_SEIZURES;
            }
        }

        // Feeding plan risk factors
        $feedingPlan = $camper->feedingPlan;
        if ($feedingPlan && $feedingPlan->g_tube) {
            $score += self::RISK_G_TUBE;
        }

        // Behavioral profile risk factors
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

        // Assistive device risk factors
        $assistiveDevices = $camper->assistiveDevices;
        foreach ($assistiveDevices as $device) {
            if ($device->requires_transfer_assistance) {
                $score += self::RISK_TRANSFER_ASSISTANCE;
                break; // Count once regardless of multiple devices
            }
        }

        // Diagnosis severity risk factors
        $diagnoses = $camper->diagnoses;
        foreach ($diagnoses as $diagnosis) {
            if ($diagnosis->severity_level === DiagnosisSeverity::Severe) {
                $score += self::RISK_DIAGNOSIS_SEVERE;
            } elseif ($diagnosis->severity_level === DiagnosisSeverity::Moderate) {
                $score += self::RISK_DIAGNOSIS_MODERATE;
            }
        }

        // Cap score at maximum
        return min($score, self::RISK_SCORE_CAP);
    }

    /**
     * Determine the appropriate supervision level based on risk score.
     *
     * Supervision levels determine staff-to-camper ratios:
     * - Standard (1:6): Low risk, typical camp supervision
     * - Enhanced (1:3): Moderate risk, increased supervision needed
     * - One-to-One (1:1): High risk, dedicated staff member required
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

        return SupervisionLevel::OneToOne;
    }

    /**
     * Determine the medical complexity tier based on risk score.
     *
     * Complexity tiers categorize overall medical support requirements:
     * - Low: Minimal medical intervention needed
     * - Moderate: Regular medical monitoring and support
     * - High: Intensive medical care and specialized staffing
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
     * Extract risk flags from camper medical data.
     *
     * Flags provide a human-readable summary of specific risk factors
     * present for the camper, enabling quick identification of medical
     * and behavioral considerations for staff.
     *
     * @return array<string> List of active risk flags
     */
    protected function extractFlags(Camper $camper): array
    {
        $flags = [];

        // Medical record flags
        $medicalRecord = $camper->medicalRecord;
        if ($medicalRecord) {
            if ($medicalRecord->has_seizures) {
                $flags[] = 'seizures';
            }

            if ($medicalRecord->has_neurostimulator) {
                $flags[] = 'neurostimulator';
            }
        }

        // Feeding plan flags
        $feedingPlan = $camper->feedingPlan;
        if ($feedingPlan) {
            if ($feedingPlan->g_tube) {
                $flags[] = 'g_tube';
            }

            if ($feedingPlan->special_diet) {
                $flags[] = 'special_diet';
            }
        }

        // Behavioral profile flags
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

        // Assistive device flags
        $assistiveDevices = $camper->assistiveDevices;
        if ($assistiveDevices->isNotEmpty()) {
            $flags[] = 'assistive_devices';

            if ($assistiveDevices->contains('requires_transfer_assistance', true)) {
                $flags[] = 'transfer_assistance';
            }
        }

        // High-severity diagnosis flag
        $diagnoses = $camper->diagnoses;
        $hasSevereDiagnosis = $diagnoses->contains(function ($diagnosis) {
            return $diagnosis->severity_level === DiagnosisSeverity::Severe;
        });

        if ($hasSevereDiagnosis) {
            $flags[] = 'severe_diagnosis';
        }

        return $flags;
    }

    /**
     * Persist the calculated supervision level to the camper record.
     *
     * Only updates the database if the supervision level has changed,
     * preventing unnecessary writes and observer triggering.
     *
     * Uses saveQuietly() to prevent observer loops during reassessment.
     *
     * @param  Camper  $camper  The camper instance
     * @param  SupervisionLevel  $level  The calculated supervision level
     */
    protected function persistSupervisionLevel(Camper $camper, SupervisionLevel $level): void
    {
        // Only update if supervision level has changed
        if ($camper->supervision_level !== $level) {
            $camper->supervision_level = $level;
            $camper->saveQuietly();
        }
    }
}
