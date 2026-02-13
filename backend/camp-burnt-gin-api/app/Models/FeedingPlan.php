<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FeedingPlan model representing specialized dietary needs for a camper.
 *
 * Each camper has a single feeding plan documenting dietary restrictions,
 * tube feeding protocols, and nutrition support requirements to ensure
 * appropriate meal planning and medical supervision.
 *
 * PHI fields are encrypted at rest using Laravel's encrypted casting.
 */
class FeedingPlan extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'special_diet',
        'diet_description',
        'g_tube',
        'formula',
        'amount_per_feeding',
        'feedings_per_day',
        'feeding_times',
        'bolus_only',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are encrypted at rest for HIPAA compliance.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'special_diet' => 'boolean',
            'diet_description' => 'encrypted',
            'g_tube' => 'boolean',
            'feedings_per_day' => 'integer',
            'feeding_times' => 'array',
            'bolus_only' => 'boolean',
            'notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this feeding plan belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this feeding plan requires enteral feeding action plan.
     *
     * G-tube feeding requires a documented action plan with protocols
     * for tube feeding administration and emergency procedures.
     */
    public function requiresFeedingActionPlan(): bool
    {
        return $this->g_tube === true;
    }

    /**
     * Determine if this feeding plan requires specialized staff training.
     *
     * Tube feeding and certain dietary restrictions require staff to
     * have specialized training for safe administration.
     */
    public function requiresSpecializedStaff(): bool
    {
        return $this->g_tube === true;
    }
}
