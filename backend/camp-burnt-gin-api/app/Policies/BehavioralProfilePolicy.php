<?php

namespace App\Policies;

use App\Models\BehavioralProfile;
use App\Models\MedicalProviderLink;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on BehavioralProfile resources.
 *
 * Behavioral profiles contain sensitive behavioral and developmental
 * information requiring strict access controls for camper safety
 * and privacy protection.
 */
class BehavioralProfilePolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any behavioral profiles.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the behavioral profile.
     */
    public function view(User $user, BehavioralProfile $behavioralProfile): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return MedicalProviderLink::where('camper_id', $behavioralProfile->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($behavioralProfile->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create behavioral profiles.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isParent();
    }

    /**
     * Determine whether the user can update the behavioral profile.
     */
    public function update(User $user, BehavioralProfile $behavioralProfile): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            return MedicalProviderLink::where('camper_id', $behavioralProfile->camper_id)
                ->where('is_used', true)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();
        }

        if ($user->isParent() && $user->ownsCamper($behavioralProfile->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the behavioral profile.
     *
     * Only administrators and parents can delete behavioral profiles.
     * Medical providers cannot delete to maintain audit trail integrity.
     */
    public function delete(User $user, BehavioralProfile $behavioralProfile): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isParent() && $user->ownsCamper($behavioralProfile->camper)) {
            return true;
        }

        return false;
    }
}
