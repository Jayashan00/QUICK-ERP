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
