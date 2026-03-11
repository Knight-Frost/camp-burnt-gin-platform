<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageAttachmentResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * MessageController — handles HTTP requests for individual message operations within conversations.
 *
 * This controller works alongside ConversationController: conversations are the threads,
 * messages are the individual items inside those threads. Every message belongs to one conversation.
 *
 * Responsibilities:
 *   - Validate incoming request data (body length, attachment types/sizes)
 *   - Enforce authorization via Laravel Gate (MessagePolicy)
 *   - Delegate business logic to MessageService
 *   - Return formatted JSON responses
 *
 * All routes require Sanctum token authentication.
 * Idempotency keys on message sends prevent duplicate messages if the frontend retries.
 *
 * Key endpoints:
 *   GET    /api/inbox/conversations/{conversation}/messages       — list messages
 *   POST   /api/inbox/conversations/{conversation}/messages       — send a message
 *   GET    /api/inbox/messages/{message}                          — view + mark read
 *   GET    /api/inbox/messages/unread-count                       — badge count
 *   GET    /api/inbox/messages/{message}/attachments/{documentId} — download file
 *   DELETE /api/inbox/messages/{message}                          — soft-delete (admin)
 */
class MessageController extends Controller
{
    /**
     * Inject MessageService via constructor — business logic lives there.
     */
    public function __construct(protected MessageService $messageService)
    {
    }

    /**
     * List all messages in a conversation, paginated oldest-first.
     *
     * Also returns the unread count for the authenticated user within this conversation
     * so the frontend can update the unread badge without a separate API call.
     *
     * GET /api/inbox/conversations/{conversation}/messages
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        // MessagePolicy::viewAny checks the user is a participant in this conversation
        Gate::authorize('viewAny', [Message::class, $conversation]);

        // Cap per_page at 100 to prevent very large result sets
        $perPage = min($request->integer('per_page', 25), 100);

        // MessageService handles ordering, soft-delete filtering, and read-receipt logic
        $messages = $this->messageService->getConversationMessages(
            $conversation,
            $request->user(),
            $perPage
        );

        return response()->json([
            'success' => true,
            'data'    => collect($messages->items())->map(fn ($msg) => $this->shapeMessage($msg))->all(),
            'meta'    => [
                'current_page' => $messages->currentPage(),
                'last_page'    => $messages->lastPage(),
                'per_page'     => $messages->perPage(),
                'total'        => $messages->total(),
                // How many messages this user hasn't read yet in this conversation
                'unread_count' => $this->messageService->getConversationUnreadCount(
                    $conversation,
                    $request->user()
                ),
            ],
        ]);
    }

    /**
     * Send a new message in a conversation.
     *
     * Attachments are validated for type and size before being stored. An idempotency_key
     * can be supplied by the frontend to safely retry failed sends without creating duplicates
     * (e.g., if the network drops right after the backend receives the request).
     *
     * POST /api/inbox/conversations/{conversation}/messages
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     * @throws ValidationException
     */
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        // MessagePolicy::create verifies the user is an active participant who can send messages
        Gate::authorize('create', [Message::class, $conversation]);

        $validated = $request->validate([
            // 65535 characters = max size of MySQL TEXT column
            'body'            => 'required|string|max:65535',
            // Allow up to 5 files per message; each limited to 10 MB
            'attachments'     => 'nullable|array|max:5',
            'attachments.*'   => 'file|max:10240|mimes:pdf,jpeg,png,gif,doc,docx',
            // Optional client-generated key to prevent duplicate sends on retry
            'idempotency_key' => 'nullable|string|max:64',
        ]);

