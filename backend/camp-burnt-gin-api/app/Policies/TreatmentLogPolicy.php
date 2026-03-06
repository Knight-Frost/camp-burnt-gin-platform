<?php

namespace App\Policies;

use App\Models\TreatmentLog;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Policy for authorizing actions on TreatmentLog resources.
 *
 * Treatment logs are created and managed exclusively by camp medical staff
 * and administrators. Applicants do not have access to treatment logs,
 * as these reflect on-site clinical actions by camp staff.
 */
class TreatmentLogPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any treatment logs.
     *
     * Administrators and medical staff can browse the treatment log list.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can view a specific treatment log.
     */
    public function view(User $user, TreatmentLog $treatmentLog): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can create treatment logs.
     *
     * Only camp medical staff can create treatment logs.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    /**
     * Determine whether the user can update a treatment log.
     *
     * Camp medical staff can only update their own treatment log entries.
     * Administrators have full access.
     */
    public function update(User $user, TreatmentLog $treatmentLog): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $user->isMedicalProvider() && $treatmentLog->recorded_by === $user->id;
    }

    /**
     * Determine whether the user can delete a treatment log.
     *
     * Only administrators can delete treatment logs to maintain
     * audit trail integrity.
     */
    public function delete(User $user, TreatmentLog $treatmentLog): bool
    {
        return $user->isAdmin();
    }
}
