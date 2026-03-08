<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
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
 *   GET    /api/inbox/messages/{message}/attachments/{id}         — download file
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
            'data'    => $messages->items(),
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

            return response()->json([
                'success' => true,
                'data'    => $message,
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
            'data'    => $message,
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
     * GET /api/inbox/messages/{message}/attachments/{document}
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

            // Stream the file from local storage using the stored internal path
            return response()->download(
                storage_path('app/' . $document->path),
                // Use the original human-readable filename the user uploaded
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
}
