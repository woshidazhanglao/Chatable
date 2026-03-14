import { Message, ModelConfig } from "./chat";

export interface ArenaParticipant {
  characterId: string;
  modelConfig: ModelConfig;
  messages: Message[]; // 该角色视角下的私有消息流
}

export interface ArenaSession {
  id: string;
  title: string;
  scenario: string; // 对话场景/开场背景
  worldBookId?: string; // 共享的世界书
  participantA: ArenaParticipant;
  participantB: ArenaParticipant;
  sharedHistory: Message[]; // 用户看到的完整合并对话流
  createdAt: string;
  lastMessageAt: string;
  isActive: boolean; // 是否正在自动对话中
}