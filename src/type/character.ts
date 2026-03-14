export interface Character {
  id: string;
  name: string;
  description: string;
  firstMes: string;
  mesExample: string;
  avatar?: string;
  creatorNotes?: string;
  systemPrompt?: string; // 针对该角色的特定系统提示词
}