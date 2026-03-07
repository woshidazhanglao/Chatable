import { useState, useEffect } from "react";
import "../App.css"
import { useDispatch, useSelector } from "react-redux";
import { setFolder, setProvider, selectFile, setHasLoaded, setThirdPartyType, setApiKey } from "../store/modelSlice";
import { RootState } from "../store/store";
import { toast } from "sonner"
import { loadFilesUtils, loadOllamaModels } from "../utils/model";
import { open } from "@tauri-apps/plugin-dialog";
import { ModelProvider, GGUFFile, ThirdPartyType } from "../type/model";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_FOLDER = "F:/React/project/model";

export default function ModelPage() {
  const { folder, files, provider, selected, hasLoaded, thirdPartyType, apiKey } = useSelector((state: RootState) => state.model);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleProviderChange = (newProvider: ModelProvider) => {
    if (newProvider !== provider) {
      dispatch(setProvider(newProvider));
      // 只有在手动切换提供商时才重置状态
      dispatch(selectFile(null));
      dispatch(setHasLoaded(false));
    }
  };

  useEffect(() => {
    refreshModels();
  }, [provider]);

  useEffect(() => {
    if (provider === "local" && folder) {
      loadFiles(folder);
    }
  }, [folder]);

  const refreshModels = async () => {
    if (provider === "third-party") {
      // 第三方不显示本地列表，无需同步 files
      return;
    }
    setLoading(true);
    if (provider === "ollama") {
      await loadOllamaModels(dispatch);
    } else if (provider === "local") {
      if (folder) {
        await loadFiles(folder);
      } else {
        await loadFiles(DEFAULT_FOLDER);
      }
    }
    setLoading(false);
  };

  const loadFiles = async (path: string) => {
    if (!path) return;
    await loadFilesUtils(path, dispatch);
  };

  const handleSelectFolder = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        defaultPath: folder || DEFAULT_FOLDER,
      });
      
      if (selectedPath) {
        const path = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
        if (path) {
          // 修改路径时，先取消当前载入的模型
          if (provider === "local") {
            await invoke("unload_local_model");
            dispatch(setHasLoaded(false));
            dispatch(selectFile(null));
          }
          dispatch(setFolder(path));
          toast.success(`已切换至新文件夹: ${path}`);
        }
      }
    } catch (err) {
      console.error("选择文件夹失败", err);
      toast.error("无法打开对话框，请确保插件已在 Rust 中初始化");
    }
  };

  const handleResetFolder = async () => {
    if (provider === "local") {
      await invoke("unload_local_model");
      dispatch(setHasLoaded(false));
      dispatch(selectFile(null));
    }
    dispatch(setFolder(DEFAULT_FOLDER));
  };

  const handleModelClick = async (file: GGUFFile) => {
    dispatch(selectFile(file));
    
    if (provider === "local") {
      setLoading(true);
      try {
        const filePath = folder + '/' + file.name;
        // 使用 tauri invoke 代替 axios
        const res = await invoke<string>("load_local_model", { path: filePath });
        dispatch(setHasLoaded(true));
        toast.success(`本地模型加载成功: ${file.name}`);
        console.log(res);
      } catch (err: any) {
        console.error("加载模型失败:", err);
        toast.error(`加载本地模型失败: ${err}`);
      } finally {
        setLoading(false);
      }
    } else if (provider === "ollama") {
      dispatch(setHasLoaded(true));
      toast.success(`已切换至 Ollama 模型: ${file.name}`);
    } else {
      dispatch(setHasLoaded(true));
      toast.success(`已选择云端模型: ${file.name}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">服务提供商:</span>
            <select 
              className="select select-bordered select-sm w-40"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ModelProvider)}
            >
              <option value="local">本地 GGUF</option>
              <option value="ollama">Ollama</option>
              <option value="third-party">第三方 API</option>
            </select>
          </div>

          {provider === "third-party" && (
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
              <select 
                className="select select-bordered select-sm w-32"
                value={thirdPartyType}
                onChange={(e) => dispatch(setThirdPartyType(e.target.value as ThirdPartyType))}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="other">其他</option>
              </select>
              <input 
                type="password"
                className="input input-bordered input-sm w-64"
                placeholder="请输入 API Key"
                value={apiKey}
                onChange={(e) => dispatch(setApiKey(e.target.value))}
              />
            </div>
          )}

          {provider !== "third-party" && (
            <button className="btn btn-primary btn-sm" onClick={refreshModels}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              刷新
            </button>
          )}
        </div>

        {provider === "local" && (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/><path d="M13 3v6h6"/></svg>
              <input
                type="text"
                value={folder}
                readOnly
                className="bg-transparent border-none outline-none flex-1 text-sm text-gray-600"
              />
            </div>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-neutral btn-outline">路径管理</div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-48 p-2 shadow-lg border border-gray-100">
                <li onClick={handleSelectFolder}><a>更改路径</a></li>
                <li onClick={handleResetFolder}><a>恢复默认路径</a></li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {provider !== "third-party" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[200px]">
          <table className="table w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-gray-500 font-semibold">名称</th>
                <th className="text-gray-500 font-semibold">架构</th>
                <th className="text-gray-500 font-semibold">参数</th>
                <th className="text-gray-500 font-semibold">大小</th>
                <th className="text-gray-500 font-semibold">量化</th>
                <th className="text-gray-500 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    暂无可用模型，请检查路径或服务状态
                  </td>
                </tr>
              ) : (
                files.map((file, index) => (
                  <tr 
                    key={index} 
                    className={`hover:bg-blue-50 cursor-pointer transition-colors ${selected?.name === file.name && hasLoaded ? 'bg-blue-50' : ''}`}
                    onClick={() => handleModelClick(file)}
                  >
                    <td className="font-medium text-gray-700">
                      <div className="flex items-center gap-2">
                        {selected?.name === file.name && hasLoaded && (
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        )}
                        {file.name}
                      </div>
                    </td>
                    <td className="text-gray-500 text-sm">{file.arch}</td>
                    <td className="text-gray-500 text-sm">{file.params}</td>
                    <td className="text-gray-500 text-sm">{(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB</td>
                    <td className="text-gray-500 text-sm">{file.quant}</td>
                    <td>
                      <button className={`btn btn-xs ${selected?.name === file.name && hasLoaded ? 'btn-success' : 'btn-outline'}`}>
                        {selected?.name === file.name && hasLoaded ? '已载入' : '载入'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {loading && (
            <div className="flex justify-center items-center p-8 bg-white/50 absolute inset-0 z-10">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          )}
        </div>
      )}

      {provider === "third-party" && (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><path d="M12 2v8"/><path d="m16 6-4 4-4-4"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h.01"/><path d="M10 18h.01"/></svg>
          <p>第三方 API 模式下，模型由云端服务提供</p>
          <p className="text-sm">请在上方输入 API Key 并直接前往聊天页面</p>
        </div>
      )}
    </div>
  );
}