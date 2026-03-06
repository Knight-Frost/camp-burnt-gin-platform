<?php

namespace App\Policies;

use App\Models\FeedingPlan;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on FeedingPlan resources.
 *
 * Feeding plans contain sensitive dietary and medical nutrition
 * information requiring strict access controls for camper safety.
 */
class FeedingPlanPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any feeding plans.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view the feeding plan.
     */
    public function view(User $user, FeedingPlan $feedingPlan): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff have direct access to all camper feeding plans.
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($feedingPlan->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can create feeding plans.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider() || $user->isApplicant();
    }

    /**
     * Determine whether the user can update the feeding plan.
     */
    public function update(User $user, FeedingPlan $feedingPlan): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isMedicalProvider()) {
            // Camp medical staff may update feeding plans during active care.
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($feedingPlan->camper)) {
            return true;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the feeding plan.
     */
    public function delete(User $user, FeedingPlan $feedingPlan): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        if ($user->isApplicant() && $user->ownsCamper($feedingPlan->camper)) {
            return true;
        }

        return false;
    }
}
