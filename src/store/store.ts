import { configureStore } from "@reduxjs/toolkit";
import modelReducer from "../store/modelSlice";
import chatReducer from"../store/chatSlice";
import uiReducer from "../store/uiSlice";
import characterReducer from "../store/characterSlice";
import worldReducer from "../store/worldSlice";
import arenaReducer from "../store/arenaSlice";

export const store = configureStore({
  reducer: {
    model: modelReducer,
    chat: chatReducer,
    ui: uiReducer,
    character: characterReducer,
    world: worldReducer,
    arena: arenaReducer,
  },
});

// 推导类型（方便 TS）
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
