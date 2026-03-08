import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { updateSystemPrompt, updateModelConfig } from "../store/chatSlice";
import { ModelConfig } from "../type/chat";

export default function PromptEditor() {
  const dispatch = useDispatch();
  const { systemPrompt, config } = useSelector((state: RootState) => state.chat);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(updateSystemPrompt(e.target.value));
  };

  const handleConfigChange = (key: keyof ModelConfig, value: number) => {
    dispatch(updateModelConfig({ [key]: value }));
  };

  return (
    <div>
    <fieldset className="bg-base-200 border-base-300 rounded-box border p-6">
      {/* 系统提示词卡片 */}
      <legend className="fieldset-legend text-base font-bold">系统提示词</legend>
        <textarea
            className="textarea h-24"
            placeholder="例：说话只能押韵"
            value={systemPrompt}
            onChange={handlePromptChange}
        />
        <div className="label">可选</div>
    </fieldset>
    <fieldset className="bg-base-200 border-base-300 rounded-box border p-6">
        <legend className="fieldset-legend text-base font-bold">生成参数</legend>
        <div className="space-y-2">
            
        </div>
        <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">Temperature</label>
            <div className="badge badge-primary badge-xs">
                {(config?.temperature ?? 0.7).toFixed(1)}
            </div>
        </div>
        <input type="range" min="0" max="2.0" step="0.1" value={config?.temperature ?? 0.7}  className="range range-primary range-xs"
        onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))} />

        <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">Top P</label>
            <div className="badge badge-secondary badge-xs">
                {(config?.topP ?? 0.9).toFixed(2)}
            </div>
        </div>
        <input type="range" min="0" max="1.0" step="0.05" value={config?.topP ?? 0.9}   className="range range-secondary range-xs"
        onChange={(e) => handleConfigChange('topP', parseFloat(e.target.value))} />

        <div className="flex justify-between items-center mb-1">
            <label className="label p-0 m-0">重复惩罚</label>
            <div className="badge badge-accent badge-xs">
                {(config?.repeatPenalty ?? 1.1).toFixed(1)}
            </div>
        </div>
        <input type="range" min="1" max="2" step="0.1" value={config?.repeatPenalty ?? 1.1}   className="range range-accent range-xs"
        onChange={(e) => handleConfigChange('repeatPenalty', parseFloat(e.target.value))} />

        <label className="label p-0 m-0">上下文长度</label>
        <input
        type="number"
        className="input validator"
        required
        placeholder="请输入上下文长度"
        min="1"
        max="8192"
        title="请输入1-8192范围内的数字"
        value={config?.contextSize || 4096}
        onChange={(e) => handleConfigChange('contextSize', parseInt(e.target.value))}
        />

        <label className="label p-0 m-0">Max tokens</label>
        <input
        type="number"
        className="input validator"
        required
        placeholder="请输入最大 Token 数"
        min="1"
        max="32768"
        title="请输入1-32768范围内的数字"
        value={config?.maxTokens || 2048}
                onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
        />
    </fieldset>
    </div>
  );
}