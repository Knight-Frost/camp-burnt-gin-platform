<?php

namespace App\Models;

use App\Enums\VisitDisposition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicalVisit extends Model
{
    protected $fillable = [
        'camper_id',
        'recorded_by',
        'visit_date',
        'visit_time',
        'chief_complaint',
        'symptoms',
        'vitals',
        'treatment_provided',
        'medications_administered',
        'disposition',
        'disposition_notes',
        'follow_up_required',
        'follow_up_notes',
    ];

    protected function casts(): array
    {
        return [
            'disposition'              => VisitDisposition::class,
            'vitals'                   => 'array',
            'chief_complaint'          => 'encrypted',
            'symptoms'                 => 'encrypted',
            'treatment_provided'       => 'encrypted',
            'medications_administered' => 'encrypted',
            'disposition_notes'        => 'encrypted',
            'follow_up_required'       => 'boolean',
            'follow_up_notes'          => 'encrypted',
            'visit_date'               => 'date:Y-m-d',
        ];
    }

    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Get all treatment logs recorded during this visit.
     *
     * Treatments are the individual interventions (medications administered,
     * first-aid applied, etc.) that occurred within this clinical encounter.
     */
    public function treatmentLogs(): HasMany
    {
        return $this->hasMany(TreatmentLog::class);
    }

    public function wasEscalated(): bool
    {
        return $this->disposition === VisitDisposition::SentHome
            || $this->disposition === VisitDisposition::EmergencyTransfer;
    }
}
