<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FormTemplate model — application form templates uploaded by super admins.
 */
class FormTemplate extends Model
{
    protected $fillable = [
        'created_by',
        'name',
        'file_name',
        'storage_path',
        'file_type',
        'is_active',
        'version',
        'session_id',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'version'   => 'integer',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────────────────────────────────────

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'session_id');
    }
}
