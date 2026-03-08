<?php

namespace App\Services\Medical;

use App\Models\Camper;

/**
 * Derives medical alerts from a camper's clinical record.
 *
 * Alerts are computed on-demand from existing tables (allergies,
 * diagnoses, medical_record, medications) so there is no separate
 * alerts table to maintain and no risk of the alert list becoming
 * stale after clinical data is updated.
 *
 * Each alert has:
 *   - level: 'critical' | 'warning' | 'info'
 *   - category: short machine-readable tag
 *   - title: one-line human label shown in the UI badge
 *   - detail: optional extra context for the detail panel
 */
class MedicalAlertService
{
    /**
     * Return all computed alerts for the given camper.
     *
     * @return list<array{level: string, category: string, title: string, detail: string|null}>
     */
    public function alertsFor(Camper $camper): array
    {
        $camper->loadMissing([
            'allergies',
            'diagnoses',
            'medicalRecord',
            'medications',
        ]);

        $alerts = [];

        // ── Allergies ────────────────────────────────────────────────────────
        foreach ($camper->allergies as $allergy) {
            if (! $allergy->severity->requiresImmediateAttention()) {
                continue;
            }

            $detail = null;
            if ($allergy->reaction) {
                $detail = 'Reaction: ' . $allergy->reaction;
            }
            if ($allergy->treatment) {
                $detail .= ($detail ? ' | ' : '') . 'Treatment: ' . $allergy->treatment;
            }

            $alerts[] = [
                'level'    => $allergy->severity->value === 'life_threatening' ? 'critical' : 'warning',
                'category' => 'allergy',
                'title'    => strtoupper($allergy->severity->label()) . ' ALLERGY — ' . $allergy->allergen,
                'detail'   => $detail,
            ];
        }

        // ── Seizure history ──────────────────────────────────────────────────
        $record = $camper->medicalRecord;
        if ($record && $record->has_seizures) {
            $detail = null;
            if ($record->seizure_description) {
                $detail = $record->seizure_description;
            }
            if ($record->last_seizure_date) {
                $detail .= ($detail ? ' | ' : '') . 'Last seizure: ' . $record->last_seizure_date->toDateString();
            }

            $alerts[] = [
                'level'    => 'critical',
                'category' => 'seizure',
                'title'    => 'SEIZURE HISTORY — Seizure Action Plan required',
                'detail'   => $detail,
            ];
        }

        // ── Neurostimulator ──────────────────────────────────────────────────
        if ($record && $record->has_neurostimulator) {
            $alerts[] = [
                'level'    => 'warning',
                'category' => 'device',
                'title'    => 'NEUROSTIMULATOR — Avoid MRI and electrical equipment near chest',
                'detail'   => null,
            ];
        }

        // ── Diagnoses ────────────────────────────────────────────────────────
        foreach ($camper->diagnoses as $dx) {
            // Surface all diagnoses as informational alerts so medics see
            // the full picture at a glance without opening the sub-section.
            $alerts[] = [
                'level'    => 'info',
                'category' => 'diagnosis',
                'title'    => 'DIAGNOSIS — ' . $dx->name,
                'detail'   => $dx->notes ?? null,
            ];
        }

        // ── Medications that require refrigeration ───────────────────────────
        foreach ($camper->medications as $med) {
            $notesLower = mb_strtolower($med->notes ?? '');
            if (str_contains($notesLower, 'refrigerat')) {
                $alerts[] = [
                    'level'    => 'warning',
                    'category' => 'medication',
                    'title'    => 'REFRIGERATED MEDICATION — ' . $med->name,
                    'detail'   => $med->notes,
                ];
            }
        }

        // Sort: critical → warning → info
        usort($alerts, function (array $a, array $b): int {
            $order = ['critical' => 0, 'warning' => 1, 'info' => 2];

            return ($order[$a['level']] ?? 9) <=> ($order[$b['level']] ?? 9);
        });

        return $alerts;
    }
}
