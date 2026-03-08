export type Message = { 
  role:string; 
  content: string;
  time?: string 
};

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  contextSize: number;
  maxTokens: number;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  systemPrompt: string;
  config?: ModelConfig;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}