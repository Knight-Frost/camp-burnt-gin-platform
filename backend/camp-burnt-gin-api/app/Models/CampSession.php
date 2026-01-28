<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * CampSession model representing a scheduled instance of a camp program.
 *
 * Camp sessions define the specific dates, capacity limits, and age
 * requirements for a particular offering of a camp. Campers register
 * for specific sessions rather than camps directly.
 */
class CampSession extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camp_id',
        'name',
        'start_date',
        'end_date',
        'capacity',
        'min_age',
        'max_age',
        'registration_opens_at',
        'registration_closes_at',
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
            'start_date' => 'date',
            'end_date' => 'date',
            'capacity' => 'integer',
            'min_age' => 'integer',
            'max_age' => 'integer',
            'registration_opens_at' => 'datetime',
            'registration_closes_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get the camp that this session belongs to.
     */
    public function camp(): BelongsTo
    {
        return $this->belongsTo(Camp::class);
    }

    /**
     * Get all applications for this camp session.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }
}
