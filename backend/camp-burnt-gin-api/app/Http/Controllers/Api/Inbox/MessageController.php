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
 * MessageController handles HTTP requests for message operations.
 *
 * Responsibilities:
 * - Request validation
 * - Policy authorization
 * - Delegating business logic to MessageService
 * - Response formatting
 *
 * All routes require Sanctum authentication and enforce RBAC via policies.
 */
class MessageController extends Controller
{
    public function __construct(protected MessageService $messageService)
    {
    }

    /**
     * List messages for a conversation.
     *
     * GET /api/inbox/conversations/{conversation}/messages
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('viewAny', [Message::class, $conversation]);

        $perPage = min($request->integer('per_page', 25), 100);

        $messages = $this->messageService->getConversationMessages(
            $conversation,
            $request->user(),
            $perPage
        );

        return response()->json([
            'success' => true,
            'data' => $messages->items(),
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'per_page' => $messages->perPage(),
                'total' => $messages->total(),
                'unread_count' => $this->messageService->getConversationUnreadCount(
                    $conversation,
                    $request->user()
                ),
            ],
        ]);
    }

    /**
     * Send a message in a conversation.
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
        Gate::authorize('create', [Message::class, $conversation]);

        $validated = $request->validate([
            'body' => 'required|string|max:65535',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'file|max:10240|mimes:pdf,jpeg,png,gif,doc,docx',
            'idempotency_key' => 'nullable|string|max:64',
        ]);

        try {
            $message = $this->messageService->sendMessage(
                $conversation,
                $request->user(),
                $validated['body'],
                $validated['attachments'] ?? [],
                $validated['idempotency_key'] ?? null
            );

            return response()->json([
                'success' => true,
                'data' => $message,
                'message' => 'Message sent successfully',
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Get a specific message.
     *
     * GET /api/inbox/messages/{message}
     *
     * @param Request $request
     * @param Message $message
     * @return JsonResponse
     */
    public function show(Request $request, Message $message): JsonResponse
    {
        Gate::authorize('view', $message);

        $message->load(['sender', 'attachments']);

        // Mark as read
        $this->messageService->markAsRead($message, $request->user());

        return response()->json([
            'success' => true,
            'data' => $message,
        ]);
    }

    /**
     * Get unread message count for authenticated user.
     *
     * GET /api/inbox/messages/unread-count
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = $this->messageService->getUnreadMessageCount($request->user());

        return response()->json([
            'success' => true,
            'unread_count' => $count,
        ]);
    }

    /**
     * Download a message attachment.
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
        Gate::authorize('viewAttachments', $message);

        try {
            $document = $this->messageService->accessAttachment(
                $message,
                $documentId,
                $request->user()
            );

            return response()->download(
                storage_path('app/' . $document->path),
                $document->original_filename
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Attachment not found',
            ], 404);
        }
    }

    /**
     * Soft delete a message (admin only).
     *
     * DELETE /api/inbox/messages/{message}
     *
     * @param Request $request
     * @param Message $message
     * @return JsonResponse
     */
    public function destroy(Request $request, Message $message): JsonResponse
    {
        Gate::authorize('delete', $message);

        $this->messageService->deleteMessage($message);

        return response()->json([
            'success' => true,
            'message' => 'Message deleted successfully',
        ]);
    }
}
