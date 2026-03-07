<?php

namespace App\Models;

use App\Enums\FollowUpStatus;
use App\Enums\FollowUpPriority;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalFollowUp extends Model
{
    protected $fillable = [
        'camper_id',
        'created_by',
        'assigned_to',
        'treatment_log_id',
        'title',
        'notes',
        'status',
        'priority',
        'due_date',
        'completed_at',
        'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'status'       => FollowUpStatus::class,
            'priority'     => FollowUpPriority::class,
            'due_date'     => 'date:Y-m-d',
            'completed_at' => 'datetime',
        ];
    }

    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function treatmentLog(): BelongsTo
    {
        return $this->belongsTo(TreatmentLog::class);
    }

    public function isOverdue(): bool
    {
        return $this->status !== FollowUpStatus::Completed
            && $this->status !== FollowUpStatus::Cancelled
            && $this->due_date->isPast();
    }

    public function isDueToday(): bool
    {
        return $this->status === FollowUpStatus::Pending
            && $this->due_date->isToday();
    }
}
