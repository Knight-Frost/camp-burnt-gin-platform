<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Controller for user notification management.
 *
 * Handles listing, reading, and managing notifications.
 * Implements FR-27, FR-28, FR-29: Notification requirements.
 */
class NotificationController extends Controller
{
    /**
     * List notifications for the current user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $user->notifications();

        if ($request->has('unread_only') && $request->boolean('unread_only')) {
            $query = $user->unreadNotifications();
        }

        $notifications = $query->latest()->paginate(15);

        return response()->json([
            'data' => $notifications->items(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'unread_count' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    /**
     * Mark a notification as read.
     */
    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        $notificationModel = $request->user()
            ->notifications()
            ->where('id', $notification)
            ->first();

        if (!$notificationModel) {
            return response()->json([
                'message' => 'Notification not found.',
            ], 404);
        }

        $notificationModel->markAsRead();

        return response()->json([
            'message' => 'Notification marked as read.',
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'message' => 'All notifications marked as read.',
        ]);
    }
}
