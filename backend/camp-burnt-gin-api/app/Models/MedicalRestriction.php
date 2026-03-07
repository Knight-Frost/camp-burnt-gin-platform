<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalRestriction extends Model
{
    protected $fillable = [
        'camper_id',
        'created_by',
        'restriction_type',
        'description',
        'start_date',
        'end_date',
        'is_active',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_active'        => 'boolean',
            'description'      => 'encrypted',
            'notes'            => 'encrypted',
            'start_date'       => 'date:Y-m-d',
            'end_date'         => 'date:Y-m-d',
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

    public function isExpired(): bool
    {
        return $this->end_date !== null && $this->end_date->isPast();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
