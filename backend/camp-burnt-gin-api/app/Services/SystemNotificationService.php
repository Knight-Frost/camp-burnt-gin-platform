<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SystemNotificationService
 *
 * Creates system-generated, non-replyable notification conversations.
 * Used for platform events: application status changes, security events,
 * role modifications, and medical provider actions.
 *
 * System notifications:
 * - Have no human creator (created_by_id = null)
 * - Have no human sender   (sender_id = null on the message)
 * - Are not replyable      (enforced by UI + policy)
 * - Appear in the System tab (is_system_generated = true)
 * - Are visible to the affected user and to Admins / Super Admins
 *
 * Event type taxonomy:
 *   application.submitted    | application.approved     | application.rejected
 *   application.status_changed
 *   security.password_changed | security.mfa_enabled     | security.mfa_disabled
 *   security.account_locked
 *   role.changed
 *   medical.provider_link_generated | medical.provider_link_revoked
 */
class SystemNotificationService
{
    // ─── Event type constants ─────────────────────────────────────────────────

    // Application events
    public const APPLICATION_SUBMITTED      = 'application.submitted';
    public const APPLICATION_APPROVED       = 'application.approved';
    public const APPLICATION_REJECTED       = 'application.rejected';
    public const APPLICATION_STATUS_CHANGED = 'application.status_changed';

    // Security events
    public const SECURITY_PASSWORD_CHANGED  = 'security.password_changed';
    public const SECURITY_MFA_ENABLED       = 'security.mfa_enabled';
    public const SECURITY_MFA_DISABLED      = 'security.mfa_disabled';
    public const SECURITY_ACCOUNT_LOCKED    = 'security.account_locked';

    // Role events
    public const ROLE_CHANGED               = 'role.changed';

    // Medical events
    public const MEDICAL_PROVIDER_LINK_GENERATED = 'medical.provider_link_generated';
    public const MEDICAL_PROVIDER_LINK_REVOKED   = 'medical.provider_link_revoked';

    // ─── Category labels ──────────────────────────────────────────────────────

