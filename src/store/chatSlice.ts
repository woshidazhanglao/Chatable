import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {  ChatSession, Message } from "../type/chat";

const initialState: ChatSession = {
  id: "",
  title: "",
  systemPrompt: "",
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
      return action.payload; // 直接覆盖
    },

    // 更新系统提示词
    updateSystemPrompt(state, action: PayloadAction<string>) {
      state.systemPrompt = action.payload;
    },

    // 添加一条消息
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload);
    },

    // 清空会话（比如退出或新建时）
    clearSession() {
      return initialState;
    },
  },
});

export const { setSession, updateSystemPrompt, addMessage, clearSession } =
  chatSlice.actions;
export default chatSlice.reducer;
