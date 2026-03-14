import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {  ChatSession, Message, ModelConfig } from "../type/chat";

const defaultModelConfig: ModelConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  contextSize: 4096,
  maxTokens: 2048,
};

const initialState: ChatSession = {
  id: "",
  title: "",
  systemPrompt: "",
  config: defaultModelConfig,
  characterId: undefined,
  worldId: undefined,
  messages: [],
  createdAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // 设置当前会话（数据库加载后）
    setSession(state, action: PayloadAction<ChatSession>) {
      const session = action.payload;
      if (!session.config) {
        session.config = defaultModelConfig;
      }
      return session;
    },

    // 更新系统提示词
    updateSystemPrompt(state, action: PayloadAction<string>) {
      state.systemPrompt = action.payload;
    },

    // 更新关联角色
    setCharacterId(state, action: PayloadAction<string | undefined>) {
      state.characterId = action.payload;
    },

    // 更新关联世界书
    setWorldId(state, action: PayloadAction<string | undefined>) {
      state.worldId = action.payload;
    },

    // 更新模型配置
    updateModelConfig(state, action: PayloadAction<Partial<ModelConfig>>) {
      if (!state.config) {
        state.config = defaultModelConfig;
      }
      state.config = { ...state.config, ...action.payload };
    },

    // 添加一条消息
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload);
    },

    // 设置消息列表（用于回退或编辑）
    setMessages(state, action: PayloadAction<Message[]>) {
      state.messages = action.payload;
    },

    // 清空会话（比如退出或新建时）
    clearSession() {
      return initialState;
    },
  },
});

export const { 
  setSession, 
  updateSystemPrompt, 
  setCharacterId,
  setWorldId,
  updateModelConfig, 
  addMessage, 
  setMessages,
  clearSession 
} = chatSlice.actions;
export default chatSlice.reducer;
