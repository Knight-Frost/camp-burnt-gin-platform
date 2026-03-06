<?php

namespace App\Models;

use App\Enums\TreatmentType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * TreatmentLog model representing a medical intervention or observation
 * recorded by camp medical staff for a camper.
 *
 * All fields are encrypted at rest because they may contain PHI.
 */
class TreatmentLog extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'recorded_by',
        'treatment_date',
        'treatment_time',
        'type',
        'title',
        'description',
        'outcome',
        'follow_up_required',
        'follow_up_notes',
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
            'treatment_date'    => 'date',
            'treatment_time'    => 'string',
            'type'              => TreatmentType::class,
            'title'             => 'encrypted',
            'description'       => 'encrypted',
            'outcome'           => 'encrypted',
            'follow_up_required' => 'boolean',
            'follow_up_notes'   => 'encrypted',
        ];
    }

    /**
     * Get the camper this treatment log belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the medical staff member who recorded this treatment.
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
