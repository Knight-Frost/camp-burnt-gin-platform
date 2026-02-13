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
 * MessageService handles message operations within conversations.
 *
 * Provides business logic for:
 * - Sending messages with idempotency protection
 * - Attaching files to messages via DocumentService
 * - Marking messages as read
 * - Retrieving conversation message history
 *
 * All operations include audit logging and notification delivery.
 */
class MessageService
{
    public function __construct(
        protected DocumentService $documentService,
        protected InboxService $inboxService
    ) {}

    /**
     * Send a message in a conversation.
     *
     * @param Conversation $conversation
     * @param User $sender
     * @param string $body
     * @param array $attachments Array of UploadedFile objects
     * @param string|null $idempotencyKey Unique key to prevent duplicate sends
     * @return Message
     * @throws \Exception
     */
    public function sendMessage(
        Conversation $conversation,
        User $sender,
        string $body,
        array $attachments = [],
        ?string $idempotencyKey = null
    ): Message {
        // Generate idempotency key if not provided
        if (!$idempotencyKey) {
            $idempotencyKey = Str::uuid()->toString();
        }

        return DB::transaction(function () use (
            $conversation,
            $sender,
            $body,
            $attachments,
            $idempotencyKey
        ) {
            // Check for existing message with same idempotency key
            $existingMessage = Message::where('idempotency_key', $idempotencyKey)->first();

            if ($existingMessage) {
                // Return existing message (idempotent behavior)
                return $existingMessage->load(['sender', 'attachments']);
            }

            // Create message
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'idempotency_key' => $idempotencyKey,
            ]);

            // Process attachments if provided
            if (!empty($attachments)) {
                foreach ($attachments as $file) {
                    $this->attachFile($message, $file, $sender);
                }
            }

            // Update conversation timestamp
            $this->inboxService->updateConversationTimestamp($conversation);

            // Get other participants (excluding sender)
            $otherParticipants = $this->inboxService->getParticipantsExcept($conversation, $sender);

            // Notify other participants
            foreach ($otherParticipants as $participant) {
                $participant->notify(new NewMessageNotification($message, $conversation));
            }

            // Audit log
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

            return $message->load(['sender', 'attachments']);
        });
    }

    /**
     * Attach a file to a message.
     *
     * @param Message $message
     * @param UploadedFile $file
     * @param User $uploader
     * @return \App\Models\Document
     * @throws \Exception
     */
    protected function attachFile(Message $message, UploadedFile $file, User $uploader)
    {
        // Validate file
        $this->validateAttachment($file);

        // Upload and scan document using DocumentService
        $result = $this->documentService->upload(
            $file,
            [
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

        // Audit log for attachment
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
     * Validate attachment against security requirements.
     *
     * @param UploadedFile $file
     * @return void
     * @throws \Exception
     */
    protected function validateAttachment(UploadedFile $file): void
    {
        // Check file size (10MB limit)
        if ($file->getSize() > 10485760) {
            throw new \Exception('File size exceeds 10MB limit');
        }

        // Check MIME type
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
     * Get paginated messages for a conversation.
     *
     * @param Conversation $conversation
     * @param User $user
     * @param int $perPage
     * @return LengthAwarePaginator
     */
    public function getConversationMessages(
        Conversation $conversation,
        User $user,
        int $perPage = 25
    ): LengthAwarePaginator {
        $messages = Message::where('conversation_id', $conversation->id)
            ->with(['sender', 'attachments'])
            ->oldest()
            ->paginate($perPage);

        // Mark unread messages as read
        foreach ($messages as $message) {
            if (!$message->isReadBy($user)) {
                $this->markAsRead($message, $user);
            }
        }

        return $messages;
    }

    /**
     * Mark a message as read by a user.
     *
     * @param Message $message
     * @param User $user
     * @return void
     */
    public function markAsRead(Message $message, User $user): void
    {
        // Don't mark own messages as read
        if ($message->sender_id === $user->id) {
            return;
        }

        // Check if already read
        if ($message->isReadBy($user)) {
            return;
        }

        // Create read receipt
        $message->markAsReadBy($user);

        // Audit log
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
     * Get unread message count for a user across all conversations.
     *
     * @param User $user
     * @return int
     */
    public function getUnreadMessageCount(User $user): int
    {
        return Message::whereHas('conversation', function ($query) use ($user) {
            $query->forUser($user)->active();
        })
        ->unreadBy($user)
        ->count();
    }

    /**
     * Get unread message count for a specific conversation.
     *
     * @param Conversation $conversation
     * @param User $user
     * @return int
     */
    public function getConversationUnreadCount(Conversation $conversation, User $user): int
    {
        return $conversation->getUnreadCountForUser($user);
    }

    /**
     * Soft delete a message.
     *
     * Only admins can perform this operation for moderation.
     *
     * @param Message $message
     * @return void
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
     * Access a message attachment and log the access.
     *
     * @param Message $message
     * @param int $documentId
     * @param User $user
     * @return \App\Models\Document
     * @throws \Exception
     */
    public function accessAttachment(Message $message, int $documentId, User $user)
    {
        $document = $message->attachments()->findOrFail($documentId);

        // Audit log for attachment access
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
