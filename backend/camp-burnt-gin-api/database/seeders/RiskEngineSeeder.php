<?php

namespace Database\Seeders;

use App\Models\RiskFactor;
use App\Models\RiskRule;
use App\Models\RiskThreshold;
use Illuminate\Database\Seeder;

/**
 * RiskEngineSeeder — Seeds the dynamic risk engine with the original clinical values.
 *
 * These values were previously hardcoded as PHP constants in SpecialNeedsRiskAssessmentService.
 * Seeding them here makes them the authoritative starting point that medical staff can
 * adjust via the Risk Management UI without any code changes.
 *
 * Run with: php artisan db:seed --class=RiskEngineSeeder
 */
class RiskEngineSeeder extends Seeder
{
    public function run(): void
    {
        // ── Risk Factors ─────────────────────────────────────────────────────────
        // Points match the original constants in SpecialNeedsRiskAssessmentService.

        $factors = [
            [
                'key' => 'seizures',
                'label' => 'Seizure History',
                'category' => 'medical',
                'points' => 20,
                'per_item' => false,
                'source_model' => 'MedicalRecord',
                'tooltip' => 'Documented seizure history on file. Camp policy requires an active Seizure Action Plan signed by the physician. All cabin staff must complete seizure response training.',
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'key' => 'neurostimulator',
                'label' => 'Neurostimulator (VNS/DBS)',
                'category' => 'medical',
                'points' => 0,
                'per_item' => false,
                'source_model' => 'MedicalRecord',
                'tooltip' => 'Implanted neurostimulator on file. No score impact — flagged for staff awareness. MRI is contraindicated. Staff must not place magnets near the device.',
                'is_active' => true,
                'sort_order' => 20,
            ],
            [
                'key' => 'life_threatening_allergy',
                'label' => 'Life-Threatening Allergy (Anaphylaxis Risk)',
                'category' => 'allergy',
                'points' => 15,
                'per_item' => false,
                'source_model' => 'Allergy',
                'tooltip' => 'One or more allergies classified as life-threatening. An epinephrine auto-injector must be accessible within 30 seconds at all times. Kitchen staff must be briefed before each meal.',
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'key' => 'g_tube',
                'label' => 'G-Tube Feeding',
                'category' => 'feeding',
                'points' => 20,
                'per_item' => false,
                'source_model' => 'FeedingPlan',
                'tooltip' => 'Gastrostomy tube present. A staff member trained in tube-feeding procedures must be present at every meal. Tube site must be inspected daily for irritation or infection.',
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'key' => 'special_diet',
                'label' => 'Special Dietary Requirements',
                'category' => 'feeding',
                'points' => 0,
                'per_item' => false,
                'source_model' => 'FeedingPlan',
                'tooltip' => 'Special dietary requirements documented. No score impact — flagged for kitchen coordination. Dietary needs must be reviewed with food service before first meal.',
                'is_active' => true,
                'sort_order' => 20,
            ],
            [
                'key' => 'one_to_one_required',
                'label' => 'Requires One-to-One Supervision',
                'category' => 'behavioral',
                'points' => 30,
                'per_item' => false,
                'source_model' => 'BehavioralProfile',
                'tooltip' => 'Behavioral profile requires a dedicated 1:1 staff member at all times. The assigned staff member has no other camper responsibilities. Session staffing plans must account for this before the camper\'s arrival.',
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'key' => 'wandering_risk',
                'label' => 'Wandering / Elopement Risk',
                'category' => 'behavioral',
                'points' => 15,
                'per_item' => false,
                'source_model' => 'BehavioralProfile',
                'tooltip' => 'Documented wandering or elopement risk. Visual contact required during all transitions. A systematic search must begin within 3 minutes if the camper cannot be located.',
                'is_active' => true,
                'sort_order' => 20,
            ],
            [
                'key' => 'aggression',
                'label' => 'History of Aggression',
                'category' => 'behavioral',
                'points' => 15,
                'per_item' => false,
                'source_model' => 'BehavioralProfile',
                'tooltip' => 'Documented history of aggressive behavior. Counselors must review de-escalation strategies from the behavioral profile before the session.',
                'is_active' => true,
                'sort_order' => 30,
            ],
            [
                'key' => 'self_abuse',
                'label' => 'Self-Injurious Behaviour',
                'category' => 'behavioral',
                'points' => 0,
                'per_item' => false,
                'source_model' => 'BehavioralProfile',
                'tooltip' => 'Documented self-injurious behavior. No score impact — flagged for counselor awareness. Triggers and calming strategies are in the behavioral profile.',
                'is_active' => true,
                'sort_order' => 40,
            ],
            [
                'key' => 'developmental_delay',
                'label' => 'Developmental Delay',
                'category' => 'behavioral',
                'points' => 10,
                'per_item' => false,
                'source_model' => 'BehavioralProfile',
                'tooltip' => 'Developmental delay diagnosed. All activities should be adapted to the camper\'s functional age. Allow additional processing time and provide visual schedules where possible.',
                'is_active' => true,
                'sort_order' => 50,
            ],
            [
                'key' => 'transfer_assistance',
                'label' => 'Transfer Assistance Required',
                'category' => 'physical',
                'points' => 10,
                'per_item' => false,
                'source_model' => 'AssistiveDevice',
                'tooltip' => 'Assistive devices requiring staff-assisted transfers. Staff must complete transfer training before the session. Incorrect technique risks injury to both camper and staff.',
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'key' => 'cpap_bipap',
                'label' => 'CPAP / BiPAP Device',
                'category' => 'physical',
                'points' => 0,
                'per_item' => false,
                'source_model' => 'AssistiveDevice',
                'tooltip' => 'CPAP or BiPAP required for overnight respiratory support. No score impact. Overnight staff must complete device setup training before the first night.',
                'is_active' => true,
                'sort_order' => 20,
            ],
            [
                'key' => 'severe_diagnosis',
                'label' => 'Severe Diagnosis',
                'category' => 'medical',
                'points' => 5,
                'per_item' => true,
                'source_model' => 'Diagnosis',
                'tooltip' => 'Each severe diagnosis adds points to the risk score. Severe diagnoses require pre-session review with the medical director and accessible condition-specific protocols.',
                'is_active' => true,
                'sort_order' => 30,
            ],
            [
                'key' => 'moderate_diagnosis',
                'label' => 'Moderate Diagnosis',
                'category' => 'medical',
                'points' => 3,
                'per_item' => true,
                'source_model' => 'Diagnosis',
                'tooltip' => 'Each moderate diagnosis adds points. Requires staff familiarity with the camper\'s medication schedule, activity restrictions, and emergency protocol.',
                'is_active' => true,
                'sort_order' => 40,
            ],
        ];

        foreach ($factors as $factor) {
            RiskFactor::updateOrCreate(['key' => $factor['key']], $factor);
        }

        // ── Risk Rules (Conditional Bonuses) ─────────────────────────────────────
        // Example: Seizures + Life-threatening allergy = even higher combined risk.

        $rules = [
            [
                'name' => 'Seizures with Life-Threatening Allergy',
                'description' => 'When a camper has both documented seizures and a life-threatening allergy, emergency response complexity compounds significantly.',
                'conditions' => [
                    ['factor_key' => 'seizures', 'present' => true],
                    ['factor_key' => 'life_threatening_allergy', 'present' => true],
                ],
                'points_adjustment' => 5,
                'is_active' => true,
            ],
            [
                'name' => 'One-to-One with Wandering Risk',
                'description' => 'A camper requiring 1:1 supervision who also has wandering risk requires heightened perimeter protocols beyond the standard 1:1 assignment.',
                'conditions' => [
                    ['factor_key' => 'one_to_one_required', 'present' => true],
                    ['factor_key' => 'wandering_risk', 'present' => true],
                ],
                'points_adjustment' => 5,
                'is_active' => true,
            ],
            [
                'name' => 'G-Tube with Aggression',
                'description' => 'A camper with a g-tube who exhibits aggressive behavior creates compounded risk during feeding procedures.',
                'conditions' => [
                    ['factor_key' => 'g_tube', 'present' => true],
                    ['factor_key' => 'aggression', 'present' => true],
                ],
                'points_adjustment' => 5,
                'is_active' => true,
            ],
        ];

        foreach ($rules as $rule) {
            RiskRule::updateOrCreate(['name' => $rule['name']], $rule);
        }

        // ── Risk Thresholds ──────────────────────────────────────────────────────

        // Supervision levels — match original SUPERVISION_STANDARD_MAX=20, SUPERVISION_ENHANCED_MAX=40
        $supervisionThresholds = [
            [
                'threshold_type' => 'supervision',
                'level_value' => 'standard',
                'label' => 'Standard Supervision',
                'min_score' => 0,
                'max_score' => 20,
                'staffing_ratio' => '1:6',
                'intervention_description' => 'Typical camp supervision ratio — one staff member per six campers.',
                'sort_order' => 10,
            ],
            [
                'threshold_type' => 'supervision',
                'level_value' => 'enhanced',
                'label' => 'Enhanced Supervision',
                'min_score' => 21,
                'max_score' => 40,
                'staffing_ratio' => '1:3',
                'intervention_description' => 'Increased supervision ratio — one staff member per three campers.',
                'sort_order' => 20,
            ],
            [
                'threshold_type' => 'supervision',
                'level_value' => 'one_to_one',
                'label' => 'One-to-One Supervision',
                'min_score' => 41,
                'max_score' => null,
                'staffing_ratio' => '1:1',
                'intervention_description' => 'Dedicated one-to-one staff member required at all times.',
                'sort_order' => 30,
            ],
        ];

        // Complexity tiers — match original COMPLEXITY_LOW_MAX=25, COMPLEXITY_MODERATE_MAX=50
        $complexityThresholds = [
            [
                'threshold_type' => 'complexity',
                'level_value' => 'low',
                'label' => 'Low Medical Complexity',
                'min_score' => 0,
                'max_score' => 25,
                'staffing_ratio' => null,
                'intervention_description' => 'Minimal medical intervention needed.',
                'sort_order' => 10,
            ],
            [
                'threshold_type' => 'complexity',
                'level_value' => 'moderate',
                'label' => 'Moderate Medical Complexity',
                'min_score' => 26,
                'max_score' => 50,
                'staffing_ratio' => null,
                'intervention_description' => 'Regular monitoring and medical support required.',
                'sort_order' => 20,
            ],
            [
                'threshold_type' => 'complexity',
                'level_value' => 'high',
                'label' => 'High Medical Complexity',
                'min_score' => 51,
                'max_score' => null,
                'staffing_ratio' => null,
                'intervention_description' => 'Intensive care and specialised medical staffing required.',
                'sort_order' => 30,
            ],
        ];

        foreach (array_merge($supervisionThresholds, $complexityThresholds) as $threshold) {
            RiskThreshold::updateOrCreate(
                ['threshold_type' => $threshold['threshold_type'], 'level_value' => $threshold['level_value']],
                $threshold
            );
        }
    }
}
