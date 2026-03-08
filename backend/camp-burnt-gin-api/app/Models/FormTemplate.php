<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FormTemplate model — application form templates uploaded by super admins.
 *
 * Form templates are PDF or document files that applicant families download and fill out
 * as part of the camp application process. Each template is versioned, can be linked to a
 * specific camp session, and can be marked active or inactive to control visibility.
 *
 * Only super_admin users may create or replace form templates (enforced at controller level).
 *
 * Relationships:
 *   - belongs to User (creator via created_by)
 *   - optionally belongs to CampSession (session_id)
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

    /**
     * Cast field types for correct PHP representations.
     *
     * "version" is stored as an integer so numeric comparisons work correctly.
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            // Numeric version allows simple gt/lt comparisons when checking latest version
            'version'   => 'integer',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the super admin user who uploaded this form template.
     *
     * Uses the non-default foreign key "created_by" instead of "user_id".
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the camp session this template is associated with (if any).
     *
     * When null, the template applies globally across all sessions.
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'session_id');
    }
}
