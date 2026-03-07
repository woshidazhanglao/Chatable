import { configureStore } from "@reduxjs/toolkit";
import modelReducer from "../store/modelSlice";
import chatReducer from"../store/chatSlice";
import uiReducer from "../store/uiSlice";

export const store = configureStore({
  reducer: {
    model: modelReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
});

// 推导类型（方便 TS）
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
