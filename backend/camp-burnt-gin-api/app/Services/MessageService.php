<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewMessageNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * MessageService — Message Sending, Reading, and Attachment Handling
 *
 * This service handles everything that happens with individual messages inside
 * conversations. While InboxService manages the conversation container,
 * MessageService manages the messages inside those containers.
 *
 * Key responsibilities:
 *  - Send messages with idempotency protection (prevents duplicate sends if the
 *    user double-clicks or a network retry fires)
 *  - Attach files to messages by delegating to DocumentService for validation
 *    and storage
 *  - Mark messages as read and track per-user read receipts
 *  - Return paginated message history (and auto-mark fetched messages as read)
 *  - Soft-delete messages (admin moderation only)
 *  - Log all attachment accesses for HIPAA audit trail compliance
 *
 * All write operations use DB transactions and write to the audit log.
 *
 * Connected services:
 *  - DocumentService: file upload, validation, and MIME scanning for attachments
 *  - InboxService:    updates conversation timestamp and retrieves other participants
 */
class MessageService
{
    /**
     * Inject the two services this class depends on.
     * Laravel's container resolves and provides these automatically.
     */
    public function __construct(
        protected DocumentService $documentService,
        protected InboxService $inboxService
    ) {}

    /**
     * Send a message within a conversation.
     *
     * Idempotency: if a message with the same idempotency key already exists,
     * the existing message is returned instead of creating a duplicate. This
     * handles network retries and double-submit scenarios gracefully.
     *
     * Flow:
     *  1. Generate or use provided idempotency key
     *  2. In a transaction: check for duplicate, create message, handle attachments,
     *     update conversation timestamp, notify other participants
     *  3. Write audit log entry
     *
     * @param  Conversation    $conversation    The conversation to send into
     * @param  User            $sender          The user sending the message
     * @param  string          $body            The message text content
     * @param  array           $attachments     Array of UploadedFile objects (optional)
     * @param  string|null     $idempotencyKey  Unique key to prevent duplicate sends
     * @throws \Exception      If attachment upload fails
     */
    public function sendMessage(
        Conversation $conversation,
        User $sender,
        string $body,
        array $attachments = [],
        ?string $idempotencyKey = null
    ): Message {
        // Generate a random UUID idempotency key if the caller didn't provide one
        if (!$idempotencyKey) {
            $idempotencyKey = Str::uuid()->toString();
        }

        // Wrap the entire send operation in a transaction for atomicity
        return DB::transaction(function () use (
            $conversation,
            $sender,
            $body,
            $attachments,
            $idempotencyKey
        ) {
            // Idempotency check: if a message with this key was already created, return it
            $existingMessage = Message::where('idempotency_key', $idempotencyKey)->first();

            if ($existingMessage) {
                // Return the existing message — safe for the caller to treat as a success
                return $existingMessage->load(['sender', 'attachments']);
            }

            // Create the new message record
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'idempotency_key' => $idempotencyKey,
            ]);

            // Process and upload each attached file through DocumentService
            if (!empty($attachments)) {
                foreach ($attachments as $file) {
                    $this->attachFile($message, $file, $sender);
                }
            }

            // Bump the conversation's last_message_at so it sorts to the top of the inbox
            $this->inboxService->updateConversationTimestamp($conversation);

            // Get all participants except the sender to notify them
            $otherParticipants = $this->inboxService->getParticipantsExcept($conversation, $sender);

            // Send a notification to each participant (email + database)
            foreach ($otherParticipants as $participant) {
                $participant->notify(new NewMessageNotification($message, $conversation));
            }

            // Write an audit log entry recording this send event
            AuditLog::create([
                'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                'user_id' => $sender->id,
                'event_type' => 'message',
                'auditable_type' => Message::class,
                'auditable_id' => $message->id,
                'action' => 'sent',
                'description' => "Message sent in conversation: {$conversation->subject}",
                'new_values' => [
                    'conversation_id' => $conversation->id,
                    // Log body length rather than content to avoid logging PHI in the audit table
                    'body_length' => strlen($body),
                    'attachment_count' => count($attachments),
                ],
                'metadata' => [
                    'conversation_subject' => $conversation->subject,
                    'has_attachments' => !empty($attachments),
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);

            // Return the message with sender and attachments loaded for the API response
            return $message->load(['sender', 'attachments']);
        });
    }

