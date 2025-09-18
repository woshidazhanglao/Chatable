export type Message = { 
  role:string; 
  content: string;
  time?: string 
};

export interface ChatSession {
  id: string;
  messages: Message[];
  systemPrompt: string;
}