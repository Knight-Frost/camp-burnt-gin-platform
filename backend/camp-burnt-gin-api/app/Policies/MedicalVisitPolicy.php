<?php

namespace App\Policies;

use App\Models\MedicalVisit;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class MedicalVisitPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function view(User $user, MedicalVisit $medicalVisit): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function update(User $user, MedicalVisit $medicalVisit): bool
    {
        if ($user->isAdmin()) {
            return true;
        }
        return $user->isMedicalProvider() && $medicalVisit->recorded_by === $user->id;
    }

    public function delete(User $user, MedicalVisit $medicalVisit): bool
    {
        return $user->isAdmin();
    }
}