        try {
            // MessageService handles saving the message, processing attachments, and notifying participants
            $message = $this->messageService->sendMessage(
                $conversation,
                $request->user(),
                $validated['body'],
                $validated['attachments'] ?? [],
                $validated['idempotency_key'] ?? null
            );

            // Eagerly load relationships so attachments appear in the response immediately
            // for the sender — without this, freshly-saved attachments may not be included.
            $message->load(['sender', 'attachments']);

            return response()->json([
                'success' => true,
                'data'    => $this->shapeMessage($message),
                'message' => 'Message sent successfully',
            ], 201);
        } catch (\Exception $e) {
            // Catch service-layer exceptions (e.g., duplicate idempotency key conflict)
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * View a single message and automatically mark it as read for the requesting user.
     *
     * The read receipt is recorded by MessageService (creates a MessageRead row).
     * This is the primary way the "unread" state clears — viewing marks it read.
     *
     * GET /api/inbox/messages/{message}
     *
     * @param Request $request
     * @param Message $message
     * @return JsonResponse
     */
    public function show(Request $request, Message $message): JsonResponse
    {
        // MessagePolicy::view checks that the user is a participant in the message's conversation
        Gate::authorize('view', $message);

        // Eager-load relationships needed to render the full message view
        $message->load(['sender', 'attachments']);

        // Mark as read — creates a MessageRead record if one doesn't already exist
        $this->messageService->markAsRead($message, $request->user());

        return response()->json([
            'success' => true,
            'data'    => $this->shapeMessage($message),
        ]);
    }

    /**
     * Get the total unread message count across all conversations for the authenticated user.
     *
     * Used to power the inbox badge/counter in the navigation bar.
     *
     * GET /api/inbox/messages/unread-count
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function unreadCount(Request $request): JsonResponse
    {
        // Count messages in all conversations where this user has no MessageRead record
        $count = $this->messageService->getUnreadMessageCount($request->user());

        return response()->json([
            'success'      => true,
            'unread_count' => $count,
        ]);
    }

    /**
     * Download an attachment file from a specific message.
     *
     * Authorization is checked at two levels:
     *   1. MessagePolicy::viewAttachments — the user must be a conversation participant
     *   2. MessageService::accessAttachment — the document must belong to this message
     *
     * Returns a file download response (binary stream) on success, or a 404 JSON error.
     *
     * GET /api/inbox/messages/{message}/attachments/{documentId}
     *
     * @param Request $request
     * @param Message $message
     * @param int $documentId
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
     */
    public function downloadAttachment(
        Request $request,
        Message $message,
        int $documentId
    ) {
        // Verify the user can access attachments on this message
        Gate::authorize('viewAttachments', $message);

        try {
            // accessAttachment confirms the document actually belongs to this message
            $document = $this->messageService->accessAttachment(
                $message,
                $documentId,
                $request->user()
            );

            // Stream the file using the Storage facade so the disk root is resolved
            // correctly. The local disk root is storage/app/private (Laravel 12 default),
            // not storage/app — using storage_path('app/...') would miss the /private/ prefix.
            return Storage::disk($document->disk)->download(
                $document->path,
                // Use the original human-readable filename the user uploaded (decrypted by cast)
                $document->original_filename
            );
        } catch (\Exception $e) {
            // Document not found or doesn't belong to this message
            return response()->json([
                'success' => false,
                'error'   => 'Attachment not found',
            ], 404);
        }
    }

    /**
     * Preview an attachment inline (opens in browser rather than forcing a download).
     *
     * Identical authorization to downloadAttachment but returns
     * Content-Disposition: inline via Storage::response() so the browser
     * can render images and PDFs directly without triggering a file save dialog.
     *
     * GET /api/inbox/messages/{message}/attachments/{documentId}/preview
     *
     * @param Request $request
     * @param Message $message
     * @param int $documentId
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
     */
    public function previewAttachment(
        Request $request,
        Message $message,
        int $documentId
    ) {
        Gate::authorize('viewAttachments', $message);

        try {
            $document = $this->messageService->accessAttachment(
                $message,
                $documentId,
                $request->user()
            );

            return Storage::disk($document->disk)->response(
                $document->path,
                $document->original_filename
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error'   => 'Attachment not found',
            ], 404);
        }
    }

    /**
     * Soft-delete a message (admin only).
     *
     * The message record stays in the database with deleted_at set, but is hidden
     * from all users. Admins can use this to remove inappropriate or accidental messages.
     *
     * DELETE /api/inbox/messages/{message}
     *
     * @param Request $request
     * @param Message $message
     * @return JsonResponse
     */
    public function destroy(Request $request, Message $message): JsonResponse
    {
        // MessagePolicy::delete restricts this to admin roles
        Gate::authorize('delete', $message);

        $this->messageService->deleteMessage($message);

        return response()->json([
            'success' => true,
            'message' => 'Message deleted successfully',
        ]);
    }

    /**
     * Shape a message model into the API response array.
     *
     * Keeps sender fields minimal (only what ThreadView uses) and runs
     * attachments through MessageAttachmentResource so that only the four
     * safe fields (id, original_filename, mime_type, file_size) are exposed —
     * storage internals and PHI audit fields are never leaked to the client.
     */
    private function shapeMessage(Message $message): array
    {
        $sender = null;
        if ($message->sender) {
            $sender = [
                'id'    => $message->sender->id,
                'name'  => $message->sender->name,
                'email' => $message->sender->email,
                'role'  => 'unknown', // role relationship not loaded in message queries
            ];
        }

        return [
            'id'              => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id'       => $message->sender_id,
            'sender'          => $sender,
            'body'            => $message->body,
            'created_at'      => $message->created_at?->toISOString(),
            'attachments'     => MessageAttachmentResource::collection(
                $message->attachments ?? collect()
            )->resolve(),
        ];
    }
}