    private const EVENT_CATEGORIES = [
        'application' => 'Application',
        'security'    => 'Security',
        'role'        => 'Role',
        'medical'     => 'Medical',
    ];

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Deliver a system notification to a user.
     *
     * Creates a new system conversation + first message.
     * Each notification is a separate conversation so the user's
     * inbox list shows individual rows per event (Gmail pattern).
     *
     * @param User   $recipient          The user who will receive the notification
     * @param string $eventType          Machine-readable event (use class constants)
     * @param string $subject            Short subject line (shown as conversation title)
     * @param string $body               Full notification body (may contain HTML)
     * @param string|null $relatedType   Optional entity type (e.g. 'App\Models\Application')
     * @param int|null $relatedId        Optional entity ID
     * @param array  $adminVisibleTo     Optional array of User objects that should also see this
     */
    public function notify(
        User $recipient,
        string $eventType,
        string $subject,
        string $body,
        ?string $relatedType = null,
        ?int $relatedId = null,
        array $adminVisibleTo = []
    ): Conversation {
        $category = $this->deriveCategory($eventType);

        return DB::transaction(function () use (
            $recipient, $eventType, $category, $subject, $body,
            $relatedType, $relatedId, $adminVisibleTo
        ) {
            // Create the notification conversation
            $conversation = Conversation::create([
                'created_by_id'         => null,
                'subject'               => $subject,
                'category'              => 'system',
                'is_system_generated'   => true,
                'system_event_type'     => $eventType,
                'system_event_category' => $category,
                'related_entity_type'   => $relatedType,
                'related_entity_id'     => $relatedId,
                'last_message_at'       => now(),
                'is_archived'           => false,
            ]);

            // Add recipient as participant
            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id'         => $recipient->id,
                'joined_at'       => now(),
            ]);

            // Add any additional admin viewers
            foreach ($adminVisibleTo as $adminUser) {
                if ($adminUser instanceof User && $adminUser->id !== $recipient->id) {
                    ConversationParticipant::create([
                        'conversation_id' => $conversation->id,
                        'user_id'         => $adminUser->id,
                        'joined_at'       => now(),
                    ]);
                }
            }

            // Create the system message (no sender)
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_id'       => null,
                'body'            => $body,
                'idempotency_key' => Str::uuid()->toString(),
            ]);

            // Audit log
            AuditLog::create([
                'request_id'     => request()?->header('X-Request-ID', Str::uuid()->toString()) ?? Str::uuid()->toString(),
                'user_id'        => null,
                'event_type'     => 'system_notification',
                'auditable_type' => Conversation::class,
                'auditable_id'   => $conversation->id,
                'action'         => 'system_notification_created',
                'description'    => "System notification created: {$eventType} for user {$recipient->id}",
                'new_values'     => [
                    'event_type'          => $eventType,
                    'category'            => $category,
                    'recipient_id'        => $recipient->id,
                    'related_entity_type' => $relatedType,
                    'related_entity_id'   => $relatedId,
                ],
                'ip_address'     => request()?->ip(),
                'user_agent'     => request()?->userAgent(),
                'created_at'     => now(),
            ]);

            return $conversation->load(['participants.role', 'lastMessage']);
        });
    }

    // ─── Named constructors for each event type ───────────────────────────────

    /**
     * Application submitted by parent.
     */
    public function applicationSubmitted(User $recipient, int $applicationId, string $camperName): Conversation
    {
        return $this->notify(
            recipient:   $recipient,
            eventType:   self::APPLICATION_SUBMITTED,
            subject:     "Application submitted for {$camperName}",
            body:        "<p>Your camp application for <strong>{$camperName}</strong> has been successfully submitted and is now pending review by our team.</p><p>You will be notified when a decision has been made. If you have any questions in the meantime, please contact us through the inbox.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId:   $applicationId,
        );
    }

    /**
     * Application approved by admin.
     */
    public function applicationApproved(User $recipient, int $applicationId, string $camperName): Conversation
    {
        return $this->notify(
            recipient:   $recipient,
            eventType:   self::APPLICATION_APPROVED,
            subject:     "Application approved for {$camperName}",
            body:        "<p>Great news! The camp application for <strong>{$camperName}</strong> has been <strong style=\"color:#16a34a\">approved</strong>.</p><p>Please log in to your portal to review the acceptance details and next steps.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId:   $applicationId,
        );
    }

    /**
     * Application rejected by admin.
     */
    public function applicationRejected(User $recipient, int $applicationId, string $camperName, ?string $notes = null): Conversation
    {
        $noteHtml = $notes ? "<p><em>Reviewer notes: {$notes}</em></p>" : '';
        return $this->notify(
            recipient:   $recipient,
            eventType:   self::APPLICATION_REJECTED,
            subject:     "Application not approved for {$camperName}",
            body:        "<p>We regret to inform you that the camp application for <strong>{$camperName}</strong> was not approved at this time.</p>{$noteHtml}<p>If you have questions, please reach out through the inbox.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId:   $applicationId,
        );
    }

    /**
     * Application status changed to any status.
     */
    public function applicationStatusChanged(User $recipient, int $applicationId, string $camperName, string $newStatus): Conversation
    {
        $statusLabel = ucfirst(str_replace('_', ' ', $newStatus));
        return $this->notify(
            recipient:   $recipient,
            eventType:   self::APPLICATION_STATUS_CHANGED,
            subject:     "Application status updated — {$statusLabel}",
            body:        "<p>The status of the application for <strong>{$camperName}</strong> has been updated to <strong>{$statusLabel}</strong>.</p><p>Log in to your portal to view the full details.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId:   $applicationId,
        );
    }

    /**
     * Password changed by user.
     */
    public function passwordChanged(User $recipient): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_PASSWORD_CHANGED,
            subject:   'Your password was changed',
            body:      '<p>Your account password was successfully updated. If you did not make this change, please contact support immediately and secure your account.</p>',
        );
    }

    /**
     * MFA enabled by user.
     */
    public function mfaEnabled(User $recipient): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_MFA_ENABLED,
            subject:   'Two-factor authentication enabled',
            body:      '<p>Two-factor authentication (2FA) has been <strong>enabled</strong> on your account. Your account is now more secure.</p>',
        );
    }

    /**
     * MFA disabled by user.
     */
    public function mfaDisabled(User $recipient): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_MFA_DISABLED,
            subject:   'Two-factor authentication disabled',
            body:      '<p>Two-factor authentication (2FA) has been <strong>disabled</strong> on your account. We recommend re-enabling it to keep your account secure.</p>',
        );
    }

    /**
     * Account locked after repeated failed login attempts.
     */
    public function accountLocked(User $recipient, int $lockoutMinutes = 5): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_ACCOUNT_LOCKED,
            subject:   'Account temporarily locked',
            body:      "<p>Your account has been temporarily locked for {$lockoutMinutes} minute(s) due to multiple failed login attempts.</p><p>If this was not you, please change your password immediately after the lockout expires.</p>",
        );
    }

    /**
     * Role changed by super admin.
     */
    public function roleChanged(User $recipient, string $oldRole, string $newRole, User $changedBy): Conversation
    {
        $oldLabel = ucwords(str_replace('_', ' ', $oldRole));
        $newLabel = ucwords(str_replace('_', ' ', $newRole));
        return $this->notify(
            recipient:   $recipient,
            eventType:   self::ROLE_CHANGED,
            subject:     "Your account role has been updated",
            body:        "<p>Your account role has been changed from <strong>{$oldLabel}</strong> to <strong>{$newLabel}</strong> by a system administrator.</p><p>Your portal access has been updated accordingly. If you believe this is an error, please contact support.</p>",
            relatedType: 'App\\Models\\User',
            relatedId:   $recipient->id,
        );
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Derive the event category label from the event type string.
     * e.g. 'application.submitted' → 'Application'
     */
    private function deriveCategory(string $eventType): string
    {
        $prefix = explode('.', $eventType)[0] ?? 'system';
        return self::EVENT_CATEGORIES[$prefix] ?? 'System';
    }
}
