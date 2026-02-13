<?php

namespace App\Services\System;

use App\Models\Application;
use App\Notifications\Camper\AcceptanceLetterNotification;
use App\Notifications\Camper\RejectionLetterNotification;

/**
 * Service for generating and sending acceptance/rejection letters.
 *
 * Handles digital letter generation for application decisions.
 * Implements FR-18: Digital acceptance and rejection letters.
 */
class LetterService
{
    /**
     * Send acceptance letter for an approved application.
     */
    public function sendAcceptanceLetter(Application $application): void
    {
        $application->camper->user->notify(new AcceptanceLetterNotification($application));
    }

    /**
     * Send rejection letter for a rejected application.
     */
    public function sendRejectionLetter(Application $application): void
    {
        $application->camper->user->notify(new RejectionLetterNotification($application));
    }

    /**
     * Generate acceptance letter content.
     *
     * @return array<string, mixed>
     */
    public function generateAcceptanceLetterContent(Application $application): array
    {
        return [
            'type' => 'acceptance',
            'date' => now()->format('F j, Y'),
            'recipient' => $application->camper->user->name,
            'camper_name' => $application->camper->full_name,
            'camp_name' => $application->campSession->camp->name,
            'session_name' => $application->campSession->name,
            'session_dates' => [
                'start' => $application->campSession->start_date->format('F j, Y'),
                'end' => $application->campSession->end_date->format('F j, Y'),
            ],
            'location' => $application->campSession->camp->location,
        ];
    }

    /**
     * Generate rejection letter content.
     *
     * @return array<string, mixed>
     */
    public function generateRejectionLetterContent(Application $application): array
    {
        return [
            'type' => 'rejection',
            'date' => now()->format('F j, Y'),
            'recipient' => $application->camper->user->name,
            'camper_name' => $application->camper->full_name,
            'camp_name' => $application->campSession->camp->name,
            'session_name' => $application->campSession->name,
            'notes' => $application->notes,
        ];
    }
}
