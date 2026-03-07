import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { type GGUFFile, type ModelState, type ModelProvider, type ThirdPartyType } from "../type/model";

const initialState: ModelState = {
  folder: 'F:/React/project/model',
  files: [],
  selected: null,
  hasLoaded: false,
  provider: "local",
  thirdPartyType: "deepseek",
  apiKey: ""
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
    selectFile: (state, action: PayloadAction<GGUFFile | null>) => {
      state.selected = action.payload;
    },
    setHasLoaded: (state, action: PayloadAction<boolean>) => {
      state.hasLoaded = action.payload;
    },
    setProvider: (state, action: PayloadAction<ModelProvider>) => {
      state.provider = action.payload;
    },
    setThirdPartyType: (state, action: PayloadAction<ThirdPartyType>) => {
      state.thirdPartyType = action.payload;
    },
    setApiKey: (state, action: PayloadAction<string>) => {
      state.apiKey = action.payload;
    }
  },
});

export const { 
  setFolder, 
  setFiles, 
  selectFile, 
  setHasLoaded, 
  setProvider, 
  setThirdPartyType,
  setApiKey 
} = modelSlice.actions;
export default modelSlice.reducer;

