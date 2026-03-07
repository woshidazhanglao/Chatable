import axios from "axios";
import { type GGUFFile } from "../type/model";
import { setFiles } from "../store/modelSlice";
import { AppDispatch } from "../store/store";
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core";

export const loadFilesUtils = async (path: string, dispatch: AppDispatch) => {
    try {
        if (!path) return;
        const files = await invoke<GGUFFile[]>("list_gguf_files", { folderPath: path });
        dispatch(setFiles(files));
    }
    catch (err) {
        console.error("加载本地文件失败:", err);
        toast.error("加载本地文件失败，请检查路径是否正确");
    }
};

export const loadOllamaModels = async (dispatch: AppDispatch) => {
  try {
    const res = await axios.get("http://localhost:11434/api/tags");
    const models = res.data.models.map((m: any) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
      arch: m.details?.format || "unknown",
      params: m.details?.parameter_size || "unknown",
      quant: m.details?.quantization_level || "unknown"
    }));
    dispatch(setFiles(models));
  } catch (err) {
    console.error("加载 Ollama 模型失败", err);
    toast("请确认 Ollama 已启动 (localhost:11434)");
  }
};