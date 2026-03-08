import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { type GGUFFile, type ModelState, type ModelProvider } from "../type/model";

const initialState: ModelState = {
  folder: 'F:/React/project/model',
  files: [],
  selected: null,
  hasLoaded: false,
  provider: "local",
  thirdPartyType: "DeepSeek",
  apiUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  modelName: "deepseek-chat"
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
    setThirdPartyType: (state, action: PayloadAction<string>) => {
      state.thirdPartyType = action.payload;
    },
    setApiUrl: (state, action: PayloadAction<string>) => {
      state.apiUrl = action.payload;
    },
    setApiKey: (state, action: PayloadAction<string>) => {
      state.apiKey = action.payload;
    },
    setModelName: (state, action: PayloadAction<string>) => {
      state.modelName = action.payload;
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
  setApiUrl,
  setApiKey,
  setModelName
} = modelSlice.actions;
export default modelSlice.reducer;

