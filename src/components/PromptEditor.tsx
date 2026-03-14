import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { updateSystemPrompt, updateModelConfig, setCharacterId, setWorldId } from "../store/chatSlice";
import { ModelConfig } from "../type/chat";
import { User, Globe } from "lucide-react";

export default function PromptEditor() {
  const dispatch = useDispatch();
  const { systemPrompt, config, characterId, worldId } = useSelector((state: RootState) => state.chat);
  const { characters } = useSelector((state: RootState) => state.character);
  const { books: worldBooks } = useSelector((state: RootState) => state.world);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(updateSystemPrompt(e.target.value));
  };

  const handleConfigChange = (key: keyof ModelConfig, value: number) => {
    dispatch(updateModelConfig({ [key]: value }));
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 custom-scrollbar">
      {/* 角色与世界关联 - 保持新功能但使用用户喜欢的 fieldset 风格 */}
      <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
        <legend className="fieldset-legend text-base font-bold">会话关联</legend>
        <div className="space-y-4 w-full">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> 关联角色
              </span>
            </label>
            <select 
              className="select select-bordered select-sm w-full"
              value={characterId || ""}
              onChange={(e) => dispatch(setCharacterId(e.target.value || undefined))}
            >
              <option value="">无关联角色</option>
              {characters.map(char => (
                <option key={char.id} value={char.id}>{char.name}</option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-medium flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> 关联世界书
              </span>
            </label>
            <select 
              className="select select-bordered select-sm w-full bg-gray-50/50"
              value={worldId || ""}
              onChange={(e) => dispatch(setWorldId(e.target.value || undefined))}
            >
              <option value="">无关联世界书</option>
              {worldBooks.map(book => (
                <option key={book.id} value={book.id}>{book.name}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* 系统提示词 - 恢复原样式 */}
      <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
        <legend className="fieldset-legend text-base font-bold">系统提示词</legend>
        <textarea
          className="textarea h-32 w-full"
          placeholder="例：说话只能押韵"
          value={systemPrompt}
          onChange={handlePromptChange}
        />
        <div className="label">可选</div>
      </fieldset>

      {/* 生成参数 - 恢复原样式 */}
      <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-6">
        <legend className="fieldset-legend text-base font-bold">生成参数</legend>
        
        <div className="space-y-2 w-full">
          <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">Temperature</label>
            <div className="badge badge-primary badge-xs">
              {(config?.temperature ?? 0.7).toFixed(1)}
            </div>
          </div>
          <input 
            type="range" min="0" max="2.0" step="0.1" 
            value={config?.temperature ?? 0.7} 
            className="range range-primary range-xs"
            onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))} 
          />

          <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">Top P</label>
            <div className="badge badge-secondary badge-xs">
              {(config?.topP ?? 0.9).toFixed(2)}
            </div>
          </div>
          <input 
            type="range" min="0" max="1.0" step="0.05" 
            value={config?.topP ?? 0.9} 
            className="range range-secondary range-xs"
            onChange={(e) => handleConfigChange('topP', parseFloat(e.target.value))} 
          />

          <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">Top K</label>
            <div className="badge badge-info badge-xs">
              {config?.topK ?? 40}
            </div>
          </div>
          <input 
            type="range" min="1" max="100" step="1" 
            value={config?.topK ?? 40} 
            className="range range-info range-xs"
            onChange={(e) => handleConfigChange('topK', parseInt(e.target.value))} 
          />

          <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">重复惩罚</label>
            <div className="badge badge-accent badge-xs">
              {(config?.repeatPenalty ?? 1.1).toFixed(1)}
            </div>
          </div>
          <input 
            type="range" min="1" max="2" step="0.1" 
            value={config?.repeatPenalty ?? 1.1} 
            className="range range-accent range-xs"
            onChange={(e) => handleConfigChange('repeatPenalty', parseFloat(e.target.value))} 
          />

          <label className="label p-0 m-0 mt-2">上下文长度</label>
          <input
            type="number"
            className="input input-bordered input-sm w-full"
            placeholder="请输入上下文长度"
            value={config?.contextSize ?? 4096}
            onChange={(e) => handleConfigChange('contextSize', parseInt(e.target.value))}
          />

          <label className="label p-0 m-0 mt-2">Max tokens</label>
          <input
            type="number"
            className="input input-bordered input-sm w-full"
            placeholder="请输入最大 Token 数"
            value={config?.maxTokens ?? 2048}
            onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
          />
        </div>
      </fieldset>
    </div>
  );
}