import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UIState {
  drafts: Record<string, string>;
  lastSelectedSessionId: string | null;
}

const initialState: UIState = {
  drafts: {},
  lastSelectedSessionId: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setDraft(state, action: PayloadAction<{ key: string; text: string }>) {
      state.drafts[action.payload.key] = action.payload.text;
    },
    clearDraft(state, action: PayloadAction<string>) {
      delete state.drafts[action.payload];
    },
    setLastSelectedSessionId(state, action: PayloadAction<string | null>) {
      state.lastSelectedSessionId = action.payload;
    },
  },
});

export const { setDraft, clearDraft, setLastSelectedSessionId } = uiSlice.actions;
export default uiSlice.reducer;