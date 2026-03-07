import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { setApiKey } from "../store/modelSlice";

export default function SettingPage() {
  const dispatch = useDispatch();
  const { provider, apiKey, thirdPartyType } = useSelector((state: RootState) => state.model);

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">系统设置</h1>
      
      <div className="space-y-4">
        <div className="alert shadow-sm bg-blue-50 border-blue-100">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-blue-500 shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="text-sm text-blue-700">提示：服务提供商和路径管理已移至「模型」页面以方便快速切换。</span>
        </div>

        {provider === "third-party" && (
          <fieldset className="fieldset bg-white p-4 rounded-xl border border-gray-100">
            <legend className="fieldset-legend font-semibold">{thirdPartyType?.toUpperCase()} API 配置</legend>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">API Key (已与模型页面同步)</label>
              <input 
                type="password"
                className="input input-bordered w-full"
                placeholder="请输入 API Key"
                value={apiKey}
                onChange={(e) => dispatch(setApiKey(e.target.value))}
              />
            </div>
          </fieldset>
        )}
        
        <div className="card bg-base-100 shadow-sm border border-gray-100 p-4">
          <h3 className="font-semibold mb-2">关于项目</h3>
          <p className="text-sm text-gray-500">这是一个基于 Tauri 和 llama-cpp 的本地 AI 聊天客户端。</p>
        </div>
      </div>
    </div>
  );
}