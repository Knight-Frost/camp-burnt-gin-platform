<?php

namespace App\Policies;

use App\Models\MedicalFollowUp;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class MedicalFollowUpPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function view(User $user, MedicalFollowUp $medicalFollowUp): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function update(User $user, MedicalFollowUp $medicalFollowUp): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function delete(User $user, MedicalFollowUp $medicalFollowUp): bool
    {
        return $user->isAdmin();
    }
}
