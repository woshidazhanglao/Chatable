import { useState, useEffect } from "react";
import "../App.css"
import { useDispatch, useSelector } from "react-redux";
import { setFolder, setProvider, selectFile, setHasLoaded, setThirdPartyType, setApiKey, setApiUrl, setModelName } from "../store/modelSlice";
import { RootState } from "../store/store";
import { toast } from "sonner"
import { loadFilesUtils, loadOllamaModels } from "../utils/model";
import { open } from "@tauri-apps/plugin-dialog";
import { ModelProvider, GGUFFile } from "../type/model";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_FOLDER = "F:/React/project/model";

export default function ModelPage() {
  const { folder, files, provider, selected, hasLoaded, thirdPartyType, apiKey, apiUrl, modelName } = useSelector((state: RootState) => state.model);
  const [loading, setLoading] = useState(false);
  const [thirdPartyModels, setThirdPartyModels] = useState<string[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const dispatch = useDispatch();


  const handleProviderChange = (newProvider: ModelProvider) => {
    if (newProvider !== provider) {
      dispatch(setProvider(newProvider));
      // 只有在手动切换提供商时才重置状态
      dispatch(selectFile(null));
      
      if (newProvider === "third-party") {
        dispatch(setHasLoaded(true));
      } else {
        dispatch(setHasLoaded(false));
      }
    }
  };

  const fetchThirdPartyModels = async (url: string, key: string) => {
    if (!url || !key) {
      setThirdPartyModels([]);
      return;
    }
    setLoading(true);
    try {
      const models = await invoke<string[]>("list_third_party_models", { 
        apiUrl: url, 
        apiKey: key 
      });
      setThirdPartyModels(models);
      if (models.length > 0 && modelName && !models.includes(modelName)) {
        dispatch(setModelName(models[0]));
      }
    } catch (err) {
      console.error("获取模型列表失败:", err);
      setThirdPartyModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider === "third-party" && apiUrl && apiKey) {
      const timer = setTimeout(() => {
        fetchThirdPartyModels(apiUrl, apiKey);
      }, 500); // 延迟 500ms 避免输入过于频繁导致重复请求
      return () => clearTimeout(timer);
    } else if (provider === "third-party" && !apiKey) {
      setThirdPartyModels([]);
    }
  }, [apiKey, apiUrl, provider]);

  const handleSelectPreset = async (name: string, url: string, defaultModel: string) => {
    dispatch(setThirdPartyType(name));
    dispatch(setApiUrl(url));
    dispatch(setModelName(defaultModel));
    // 强制关闭下拉菜单
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) activeElement.blur();
    
    // 如果有 API Key，则立即尝试获取模型列表
    if (apiKey) {
      await fetchThirdPartyModels(url, apiKey);
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
            <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">接口地址:</span>
                  <div className="dropdown dropdown-bottom">
                    <input 
                      type="text"
                      className="input input-bordered input-sm w-80"
                      placeholder="输入 API 地址或从下拉菜单选择"
                      value={apiUrl}
                      onChange={(e) => dispatch(setApiUrl(e.target.value))}
                    />
                    <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[10] w-80 p-2 shadow-lg border border-gray-100">
                      <li onClick={() => handleSelectPreset("DeepSeek", "https://api.deepseek.com/v1", "")}>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-bold">DeepSeek</span>
                          <span className="text-xs text-gray-400">https://api.deepseek.com/v1</span>
                        </div>
                      </li>
                      <li onClick={() => handleSelectPreset("OpenAI", "https://api.openai.com/v1", "")}>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-bold">OpenAI</span>
                          <span className="text-xs text-gray-400">https://api.openai.com/v1</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">模型名称:</span>
                  <div className="dropdown dropdown-bottom">
                    <input 
                      type="text"
                      className="input input-bordered input-sm w-48"
                      placeholder={apiKey ? "选择或输入模型" : "输入 Key 后获取模型列表"}
                      value={modelName}
                      onChange={(e) => dispatch(setModelName(e.target.value))}
                    />
                    {thirdPartyModels.length > 0 && (
                      <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[10] w-48 p-2 shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
                        {thirdPartyModels.map((m, i) => (
                          <li key={i} onClick={() => {
                            dispatch(setModelName(m));
                            (document.activeElement as HTMLElement).blur();
                          }}><a>{m}</a></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center">
                    {loading ? (
                      <span className="loading loading-spinner loading-xs text-gray-400"></span>
                    ) : (
                      <button 
                        className="btn btn-ghost btn-xs btn-circle text-gray-400 hover:text-primary" 
                        onClick={() => fetchThirdPartyModels(apiUrl || "", apiKey || "")}
                        disabled={!apiKey || !apiUrl}
                        title="重新获取模型列表"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">API Key:</span>
                <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-gray-300 px-3 py-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    className="bg-transparent border-none outline-none flex-1 text-sm py-1 text-black font-medium"
                    placeholder="请输入 API Key"
                    value={apiKey}
                    onChange={(e) => dispatch(setApiKey(e.target.value))}
                  />
                  {apiKey && (
                    <button 
                      className="btn btn-ghost btn-xs btn-circle text-gray-400 hover:text-error"
                      onClick={() => {
                        dispatch(setApiKey(""));
                        setThirdPartyModels([]);
                      }}
                      title="清空 API Key"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  )}
                  <button 
                    className="btn btn-ghost btn-xs btn-circle text-gray-400"
                    onClick={() => setShowApiKey(!showApiKey)}
                    title={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                  >
                    {showApiKey ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88 3.62 3.62"/><path d="M2 12s3-7 10-7a9.77 9.77 0 0 1 2.1.22"/><path d="M17.35 17.35A9.67 9.67 0 0 1 12 19c-7 0-10-7-10-7a13.13 13.13 0 0 1 1.66-2.04"/><path d="m14.59 9.41-2.3 2.3"/><path d="M12 12.01V12"/><path d="M15.42 15.42a3 3 0 0 1-4.59-4.59"/><path d="M22 12s-3 7-10 7a9.67 9.67 0 0 1-5.13-1.45"/><path d="M19.07 4.93A9.77 9.77 0 0 1 22 12c0 0-3 7-10 7"/><path d="m2 2 20 20"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
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