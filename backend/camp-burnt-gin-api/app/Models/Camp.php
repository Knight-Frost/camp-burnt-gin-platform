<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Camp model representing a camp program offered by the organization.
 *
 * Camps are the top-level entities that define the various programs
 * available for registration. Each camp can have multiple sessions
 * scheduled throughout the year with specific dates and capacities.
 */
class Camp extends Model
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
        'location',
        'is_active',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get all sessions for this camp.
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(CampSession::class);
    }
}
