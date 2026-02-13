<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Models\Camper;

/**
 * Service for report generation.
 *
 * Generates various administrative reports and label data.
 * Implements FR-16, FR-17, FR-18: Report generation requirements.
 */
class ReportService
{
    /**
     * Generate applications report with filtering.
     *
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function generateApplicationsReport(array $filters): array
    {
        $query = Application::with(['camper.user', 'campSession.camp', 'reviewer']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('submitted_at', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('submitted_at', '<=', $filters['date_to']);
        }

        $applications = $query->get();

        $summary = [
            'total' => $applications->count(),
            'by_status' => $applications->groupBy('status')->map->count(),
            'by_session' => $applications->groupBy('camp_session_id')->map->count(),
        ];

        return [
            'data' => $applications->map(function ($app) {
                return [
                    'id' => $app->id,
                    'camper_name' => $app->camper->full_name,
                    'parent_name' => $app->camper->user->name,
                    'parent_email' => $app->camper->user->email,
                    'camp_session' => $app->campSession->name,
                    'camp_name' => $app->campSession->camp->name,
                    'status' => $app->status,
                    'submitted_at' => $app->submitted_at?->toIso8601String(),
                    'reviewed_at' => $app->reviewed_at?->toIso8601String(),
                    'reviewer' => $app->reviewer?->name,
                ];
            }),
            'summary' => $summary,
        ];
    }

    /**
     * Generate list of accepted applicants.
     *
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function generateAcceptedApplicantsReport(array $filters): array
    {
        $query = Application::with(['camper.user', 'campSession.camp'])
            ->where('status', ApplicationStatus::Approved);

        if (!empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        $applications = $query->get();

        return [
            'data' => $applications->map(function ($app) {
                return [
                    'camper_id' => $app->camper_id,
                    'camper_name' => $app->camper->full_name,
                    'date_of_birth' => $app->camper->date_of_birth->format('Y-m-d'),
                    'age' => $app->camper->date_of_birth->age,
                    'parent_name' => $app->camper->user->name,
                    'parent_email' => $app->camper->user->email,
                    'camp_session' => $app->campSession->name,
                    'session_dates' => $app->campSession->start_date->format('M j') . ' - ' . $app->campSession->end_date->format('M j, Y'),
                    'approved_at' => $app->reviewed_at?->toIso8601String(),
                ];
            }),
            'total' => $applications->count(),
        ];
    }

    /**
     * Generate list of rejected applicants.
     *
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function generateRejectedApplicantsReport(array $filters): array
    {
        $query = Application::with(['camper.user', 'campSession.camp'])
            ->where('status', ApplicationStatus::Rejected);

        if (!empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        $applications = $query->get();

        return [
            'data' => $applications->map(function ($app) {
                return [
                    'camper_id' => $app->camper_id,
                    'camper_name' => $app->camper->full_name,
                    'parent_name' => $app->camper->user->name,
                    'parent_email' => $app->camper->user->email,
                    'camp_session' => $app->campSession->name,
                    'rejected_at' => $app->reviewed_at?->toIso8601String(),
                    'notes' => $app->notes,
                ];
            }),
            'total' => $applications->count(),
        ];
    }

    /**
     * Generate mailing labels data.
     *
     * @param array<string, mixed> $filters
     * @return array<array<string, mixed>>
     */
    public function generateMailingLabels(array $filters): array
    {
        $query = Application::with(['camper.user'])
            ->whereNotNull('submitted_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } else {
            $query->where('status', ApplicationStatus::Approved);
        }

        if (!empty($filters['camp_session_id'])) {
            $query->where('camp_session_id', $filters['camp_session_id']);
        }

        return $query->get()->map(function ($app) {
            return [
                'recipient_name' => $app->camper->user->name,
                'camper_name' => $app->camper->full_name,
                'email' => $app->camper->user->email,
            ];
        })->toArray();
    }

    /**
     * Generate identification labels for a camp session.
     *
     * @return array<array<string, mixed>>
     */
    public function generateIdLabels(int $campSessionId): array
    {
        $applications = Application::with(['camper.allergies', 'campSession'])
            ->where('camp_session_id', $campSessionId)
            ->where('status', ApplicationStatus::Approved)
            ->get();

        return $applications->map(function ($app) {
            $severeAllergies = $app->camper->allergies
                ->filter(fn ($a) => $a->requiresImmediateAttention())
                ->pluck('allergen')
                ->toArray();

            return [
                'camper_name' => $app->camper->full_name,
                'date_of_birth' => $app->camper->date_of_birth->format('m/d/Y'),
                'age' => $app->camper->date_of_birth->age,
                'session_name' => $app->campSession->name,
                'has_severe_allergies' => count($severeAllergies) > 0,
                'severe_allergies' => $severeAllergies,
                'requires_attention' => $app->camper->requiresImmediateAttention(),
            ];
        })->toArray();
    }
}
