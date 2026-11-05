import { useCallback, useState } from 'react';
import { ApiError } from '@/core/api/apiError';
import { aiAssistantService } from '../services/aiAssistantService';
import type { AiMessage } from '../types';

export function useAiAssistant(currentBranchId: string | null) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const send = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || isLoading) return;
    const userMessage: AiMessage = { id: crypto.randomUUID(), role: 'user', content: question };
    setMessages((current) => [...current, userMessage]);
    setLastQuestion(question);
    setError(null);
    setIsLoading(true);
    try {
      const response = await aiAssistantService.chat(question, conversationId, currentBranchId);
      setConversationId(response.conversationId);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', content: response.message, data: response.data, source: response.source,
      }]);
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'The AI assistant is unavailable. Try again.';
      setError(message);
      setMessages((current) => current.map((item) => item.id === userMessage.id ? { ...item, failed: true } : item));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, currentBranchId, isLoading]);

  const retry = useCallback(() => {
    if (!lastQuestion || isLoading) return;
    setMessages((current) => {
      let index = -1;
      for (let candidate = current.length - 1; candidate >= 0; candidate -= 1) {
        if (current[candidate].role === 'user' && current[candidate].failed) { index = candidate; break; }
      }
      return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index);
    });
    void send(lastQuestion);
  }, [isLoading, lastQuestion, send]);

  const clear = useCallback(async () => {
    setError(null);
    if (conversationId) {
      try { await aiAssistantService.clear(conversationId, currentBranchId); }
      catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The conversation could not be cleared.'); return; }
    }
    setMessages([]);
    setConversationId(null);
    setLastQuestion(null);
  }, [conversationId, currentBranchId]);

  return { messages, conversationId, isLoading, error, send, retry, clear };
}
