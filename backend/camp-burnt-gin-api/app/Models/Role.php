<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Role model representing user access levels within the system.
 *
 * Roles define the permissions and capabilities available to users.
 * Each user is assigned a single role that governs their access
 * to various features and resources.
 */
class Role extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'description',
    ];

    /**
     * Get all users assigned to this role.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
