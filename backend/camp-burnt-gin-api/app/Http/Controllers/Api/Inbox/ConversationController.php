<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
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

        $perPage = min($request->integer('per_page', 25), 100);

        // Folder-based filtering (Phase 8). Falls back to legacy include_archived param.
        $folder = $request->string('folder', 'inbox')->toString();
        $validFolders = ['inbox', 'starred', 'important', 'sent', 'archive', 'trash', 'system', 'all'];
        if (! in_array($folder, $validFolders, true)) {
            $folder = 'inbox';
        }

        // Legacy param compat: include_archived=true → archive folder
        if ($folder === 'inbox' && $request->boolean('include_archived', false)) {
            $folder = 'archive';
        }

        // system_only=1 → system notifications only; system_only=0 → user convs only; absent → null
        $systemOnly = $request->has('system_only')
            ? $request->boolean('system_only')
            : null;

        $conversations = $this->inboxService->getUserConversations(
            $user,
            $perPage,
            $systemOnly,
            $folder
        );

        return response()->json([
            'success' => true,
            'data' => ConversationResource::collection($conversations->items())->resolve($request),
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
            'subject' => 'nullable|string|max:255',
            'category' => 'nullable|string|in:general,medical,application,other',
            'participant_ids' => 'required|array|min:1|max:10', // Limit participants for security
            'participant_ids.*' => 'required|integer|exists:users,id|distinct', // Prevent duplicates
            'application_id' => 'nullable|integer|exists:applications,id',
            'camper_id' => 'nullable|integer|exists:campers,id',
            'camp_session_id' => 'nullable|integer|exists:camp_sessions,id',
        ]);

        $user = $request->user();

        // Check if participant list contains non-admins (for applicant authorization).
        // Both 'admin' and 'super_admin' are considered administrative roles.
        $hasNonAdminParticipants = false;
        if ($user->isApplicant()) {
            $participantRoles = \App\Models\User::whereIn('id', $validated['participant_ids'])
                ->with('role')
                ->get()
                ->pluck('role.name')
                ->unique();

            $hasNonAdminParticipants = $participantRoles->contains(
                fn($role) => !in_array($role, ['admin', 'super_admin'], true)
            );
        }

        // Authorization check with role validation
        Gate::authorize('create', [Conversation::class, $hasNonAdminParticipants]);

        $conversation = $this->inboxService->createConversation(
            $user,
            $validated['subject'] ?? null,
            $validated['participant_ids'],
            $validated['application_id'] ?? null,
            $validated['camper_id'] ?? null,
            $validated['camp_session_id'] ?? null,
            $validated['category'] ?? 'general'
        );

        return response()->json([
            'success' => true,
            'data' => (new ConversationResource($conversation))->resolve($request),
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

        $conversation->load(['participants.role', 'creator', 'lastMessage.sender.role']);

        return response()->json([
            'success' => true,
            'data' => (new ConversationResource($conversation))->resolve($request),
            'meta' => [
                'unread_count' => $conversation->getUnreadCountForUser($request->user()),
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
     * Toggle the starred state for the authenticated user.
     *
     * POST /api/inbox/conversations/{conversation}/star
     */
    public function star(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $isStarred = $this->inboxService->toggleStar($conversation, $request->user());

        return response()->json([
            'success'    => true,
            'is_starred' => $isStarred,
            'message'    => $isStarred ? 'Conversation starred.' : 'Star removed.',
        ]);
    }

    /**
     * Toggle the important state for the authenticated user.
     *
     * POST /api/inbox/conversations/{conversation}/important
     */
    public function important(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $isImportant = $this->inboxService->toggleImportant($conversation, $request->user());

        return response()->json([
            'success'      => true,
            'is_important' => $isImportant,
            'message'      => $isImportant ? 'Marked as important.' : 'Removed from important.',
        ]);
    }

    /**
     * Move a conversation to the authenticated user's trash.
     *
     * POST /api/inbox/conversations/{conversation}/trash
     */
    public function trash(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $this->inboxService->trashConversation($conversation, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Conversation moved to trash.',
        ]);
    }

    /**
     * Restore a conversation from the authenticated user's trash.
     *
     * POST /api/inbox/conversations/{conversation}/restore-trash
     */
    public function restoreFromTrash(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $this->inboxService->restoreFromTrash($conversation, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Conversation restored.',
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
