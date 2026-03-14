import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { WorldBook } from "../type/world";

interface WorldState {
  books: WorldBook[];
  selectedId: string | null;
}

const initialState: WorldState = {
  books: [],
  selectedId: null,
};

const worldSlice = createSlice({
  name: "world",
  initialState,
  reducers: {
    setWorldBooks(state, action: PayloadAction<WorldBook[]>) {
      state.books = action.payload;
    },
    addWorldBook(state, action: PayloadAction<WorldBook>) {
      state.books.push(action.payload);
    },
    updateWorldBook(state, action: PayloadAction<WorldBook>) {
      const index = state.books.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        state.books[index] = action.payload;
      }
    },
    deleteWorldBook(state, action: PayloadAction<string>) {
      state.books = state.books.filter(b => b.id !== action.payload);
      if (state.selectedId === action.payload) state.selectedId = null;
    },
    selectWorldBook(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
  },
});

export const { setWorldBooks, addWorldBook, updateWorldBook, deleteWorldBook, selectWorldBook } = worldSlice.actions;
export default worldSlice.reducer;