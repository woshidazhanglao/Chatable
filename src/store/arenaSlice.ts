import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Message } from "../type/chat";

interface ArenaState {
  charA: string;
  charB: string;
  worldId: string;
  scenario: string;
  sharedHistory: Message[];
  messagesA: Message[];
  messagesB: Message[];
}

const initialState: ArenaState = {
  charA: "",
  charB: "",
  worldId: "",
  scenario: "",
  sharedHistory: [],
  messagesA: [],
  messagesB: [],
};

const arenaSlice = createSlice({
  name: "arena",
  initialState,
  reducers: {
    setArenaConfig(state, action: PayloadAction<Partial<Omit<ArenaState, 'sharedHistory' | 'messagesA' | 'messagesB'>>>) {
      return { ...state, ...action.payload };
    },
    updateSharedHistory(state, action: PayloadAction<Message[]>) {
      state.sharedHistory = action.payload;
    },
    updatePrivateMessages(state, action: PayloadAction<{ turn: "A" | "B"; messages: Message[] }>) {
      if (action.payload.turn === "A") {
        state.messagesA = action.payload.messages;
      } else {
        state.messagesB = action.payload.messages;
      }
    },
    clearArenaHistory(state) {
      state.sharedHistory = [];
      state.messagesA = [];
      state.messagesB = [];
    },
  },
});

export const { setArenaConfig, updateSharedHistory, updatePrivateMessages, clearArenaHistory } = arenaSlice.actions;
export default arenaSlice.reducer;