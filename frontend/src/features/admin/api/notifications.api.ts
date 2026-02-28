/**
 * notifications.api.ts
 * Notification API calls and notification preference management.
 */

import axiosInstance from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse, Notification } from '@/shared/types';

export interface NotificationPreferences {
  application_updates: boolean;
  announcements: boolean;
  messages: boolean;
  deadlines: boolean;
}

/** GET /api/notifications */
export async function getNotifications(): Promise<PaginatedResponse<Notification>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Notification>>(
    '/notifications'
  );
  return data;
}

/** PUT /api/notifications/:id/read */
export async function markNotificationRead(
  id: number
): Promise<ApiResponse<Notification>> {
  const { data } = await axiosInstance.put<ApiResponse<Notification>>(
    `/notifications/${id}/read`
  );
  return data;
}

/** PUT /api/notifications/read-all */
export async function markAllNotificationsRead(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.put<ApiResponse<null>>(
    '/notifications/read-all'
  );
  return data;
}

/** GET /api/profile/notification-preferences */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await axiosInstance.get<ApiResponse<NotificationPreferences>>(
    '/profile/notification-preferences'
  );
  return data.data;
}

/** PUT /api/profile/notification-preferences */
export async function updateNotificationPreference(
  key: keyof NotificationPreferences,
  value: boolean
): Promise<NotificationPreferences> {
  const { data } = await axiosInstance.put<ApiResponse<NotificationPreferences>>(
    '/profile/notification-preferences',
    { [key]: value }
  );
  return data.data;
}
