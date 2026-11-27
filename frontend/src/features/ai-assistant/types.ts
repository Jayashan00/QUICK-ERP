export interface AiSource {
  module: string;
  tool: string;
  generatedAt: string;
}

export interface AiChatResponse {
  message: string;
  conversationId: string;
  data?: unknown;
  source?: AiSource;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
  source?: AiSource;
  failed?: boolean;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationDetail {
  conversation: AiConversationSummary;
  messages: Array<{ id: number; role: 'user' | 'assistant'; content: string; createdAt: string }>;
  hasOlderMessages: boolean;
}
