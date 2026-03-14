import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Character } from "../type/character";

interface CharacterState {
  characters: Character[];
  selectedId: string | null;
}

const initialState: CharacterState = {
  characters: [],
  selectedId: null,
};

const characterSlice = createSlice({
  name: "character",
  initialState,
  reducers: {
    setCharacters(state, action: PayloadAction<Character[]>) {
      state.characters = action.payload;
    },
    addCharacter(state, action: PayloadAction<Character>) {
      state.characters.push(action.payload);
    },
    updateCharacter(state, action: PayloadAction<Character>) {
      const index = state.characters.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.characters[index] = action.payload;
      }
    },
    deleteCharacter(state, action: PayloadAction<string>) {
      state.characters = state.characters.filter(c => c.id !== action.payload);
      if (state.selectedId === action.payload) state.selectedId = null;
    },
    selectCharacter(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
  },
});

export const { setCharacters, addCharacter, updateCharacter, deleteCharacter, selectCharacter } = characterSlice.actions;
export default characterSlice.reducer;