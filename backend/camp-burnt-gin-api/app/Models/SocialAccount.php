<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * SocialAccount — an OAuth identity linked to a system user.
 *
 * Each row represents one provider → user binding. A single user may have
 * multiple rows (one per provider they have linked), but a given provider_id
 * can only be linked to one user account to prevent identity collisions.
 */
class SocialAccount extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'provider_id',
        'provider_email',
        'provider_name',
        'avatar_url',
        'access_token',
        'refresh_token',
        'token_expires_at',
    ];

    protected $hidden = [
        'access_token',
        'refresh_token',
    ];

    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            // Tokens are sensitive credentials — encrypt at rest
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
