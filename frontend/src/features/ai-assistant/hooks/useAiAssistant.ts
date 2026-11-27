import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/api/apiError';
import { aiAssistantService } from '../services/aiAssistantService';
import type { AiMessage } from '../types';

/** Keeps transient requests and conversations inside one authenticated scope. */
export function useAiAssistant(currentBranchId: string | null, scopeKey: string) {
  const client = useQueryClient();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setLoadingOlder] = useState(false);
  const scopeRef = useRef(scopeKey);
  const generation = useRef(0);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const historyKey = useMemo(() => ['ai-conversations', scopeKey], [scopeKey]);
  scopeRef.current = scopeKey;

  const history = useQuery({
    queryKey: historyKey,
    queryFn: ({ signal }) => aiAssistantService.list(currentBranchId, signal),
    enabled: isHistoryOpen,
    staleTime: 15_000,
  });

  useEffect(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    pending.current = false;
    setMessages([]);
    setConversationId(null);
    setLastQuestion(null);
    setError(null);
    setIsLoading(false);
    setHistoryOpen(false);
    setHasOlderMessages(false);
    setLoadingOlder(false);
  }, [scopeKey]);

  const newConversation = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    pending.current = false;
    setIsLoading(false);
    setMessages([]);
    setConversationId(null);
    setLastQuestion(null);
    setError(null);
    setHistoryOpen(false);
    setHasOlderMessages(false);
    setLoadingOlder(false);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    generation.current += 1;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const currentGeneration = generation.current;
    const currentScope = scopeKey;
    pending.current = false;
    setIsLoading(true);
    setError(null);
    try {
      const detail = await aiAssistantService.conversation(id, currentBranchId, request.signal);
      if (currentGeneration !== generation.current || currentScope !== scopeRef.current) return;
      setConversationId(detail.conversation.id);
      setMessages(detail.messages.map((item) => ({ id: String(item.id), role: item.role, content: item.content })));
      setHasOlderMessages(detail.hasOlderMessages);
      setLastQuestion(null);
      setHistoryOpen(false);
    } catch (caught) {
      if (request.signal.aborted || currentGeneration !== generation.current || currentScope !== scopeRef.current) return;
      setError(caught instanceof ApiError ? caught.message : 'The conversation could not be opened.');
    } finally {
      if (currentGeneration === generation.current) setIsLoading(false);
    }
  }, [currentBranchId, scopeKey]);

  const loadEarlier = useCallback(async () => {
    const beforeId = Number(messages[0]?.id);
    if (!conversationId || !hasOlderMessages || isLoadingOlder || !Number.isSafeInteger(beforeId)) return;
    const currentGeneration = generation.current;
    const currentScope = scopeKey;
    setLoadingOlder(true);
    try {
      const page = await aiAssistantService.conversation(conversationId, currentBranchId, undefined, beforeId);
      if (currentGeneration !== generation.current || currentScope !== scopeRef.current) return;
      setMessages(current => [...page.messages.map(item => ({ id: String(item.id), role: item.role,
        content: item.content })), ...current]);
      setHasOlderMessages(page.hasOlderMessages);
    } catch (caught) {
      if (currentGeneration === generation.current) setError(caught instanceof ApiError ? caught.message : 'Older messages could not be loaded.');
    } finally {
      if (currentGeneration === generation.current) setLoadingOlder(false);
    }
  }, [conversationId, currentBranchId, hasOlderMessages, isLoadingOlder, messages, scopeKey]);

  const send = useCallback(async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || pending.current || isLoading) return;
    const request = new AbortController();
    controller.current = request;
    const currentGeneration = generation.current;
    const currentScope = scopeKey;
    const userMessage: AiMessage = { id: crypto.randomUUID(), role: 'user', content: question };
    pending.current = true;
    setMessages((current) => [...current, userMessage]);
    setLastQuestion(question);
    setError(null);
    setIsLoading(true);
    try {
      const response = await aiAssistantService.chat(question, conversationId, currentBranchId, request.signal);
      if (request.signal.aborted || currentGeneration !== generation.current || currentScope !== scopeRef.current) return;
      setConversationId(response.conversationId);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', content: response.message, data: response.data, source: response.source,
      }]);
      void client.invalidateQueries({ queryKey: historyKey });
    } catch (caught) {
      if (request.signal.aborted || currentGeneration !== generation.current || currentScope !== scopeRef.current) return;
      const message = caught instanceof ApiError ? caught.message : 'VYRO Assistant is unavailable. Try again.';
      setError(message);
      if (caught instanceof ApiError && caught.code === 'conversation_scope_changed') newConversation();
      else setMessages((current) => current.map((item) => item.id === userMessage.id ? { ...item, failed: true } : item));
    } finally {
      if (currentGeneration === generation.current) { pending.current = false; setIsLoading(false); }
    }
  }, [client, conversationId, currentBranchId, historyKey, isLoading, newConversation, scopeKey]);

  const retry = useCallback(() => {
    if (!lastQuestion || pending.current) return;
    setMessages((current) => {
      let index = -1;
      for (let candidate = current.length - 1; candidate >= 0; candidate -= 1) {
        if (current[candidate].role === 'user' && current[candidate].failed) { index = candidate; break; }
      }
      return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index);
    });
    void send(lastQuestion);
  }, [lastQuestion, send]);

  const deleteConversation = useCallback(async (id: string) => {
    setError(null);
    try {
      await aiAssistantService.clear(id, currentBranchId);
      if (id === conversationId) newConversation();
      void client.invalidateQueries({ queryKey: historyKey });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The conversation could not be deleted.');
    }
  }, [client, conversationId, currentBranchId, historyKey, newConversation]);

  const clear = useCallback(async () => {
    if (conversationId) await deleteConversation(conversationId);
    else newConversation();
  }, [conversationId, deleteConversation, newConversation]);

  return { messages, conversationId, isLoading, error, send, retry, clear, newConversation,
    openConversation, deleteConversation, history, isHistoryOpen, setHistoryOpen,
    hasOlderMessages, isLoadingOlder, loadEarlier };
}
