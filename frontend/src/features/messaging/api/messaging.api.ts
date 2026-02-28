/**
 * messaging.api.ts
 *
 * All inbox/messaging API calls: conversations, messages, attachments.
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';

export interface Conversation {
  id: number;
  subject?: string;
  category?: MessageCategory;
  participants: ConversationParticipant[];
  last_message?: Message;
  unread_count: number;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: ConversationParticipant;
  body: string;
  read_at?: string;
  created_at: string;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: number;
  name: string;
  mime_type: string;
  size: number;
}

export type MessageCategory = 'general' | 'medical' | 'application' | 'other';

export interface NewConversationPayload {
  subject?: string;
  participant_ids: number[];
  category?: MessageCategory;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function getConversations(params?: { page?: number; include_archived?: true }): Promise<PaginatedResponse<Conversation>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Conversation>>('/inbox/conversations', { params });
  return data;
}

export async function getConversation(id: number): Promise<Conversation> {
  const { data } = await axiosInstance.get<ApiResponse<Conversation>>(`/inbox/conversations/${id}`);
  return data.data;
}

export async function createConversation(payload: NewConversationPayload): Promise<Conversation> {
  const { data } = await axiosInstance.post<ApiResponse<Conversation>>('/inbox/conversations', payload);
  return data.data;
}

export async function archiveConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/archive`);
}

export async function unarchiveConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/unarchive`);
}

export async function leaveConversation(id: number): Promise<void> {
  await axiosInstance.post(`/inbox/conversations/${id}/leave`);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(conversationId: number, params?: { page?: number }): Promise<PaginatedResponse<Message>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Message>>(
    `/inbox/conversations/${conversationId}/messages`,
    { params }
  );
  return data;
}

export async function sendMessage(conversationId: number, body: string): Promise<Message> {
  const { data } = await axiosInstance.post<ApiResponse<Message>>(
    `/inbox/conversations/${conversationId}/messages`,
    { body }
  );
  return data.data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await axiosInstance.get<ApiResponse<{ count: number }>>('/inbox/messages/unread-count');
  return data.data.count;
}

export async function searchInboxUsers(query: string): Promise<ConversationParticipant[]> {
  const { data } = await axiosInstance.get<ApiResponse<ConversationParticipant[]>>('/inbox/users', { params: { search: query } });
  return data.data;
}

export async function downloadAttachment(messageId: number, documentId: number, name: string): Promise<void> {
  const response = await axiosInstance.get(
    `/inbox/messages/${messageId}/attachments/${documentId}`,
    { responseType: 'blob' }
  );
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
