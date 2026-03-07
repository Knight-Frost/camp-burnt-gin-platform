<?php

namespace App\Policies;

use App\Models\MedicalIncident;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class MedicalIncidentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function view(User $user, MedicalIncident $medicalIncident): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isMedicalProvider();
    }

    public function update(User $user, MedicalIncident $medicalIncident): bool
    {
        if ($user->isAdmin()) {
            return true;
        }
        return $user->isMedicalProvider() && $medicalIncident->recorded_by === $user->id;
    }

    public function delete(User $user, MedicalIncident $medicalIncident): bool
    {
        return $user->isAdmin();
    }
}