    /**
     * Attach a file to a message by uploading it through DocumentService.
     *
     * DocumentService handles MIME validation, safe filename generation, and
     * security scanning. This method adds the audit log entry specific to
     * the attachment action.
     *
     * @param  Message       $message   The message to attach the file to
     * @param  UploadedFile  $file      The file being attached
     * @param  User          $uploader  The user performing the upload
     * @throws \Exception    If the file fails validation or upload
     */
    protected function attachFile(Message $message, UploadedFile $file, User $uploader)
    {
        // Validate the attachment separately before passing to DocumentService
        $this->validateAttachment($file);

        // Delegate actual upload, scanning, and storage to DocumentService
        $result = $this->documentService->upload(
            $file,
            [
                // Link the document to the message via a polymorphic relationship
                'documentable_type' => \App\Models\Message::class,
                'documentable_id' => $message->id,
                'message_id' => $message->id,
                'document_type' => 'message_attachment',
            ],
            $uploader
        );

        if (!$result['success']) {
            throw new \Exception($result['message'] ?? 'File upload failed');
        }

        $document = $result['document'];

        // Write an attachment-specific audit log entry (separate from the message send event)
        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $uploader->id,
            'event_type' => 'message_attachment',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'attached',
            'description' => "File attached to message {$message->id}",
            'new_values' => [
                'document_id' => $document->id,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $document;
    }

    /**
     * Validate an attachment before passing it to DocumentService.
     *
     * Enforces:
     *  - 10 MB file size limit
     *  - MIME type must be in the allowed list (PDF, JPEG, PNG, GIF, DOC, DOCX)
     *
     * @throws \Exception  With a human-readable message if validation fails
     */
    protected function validateAttachment(UploadedFile $file): void
    {
        // 10 MB in bytes: 10 * 1024 * 1024 = 10,485,760
        if ($file->getSize() > 10485760) {
            throw new \Exception('File size exceeds 10MB limit');
        }

        $allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (!in_array($file->getMimeType(), $allowedMimeTypes)) {
            throw new \Exception('File type not allowed');
        }
    }

    /**
     * Get paginated messages for a conversation and mark unread ones as read.
     *
     * Messages are returned oldest-first (chronological order for chat display).
     * As messages are fetched, any that the user hasn't read yet are automatically
     * marked as read — so opening a conversation clears the unread badge.
     *
     * @param  Conversation  $conversation  The conversation to fetch messages for
     * @param  User          $user          The user viewing the messages
     * @param  int           $perPage       Messages per page (default 25)
     */
    public function getConversationMessages(
        Conversation $conversation,
        User $user,
        int $perPage = 25
    ): LengthAwarePaginator {
        $messages = Message::where('conversation_id', $conversation->id)
            ->with(['sender', 'attachments'])
            ->oldest()   // Chronological order for natural chat reading
            ->paginate($perPage);

        // Auto-mark any unread messages as read for this user
        foreach ($messages as $message) {
            if (!$message->isReadBy($user)) {
                $this->markAsRead($message, $user);
            }
        }

        return $messages;
    }

    /**
     * Mark a specific message as read by a user.
     *
     * Rules:
     *  - A user's own messages are never marked as read (they sent it)
     *  - Already-read messages are skipped (idempotent)
     *  - A read receipt record is created and an audit log entry is written
     */
    public function markAsRead(Message $message, User $user): void
    {
        // Don't mark a message as read if the user sent it themselves
        if ($message->sender_id === $user->id) {
            return;
        }

        // Skip if already read — keeps this method idempotent
        if ($message->isReadBy($user)) {
            return;
        }

        // Create the read receipt record via the model method
        $message->markAsReadBy($user);

        // Log the read event for HIPAA audit trail
        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => 'message',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'read',
            'description' => "Message {$message->id} read by user {$user->id}",
            'metadata' => [
                'conversation_id' => $message->conversation_id,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Get the total count of unread messages for a user across all conversations.
     *
     * Used to drive the unread badge on the inbox navigation icon.
     * Implemented as a single aggregated query — no N+1.
     */
    public function getUnreadMessageCount(User $user): int
    {
        return Message::whereHas('conversation', function ($query) use ($user) {
            // Only count messages in conversations this user is part of and that are active
            $query->forUser($user)->active();
        })
        ->unreadBy($user)  // scope: no read receipt exists for this user
        ->count();
    }

    /**
     * Get the unread message count for a specific conversation and user.
     *
     * Used to show the unread count badge on a specific conversation row.
     */
    public function getConversationUnreadCount(Conversation $conversation, User $user): int
    {
        // Delegates to the model's method for encapsulated query logic
        return $conversation->getUnreadCountForUser($user);
    }

    /**
     * Soft delete a message (admin-only moderation action).
     *
     * Sets deleted_at so the message disappears from conversation views.
     * The database record is retained for audit purposes.
     * Only administrators are permitted to call this method.
     */
    public function deleteMessage(Message $message): void
    {
        $message->delete();

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'message',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'soft_deleted',
            'description' => "Message soft deleted by admin",
            // Capture the message content in old_values for the audit trail
            'old_values' => $message->toArray(),
            'metadata' => [
                'conversation_id' => $message->conversation_id,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Access a message attachment and log the access event.
     *
     * Every time someone downloads an attachment, a HIPAA audit log entry is
     * written recording who accessed which document and when. This is required
     * for healthcare data access traceability.
     *
     * @param  Message  $message     The message that owns the attachment
     * @param  int      $documentId  The ID of the document to access
     * @param  User     $user        The user accessing the attachment
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException  If document not found
     */
    public function accessAttachment(Message $message, int $documentId, User $user)
    {
        // Verify the document belongs to this message (prevents horizontal privilege escalation)
        $document = $message->attachments()->findOrFail($documentId);

        // Log the attachment access — required for HIPAA audit trail
        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => 'message_attachment',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'accessed',
            'description' => "Attachment {$documentId} accessed on message {$message->id}",
            'metadata' => [
                'document_id' => $documentId,
                'conversation_id' => $message->conversation_id,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $document;
    }
}
