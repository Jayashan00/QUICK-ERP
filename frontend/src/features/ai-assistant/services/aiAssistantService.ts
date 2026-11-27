import { apiClient } from '@/core/api/apiClient';
import type { AiChatResponse, AiConversationDetail, AiConversationSummary } from '../types';

export const aiAssistantService = {
  async chat(message: string, conversationId: string | null, currentBranchId: string | null, signal?: AbortSignal): Promise<AiChatResponse> {
    const response = await apiClient.post<AiChatResponse>('/ai/chat', {
      message,
      conversationId: conversationId || undefined,
      currentBranchId: currentBranchId || undefined,
    }, { signal });
    return response.data;
  },

  async clear(conversationId: string, currentBranchId: string | null): Promise<void> {
    await apiClient.delete<void>(`/ai/conversations/${encodeURIComponent(conversationId)}`, {
      params: currentBranchId ? { currentBranchId } : undefined,
    });
  },

  async list(currentBranchId: string | null, signal?: AbortSignal): Promise<AiConversationSummary[]> {
    const response = await apiClient.get<AiConversationSummary[]>('/ai/conversations', {
      params: { limit: 20, ...(currentBranchId ? { currentBranchId } : {}) }, signal,
    });
    return response.data;
  },

  async conversation(id: string, currentBranchId: string | null, signal?: AbortSignal, beforeId?: number): Promise<AiConversationDetail> {
    const response = await apiClient.get<AiConversationDetail>(`/ai/conversations/${encodeURIComponent(id)}`, {
      params: { limit: 50, ...(currentBranchId ? { currentBranchId } : {}), ...(beforeId ? { beforeId } : {}) }, signal,
    });
    return response.data;
  },

  async create(currentBranchId: string | null): Promise<string> {
    const response = await apiClient.post<{ conversationId: string }>('/ai/conversations', undefined, {
      params: currentBranchId ? { currentBranchId } : undefined,
    });
    return response.data.conversationId;
  },
};
