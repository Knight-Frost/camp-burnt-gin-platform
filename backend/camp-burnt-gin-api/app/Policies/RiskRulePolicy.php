<?php

namespace App\Policies;

use App\Models\RiskRule;
use App\Models\User;

class RiskRulePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }

    public function update(User $user, RiskRule $rule): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }

    public function delete(User $user, RiskRule $rule): bool
    {
        return $user->isAdmin() || $user->hasRole('medical');
    }
}
