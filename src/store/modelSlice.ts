import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {type GGUFFile ,type ModelState}from"../type/model"

const initialState: ModelState = {
  folder:'F:/lm-STUDIO/publisher/model',
  files: [],
  selected: null,
  hasLoaded:false
};

const modelSlice = createSlice({
  name: "model",
  initialState,
  reducers: {
    setFolder(state, action: PayloadAction<string>) {
      state.folder = action.payload;
    },
    setFiles: (state, action: PayloadAction<GGUFFile[]>) => {
      state.files = action.payload;
    },
    selectFile: (state, action: PayloadAction<GGUFFile>) => {
      state.selected = action.payload;
    },
    setHasLoaded:(state,action:PayloadAction<boolean>)=>{
      state.hasLoaded=action.payload;
    }
  },
});



export const { setFolder,setFiles, selectFile,setHasLoaded } = modelSlice.actions;
export default modelSlice.reducer;
