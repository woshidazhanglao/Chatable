import { configureStore } from "@reduxjs/toolkit";
import modelReducer from "../store/modelSlice";
import chatReducer from"../store/chatSlice"

export const store = configureStore({
  reducer: {
    model: modelReducer, // 注册 modelSlice
    chat:chatReducer,
  },
});

// 推导类型（方便 TS）
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
