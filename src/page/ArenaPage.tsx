import { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch, useStore } from "react-redux";
import { RootState } from "../store/store";
import { User, Globe, Play, Square, MessageSquare, Settings2, Trash2 } from "lucide-react";
import { askModelStream } from "../utils/chat";
import { Message } from "../type/chat";
import { toast } from "sonner";
import { setArenaConfig, updateSharedHistory, updatePrivateMessages, clearArenaHistory } from "../store/arenaSlice";

export default function ArenaPage() {
  const dispatch = useDispatch();
  const store = useStore(); // 获取 store 实例以访问最新状态
  const { characters } = useSelector((state: RootState) => state.character);
  const { books: worldBooks } = useSelector((state: RootState) => state.world);
  const { provider, apiKey, selected, apiUrl, modelName, hasLoaded } = useSelector((state: RootState) => state.model as any);
  const { config: defaultConfig } = useSelector((state: RootState) => state.chat);
  
  // 从 Redux 获取持久化状态
  const { 
    charA, charB, worldId, scenario, sharedHistory, messagesA, messagesB 
  } = useSelector((state: RootState) => state.arena);

  const [isFighting, setIsFighting] = useState(false);
  
  // 双方各自的视角上下文使用 Ref 追踪最新的值，以便流式更新
  const messagesARef = useRef<Message[]>(messagesA);
  const messagesBRef = useRef<Message[]>(messagesB);
  const isFightingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 同步 Ref
  useEffect(() => {
    messagesARef.current = messagesA;
    messagesBRef.current = messagesB;
  }, [messagesA, messagesB]);

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sharedHistory]);

  const toggleFighting = () => {
    if (isFighting) {
      isFightingRef.current = false;
      setIsFighting(false);
    } else {
      startDuel();
    }
  };

  const startDuel = async () => {
    if (!charA || !charB) {
      toast.error("请先选择参与互撩的两个角色");
      return;
    }
    if (!scenario.trim()) {
      toast.error("请输入开场白或场景设定");
      return;
    }

    isFightingRef.current = true;
    setIsFighting(true);
    
    // 如果是新开始（历史为空），初始化对话
    if (sharedHistory.length === 0) {
      await runDuelLoop("A", scenario);
    } else {
      // 如果是继续对话，从上一次结束的地方开始
      const lastMsg = sharedHistory[sharedHistory.length - 1];
      const nextTurn = lastMsg.content.startsWith(`${characters.find(c=>c.id===charA)?.name}:`) ? "B" : "A";
      await runDuelLoop(nextTurn, lastMsg.content);
    }
  };

  const runDuelLoop = async (turn: "A" | "B", lastContent: string) => {
    if (!isFightingRef.current) return;

    const currentCharId = turn === "A" ? charA : charB;
    const otherCharId = turn === "A" ? charB : charA;
    const currentChar = characters.find(c => c.id === currentCharId);
    const otherChar = characters.find(c => c.id === otherCharId);
    
    if (!currentChar || !otherChar) return;

    // 1. 构造当前 AI 的视角消息 (从 Store 获取最新私有历史)
    const latestState = store.getState() as RootState;
    const latestPrivateMessages = turn === "A" ? latestState.arena.messagesA : latestState.arena.messagesB;
    const currentPrivateMessages = [...latestPrivateMessages];
    
    // 如果私有历史为空，说明是第一轮，将场景作为 user 消息加入
    if (currentPrivateMessages.length === 0) {
      currentPrivateMessages.push({ role: "user", content: scenario, time: new Date().toLocaleString() });
    } else {
      // 否则将对方上一轮的回复作为 user 消息加入
      // 注意：这里需要确保传递给 AI 的是干净的内容，不带角色名前缀
      let cleanLastContent = lastContent.trim();
      const charAName = characters.find(c => c.id === charA)?.name;
      const charBName = characters.find(c => c.id === charB)?.name;
      const otherName = turn === "A" ? charBName : charAName;
      
      if (otherName) {
        const prefix = `${otherName}:`;
        const prefixAlt = `${otherName}：`;
        if (cleanLastContent.startsWith(prefix)) cleanLastContent = cleanLastContent.slice(prefix.length).trim();
        if (cleanLastContent.startsWith(prefixAlt)) cleanLastContent = cleanLastContent.slice(prefixAlt.length).trim();
      }

      currentPrivateMessages.push({ role: "user", content: cleanLastContent, time: new Date().toLocaleString() });
    }

    // 2. 构造 System Prompt (包含角色设定和 RAG)
    let systemPrompt = `你现在要扮演 ${currentChar.name}。你需要与 ${otherChar.name} 进行对话。
角色设定：
${currentChar.description}

对话示例：
${currentChar.mesExample}

注意事项：
- 严格保持角色性格，不要提及你是 AI。
- 你的回复应该是自然、口语化的。
- 直接输出你的台词和动作，不要在回复开头加上 "${currentChar.name}:" 或任何角色名字。`;

    // 世界书注入
    if (worldId) {
      const book = worldBooks.find(b => b.id === worldId);
      if (book) {
        const triggered = book.entries.filter(e => e.enabled && e.keys.split(/[,，]/).some(k => lastContent.includes(k.trim())));
        if (triggered.length > 0) {
          systemPrompt += "\n\n相关背景知识：\n" + triggered.map(e => e.content).join("\n");
        }
      }
    }

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...currentPrivateMessages
    ];

    // 3. 生成回复
    try {
      let fullResponse = "";
      const tempMsg: Message = { role: "assistant", content: `${currentChar.name}: ...`, time: "思考中..." };
      
      // 关键修复：从 store 获取最新的 sharedHistory
      const currentState = store.getState() as RootState;
      const currentSharedHistory = currentState.arena.sharedHistory;
      
      const newSharedHistory = [...currentSharedHistory, tempMsg];
      dispatch(updateSharedHistory(newSharedHistory));

      const stream = askModelStream(
        fullMessages as any,
        provider,
        apiKey,
        provider === "local" ? selected?.name : modelName,
        apiUrl,
        defaultConfig
      );

      for await (const chunk of stream) {
        if (!isFightingRef.current) break;
        fullResponse += chunk;
        
        // 实时清理回复中的冗余前缀
        let cleanText = fullResponse.trim();
        const prefix = `${currentChar.name}:`;
        const prefixAlt = `${currentChar.name}：`;
        if (cleanText.startsWith(prefix)) cleanText = cleanText.slice(prefix.length).trim();
        if (cleanText.startsWith(prefixAlt)) cleanText = cleanText.slice(prefixAlt.length).trim();

        const updatedHistory = [...newSharedHistory];
        updatedHistory[updatedHistory.length - 1] = { 
          role: "assistant", 
          content: `${currentChar.name}: ${cleanText}`, 
          time: new Date().toLocaleString() 
        };
        dispatch(updateSharedHistory(updatedHistory));
      }

      if (!isFightingRef.current) return;

      // 4. 清理最终回复并更新私有历史
      let finalCleanText = fullResponse.trim();
      const prefix = `${currentChar.name}:`;
      const prefixAlt = `${currentChar.name}：`;
      if (finalCleanText.startsWith(prefix)) finalCleanText = finalCleanText.slice(prefix.length).trim();
      if (finalCleanText.startsWith(prefixAlt)) finalCleanText = finalCleanText.slice(prefixAlt.length).trim();

      const finalResponse = `${currentChar.name}: ${finalCleanText}`;
      const finalPrivateMessages = [...currentPrivateMessages, { role: "assistant", content: finalResponse, time: new Date().toLocaleString() }];
      dispatch(updatePrivateMessages({ turn, messages: finalPrivateMessages }));

      // 5. 递归进入下一轮
      setTimeout(() => {
        runDuelLoop(turn === "A" ? "B" : "A", finalResponse);
      }, 1500); // 稍微加长停顿，显得更自然

    } catch (err: any) {
      toast.error(`对话出错: ${err.message}`);
      setIsFighting(false);
      isFightingRef.current = false;
    }
  };

  const clearHistory = () => {
    dispatch(clearArenaHistory());
    toast.success("历史已清空");
  };

  return (
    <div className="flex h-screen w-full bg-base-100 overflow-hidden">
      {/* 左侧：配置面板 */}
      <div className="w-96 border-r border-base-300 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" /> AI 竞技场
        </h1>

        <div className="space-y-6">
          {/* 角色 A 配置 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend text-sm font-bold text-primary">角色 A (先手)</legend>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text flex items-center gap-2"><User size={14} /> 选择角色</span>
              </label>
              <select 
                className="select select-bordered select-sm w-full"
                value={charA}
                onChange={(e) => dispatch(setArenaConfig({ charA: e.target.value }))}
                disabled={isFighting}
              >
                <option value="">请选择角色...</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </fieldset>

          {/* 角色 B 配置 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend text-sm font-bold text-secondary">角色 B (后手)</legend>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text flex items-center gap-2"><User size={14} /> 选择角色</span>
              </label>
              <select 
                className="select select-bordered select-sm w-full"
                value={charB}
                onChange={(e) => dispatch(setArenaConfig({ charB: e.target.value }))}
                disabled={isFighting}
              >
                <option value="">请选择角色...</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </fieldset>

          {/* 场景与世界书 */}
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
            <legend className="fieldset-legend text-sm font-bold">对话环境</legend>
            <div className="form-control w-full mb-3">
              <label className="label py-1">
                <span className="label-text flex items-center gap-2"><Globe size={14} /> 关联世界书</span>
              </label>
              <select 
                className="select select-bordered select-sm w-full"
                value={worldId}
                onChange={(e) => dispatch(setArenaConfig({ worldId: e.target.value }))}
                disabled={isFighting}
              >
                <option value="">不关联世界书</option>
                {worldBooks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text flex items-center gap-2"><MessageSquare size={14} /> 场景设定/开场白</span>
              </label>
              <textarea 
                className="textarea textarea-bordered h-32 text-sm"
                placeholder="在此输入对话发生的背景、地点、时间以及初始触发事件..."
                value={scenario}
                onChange={(e) => dispatch(setArenaConfig({ scenario: e.target.value }))}
                disabled={isFighting}
              />
            </div>
          </fieldset>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            <button 
              className={`btn flex-1 shadow-lg ${isFighting ? 'btn-error' : 'btn-primary'}`}
              onClick={toggleFighting}
            >
              {isFighting ? (
                <><Square size={18} fill="currentColor" /> 停止对话</>
              ) : (
                <><Play size={18} fill="currentColor" /> 开始互撩</>
              )}
            </button>
            <button 
              className="btn btn-ghost border-base-300 shadow-lg"
              onClick={clearHistory}
              disabled={isFighting || sharedHistory.length === 0}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：对话展示区 */}
      <div className="flex-1 flex flex-col bg-gray-50 relative">
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {/* 占位符或对话流 */}
          {!isFighting && sharedHistory.length === 0 && scenario === "" ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 gap-4">
              <div className="w-24 h-24 border-4 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                <Play size={40} />
              </div>
              <p className="text-xl font-medium">配置角色并输入场景后即可开始</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 场景卡片 */}
              <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-6 italic text-gray-600">
                  <span className="font-bold not-italic block mb-2 flex items-center gap-2 text-primary">
                    <MessageSquare size={16} /> 场景背景
                  </span>
                  {scenario || "暂无场景描述"}
                </div>
              </div>
              
              <div className="divider text-xs text-gray-400">对 话 开 始</div>

              {/* 对话消息流 */}
              {sharedHistory.map((msg, idx) => {
                const isCharA = msg.content.startsWith(`${characters.find(c=>c.id===charA)?.name}:`);
                return (
                  <div key={idx} className={`chat ${isCharA ? 'chat-start' : 'chat-end'}`}>
                    <div className="chat-header opacity-50 text-xs mb-1">
                      {msg.time}
                    </div>
                    <div className={`chat-bubble shadow-md max-w-[80%] ${
                      isCharA ? 'chat-bubble-primary' : 'chat-bubble-secondary'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* 底部状态条 */}
        <div className="h-12 border-t border-base-300 bg-white px-6 flex items-center justify-between text-xs text-gray-500">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              角色 A: {characters.find(c => c.id === charA)?.name || "未选择"}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-secondary"></div>
              角色 B: {characters.find(c => c.id === charB)?.name || "未选择"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isFighting && <span className="loading loading-ring loading-xs text-primary"></span>}
            {isFighting ? "正在热烈互撩中..." : "等待指令"}
          </div>
        </div>
      </div>
    </div>
  );
}
