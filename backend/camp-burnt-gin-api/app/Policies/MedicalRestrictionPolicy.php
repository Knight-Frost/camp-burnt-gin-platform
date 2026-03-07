<?php

namespace App\Policies;

use App\Models\MedicalRestriction;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class MedicalRestrictionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function view(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function update(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function delete(User $user, MedicalRestriction $medicalRestriction): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }
}
