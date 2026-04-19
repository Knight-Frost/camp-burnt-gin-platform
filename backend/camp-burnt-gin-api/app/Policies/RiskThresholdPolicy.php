<?php

namespace App\Policies;

use App\Models\RiskThreshold;
use App\Models\User;

class RiskThresholdPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }

    public function update(User $user, RiskThreshold $threshold): bool
    {
        return $user->isAdmin();
    }
}
