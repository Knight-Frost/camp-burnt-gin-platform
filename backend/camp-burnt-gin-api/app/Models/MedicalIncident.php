<?php

namespace App\Models;

use App\Enums\IncidentType;
use App\Enums\IncidentSeverity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalIncident extends Model
{
    protected $fillable = [
        'camper_id',
        'recorded_by',
        'treatment_log_id',
        'type',
        'severity',
        'location',
        'title',
        'description',
        'witnesses',
        'escalation_required',
        'escalation_notes',
        'incident_date',
        'incident_time',
    ];

    protected function casts(): array
    {
        return [
            'type'                => IncidentType::class,
            'severity'            => IncidentSeverity::class,
            'location'            => 'encrypted',
            'title'               => 'encrypted',
            'description'         => 'encrypted',
            'witnesses'           => 'encrypted',
            'escalation_required' => 'boolean',
            'escalation_notes'    => 'encrypted',
            'incident_date'       => 'date:Y-m-d',
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

    public function treatmentLog(): BelongsTo
    {
        return $this->belongsTo(TreatmentLog::class);
    }

    public function isCritical(): bool
    {
        return $this->severity === IncidentSeverity::Critical;
    }
}
