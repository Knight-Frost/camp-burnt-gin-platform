<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\User;
use App\Services\InboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * ConversationController handles HTTP requests for conversation operations.
 *
 * Responsibilities:
 * - Request validation
 * - Policy authorization
 * - Delegating business logic to InboxService
 * - Response formatting
 *
 * All routes require Sanctum authentication and enforce RBAC via policies.
 */
class ConversationController extends Controller
{
    public function __construct(protected InboxService $inboxService)
    {
    }

    /**
     * List conversations for the authenticated user.
     *
     * GET /api/inbox/conversations
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $includeArchived = $request->boolean('include_archived', false);
        $perPage = min($request->integer('per_page', 25), 100);

        $conversations = $this->inboxService->getUserConversations(
            $user,
            $includeArchived,
            $perPage
        );

        return response()->json([
            'success' => true,
            'data' => $conversations->items(),
            'meta' => [
                'current_page' => $conversations->currentPage(),
                'last_page' => $conversations->lastPage(),
                'per_page' => $conversations->perPage(),
                'total' => $conversations->total(),
                'unread_count' => $this->inboxService->getUnreadConversationCount($user),
            ],
        ]);
    }

    /**
     * Create a new conversation.
     *
     * POST /api/inbox/conversations
     *
     * @param Request $request
     * @return JsonResponse
     * @throws ValidationException
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'participant_ids' => 'required|array|min:1|max:10', // Limit participants for security
            'participant_ids.*' => 'required|integer|exists:users,id|distinct', // Prevent duplicates
            'application_id' => 'nullable|integer|exists:applications,id',
            'camper_id' => 'nullable|integer|exists:campers,id',
            'camp_session_id' => 'nullable|integer|exists:camp_sessions,id',
        ]);

        $user = $request->user();

        // Check if participant list contains non-admins (for parent authorization)
        $hasNonAdminParticipants = false;
        if ($user->isParent()) {
            $participantRoles = \App\Models\User::whereIn('id', $validated['participant_ids'])
                ->with('role')
                ->get()
                ->pluck('role.name')
                ->unique();

            $hasNonAdminParticipants = $participantRoles->contains(fn($role) => $role !== 'admin');
        }

        // Authorization check with role validation
        Gate::authorize('create', [Conversation::class, $hasNonAdminParticipants]);

        $conversation = $this->inboxService->createConversation(
            $user,
            $validated['subject'],
            $validated['participant_ids'],
            $validated['application_id'] ?? null,
            $validated['camper_id'] ?? null,
            $validated['camp_session_id'] ?? null
        );

        return response()->json([
            'success' => true,
            'data' => $conversation,
            'message' => 'Conversation created successfully',
        ], 201);
    }

    /**
     * Get a specific conversation.
     *
     * GET /api/inbox/conversations/{conversation}
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $conversation->load(['participants', 'creator', 'lastMessage']);

        $unreadCount = $conversation->getUnreadCountForUser($request->user());

        return response()->json([
            'success' => true,
            'data' => $conversation,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Archive a conversation.
     *
     * POST /api/inbox/conversations/{conversation}/archive
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function archive(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('archive', $conversation);

        $conversation = $this->inboxService->archiveConversation($conversation);

        return response()->json([
            'success' => true,
            'data' => $conversation,
            'message' => 'Conversation archived successfully',
        ]);
    }

    /**
     * Unarchive a conversation.
     *
     * POST /api/inbox/conversations/{conversation}/unarchive
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function unarchive(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('archive', $conversation);

        $conversation = $this->inboxService->unarchiveConversation($conversation);

        return response()->json([
            'success' => true,
            'data' => $conversation,
            'message' => 'Conversation unarchived successfully',
        ]);
    }

    /**
     * Add a participant to a conversation.
     *
     * POST /api/inbox/conversations/{conversation}/participants
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     * @throws ValidationException
     */
    public function addParticipant(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $newParticipant = User::findOrFail($validated['user_id']);

        Gate::authorize('addParticipant', [$conversation, $newParticipant]);

        $this->inboxService->addParticipant($conversation, $newParticipant);

        return response()->json([
            'success' => true,
            'message' => 'Participant added successfully',
        ]);
    }

    /**
     * Remove a participant from a conversation.
     *
     * DELETE /api/inbox/conversations/{conversation}/participants/{user}
     *
     * @param Request $request
     * @param Conversation $conversation
     * @param User $user
     * @return JsonResponse
     */
    public function removeParticipant(
        Request $request,
        Conversation $conversation,
        User $user
    ): JsonResponse {
        Gate::authorize('removeParticipant', [$conversation, $user]);

        $this->inboxService->removeParticipant($conversation, $user);

        return response()->json([
            'success' => true,
            'message' => 'Participant removed successfully',
        ]);
    }

    /**
     * Leave a conversation.
     *
     * POST /api/inbox/conversations/{conversation}/leave
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function leave(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();

        Gate::authorize('leave', $conversation);

        $this->inboxService->removeParticipant($conversation, $user);

        return response()->json([
            'success' => true,
            'message' => 'Left conversation successfully',
        ]);
    }

    /**
     * Soft delete a conversation (admin only).
     *
     * DELETE /api/inbox/conversations/{conversation}
     *
     * @param Request $request
     * @param Conversation $conversation
     * @return JsonResponse
     */
    public function destroy(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('delete', $conversation);

        $this->inboxService->deleteConversation($conversation);

        return response()->json([
            'success' => true,
            'message' => 'Conversation deleted successfully',
        ]);
    }
}
