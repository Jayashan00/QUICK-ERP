import { apiClient } from '@/core/api/apiClient';
import type { AiChatResponse } from '../types';

export const aiAssistantService = {
  async chat(message: string, conversationId: string | null, currentBranchId: string | null): Promise<AiChatResponse> {
    const response = await apiClient.post<AiChatResponse>('/ai/chat', {
      message,
      conversationId: conversationId || undefined,
      currentBranchId: currentBranchId || undefined,
    });
    return response.data;
  },

  async clear(conversationId: string, currentBranchId: string | null): Promise<void> {
    await apiClient.delete<void>(`/ai/conversations/${encodeURIComponent(conversationId)}`, {
      params: currentBranchId ? { currentBranchId } : undefined,
    });
  },
};
