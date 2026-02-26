/**
 * notifications.api.ts
 * Notification API calls.
 */

import axiosInstance from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse, Notification } from '@/shared/types';

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
