<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for user notification management.
 *
 * Handles listing, reading, and managing notifications.
 * Formats database notifications into a frontend-consumable shape,
 * extracting the human-readable title and message from each record's
 * data payload so the Recent Updates widget can render them directly.
 *
 * Implements FR-27, FR-28, FR-29: Notification requirements.
 */
class NotificationController extends Controller
{
    /**
     * List notifications for the current user.
     *
     * Returns a formatted list of notifications with title, message, and
     * read status extracted from the stored notification data.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $request->boolean('unread_only')
            ? $user->unreadNotifications()
            : $user->notifications();

        $paginated = $query->latest()->paginate(15);

        $items = collect($paginated->items())->map(function ($notification) {
            $data = $notification->data ?? [];

            return [
                'id'         => $notification->id,
                'type'       => $data['type'] ?? class_basename($notification->type),
                'title'      => $data['title'] ?? '',
                'message'    => $data['message'] ?? '',
                'data'       => $data,
                'read_at'    => $notification->read_at?->toIso8601String(),
                'created_at' => $notification->created_at->toIso8601String(),
            ];
        })->values()->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
                'unread_count' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        $notificationModel = $request->user()
            ->notifications()
            ->where('id', $notification)
            ->first();

        if (! $notificationModel) {
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

    /**
     * Delete all notifications for the current user.
     */
    public function deleteAll(Request $request): JsonResponse
    {
        $request->user()->notifications()->delete();

        return response()->json([
            'message' => 'All notifications cleared.',
        ]);
    }
}
