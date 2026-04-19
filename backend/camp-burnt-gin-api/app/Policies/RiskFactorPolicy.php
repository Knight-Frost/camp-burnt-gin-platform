<?php

namespace App\Policies;

use App\Models\RiskFactor;
use App\Models\User;

class RiskFactorPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }

    public function view(User $user, RiskFactor $factor): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, RiskFactor $factor): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, RiskFactor $factor): bool
    {
        return $user->hasRole('super_admin');
    }
}
