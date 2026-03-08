import"../App.css"
import { useState, useRef, useEffect } from "react";
import { type Message, type ChatSession } from "../type/chat";
import { useSelector,useDispatch } from "react-redux";
import { RootState } from "../store/store";
import { askModelStream } from "../utils/chat";
import { toast } from "sonner"
import { addMessage, clearSession, setSession } from "../store/chatSlice";
import { invoke } from "@tauri-apps/api/core";
import { setDraft, clearDraft } from "../store/uiSlice";

interface ChatProps {
  sessionId: string;
  firstQuestion?: string; // 新增
}

export default function Chat({ sessionId,firstQuestion }: ChatProps) {
  const draft = useSelector((state: RootState) => state.ui.drafts[sessionId] || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(draft);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 当会话切换时，加载该会话的草稿
  useEffect(() => {
    setInput(draft);
  }, [sessionId]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loading,setLoading]=useState(false);

  // 本地管理会话元数据，避免 Redux 状态污染
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionCreatedAt, setSessionCreatedAt] = useState("");
  const [sessionSystemPrompt, setSessionSystemPrompt] = useState("");

  // 使用 Ref 实时追踪最新数据，供卸载时的保存逻辑使用，防止 JSON 污染
  const messagesRef = useRef<Message[]>([]);
  const metadataRef = useRef({
    title: "",
    createdAt: "",
    systemPrompt: ""
  });

  const { systemPrompt: currentSystemPrompt, config } = useSelector((state: RootState) => state.chat);
  const { hasLoaded, provider, apiKey, selected, apiUrl, modelName } = useSelector((state: RootState) => state.model);

  const dispatch = useDispatch();
  const loadedSessionIdRef = useRef<string | null>(null);
  
  // 使用 Ref 实时追踪 Redux 状态，确保保存时总是使用最新值，且不触发副作用
  const reduxStateRef = useRef({ systemPrompt: currentSystemPrompt, config });
  useEffect(() => {
    reduxStateRef.current = { systemPrompt: currentSystemPrompt, config };
  }, [currentSystemPrompt, config]);

  // 同步草稿到 Redux
  useEffect(() => {
    dispatch(setDraft({ key: sessionId, text: input }));
  }, [input, sessionId, dispatch]);

  // 更新 Ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    metadataRef.current = {
      title: sessionTitle,
      createdAt: sessionCreatedAt,
      systemPrompt: sessionSystemPrompt
    };
  }, [sessionTitle, sessionCreatedAt, sessionSystemPrompt]);

  // 当提示词或参数修改时，自动同步到本地文件
  useEffect(() => {
    // 关键修复：只有当 Redux 中的数据确实属于当前 sessionId 时，才允许自动保存
    // 防止在切换会话时，旧会话的参数覆盖新会话的配置
    if (sessionId && loadedSessionIdRef.current === sessionId) {
      const timer = setTimeout(() => {
        saveCurrentSession(undefined, true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentSystemPrompt, config, sessionId]);

  // 离开页面或切换会话时持久化
  useEffect(() => {
    // 每次 sessionId 改变时，立即重置加载状态锁
    loadedSessionIdRef.current = null;
    
    return () => {
      // 卸载时保存，必须使用当前正在卸载的 sessionId
      const currentId = sessionId;
      if (currentId && (messagesRef.current.length > 0 || reduxStateRef.current.systemPrompt || reduxStateRef.current.config)) {
        // 构造快照数据进行保存，防止异步干扰
        const sessionToSave: ChatSession = {
          id: currentId,
          systemPrompt: reduxStateRef.current.systemPrompt,
          config: reduxStateRef.current.config,
          messages: messagesRef.current,
          title: metadataRef.current.title || "新会话",
          createdAt: metadataRef.current.createdAt || new Date().toLocaleString(),
          lastMessageAt: metadataRef.current.createdAt || new Date().toLocaleString(),
        };
        invoke("save_session", { session: sessionToSave }).catch(err => console.error("卸载保存失败:", err));
      }
      dispatch(clearSession());
    };
  }, [sessionId, dispatch]);

  const saveCurrentSession = async (updatedMessages?: Message[], isSwitching = false) => {
    if (!sessionId) return;
    
    // 如果是自动保存（非手动发送消息），必须校验加载锁
    if (isSwitching && loadedSessionIdRef.current !== sessionId) return;

    const msgs = updatedMessages ?? messagesRef.current;

    try {
      const meta = metadataRef.current;
      const { systemPrompt: latestPrompt, config: latestConfig } = reduxStateRef.current;
      
      let title = meta.title;
      // 如果还没有 title，且有 AI 的回复，则生成标题
      if (title === "新会话" || !title) {
        const firstAssistantMsg = msgs.find(m => m.role === "assistant");
        if (firstAssistantMsg) {
          title = firstAssistantMsg.content.slice(0, 20).replace(/\n/g, " ") + "...";
          setSessionTitle(title); // 更新本地状态
        }
      }

      const sessionToSave: ChatSession = {
        id: sessionId,
        systemPrompt: latestPrompt,
        config: latestConfig,
        messages: msgs,
        title: title || "新会话",
        createdAt: meta.createdAt || new Date().toLocaleString(),
        // 关键修复：如果是切换会话导致的保存，不更新 lastMessageAt，避免排序改变
        lastMessageAt: isSwitching ? (meta.createdAt) : new Date().toLocaleString(),
      };

      await invoke("save_session", { session: sessionToSave });
      
      // 只有在真正产生新消息时（非切换时）才刷新列表排序
      if (!isSwitching) {
        window.dispatchEvent(new CustomEvent("refresh-sessions"));
      }
    } catch (err) {
      console.error("持久化会话失败:", err);
    }
  };

  // 滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto"; // 重置高度
      ta.style.height = Math.min(ta.scrollHeight, 150) + "px"; // 最大高度150px
    }
  }, [input]);

    // 当 sessionId 改变时，从后端加载历史消息
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const session = await invoke<ChatSession>("get_session", { id: sessionId });
        if (session.messages && session.messages.length > 0 && !firstQuestion) {
          setMessages(session.messages);
          // 初始化本地元数据
          setSessionTitle(session.title);
          setSessionCreatedAt(session.createdAt);
          setSessionSystemPrompt(session.systemPrompt);
          
          dispatch(setSession(session));
          // 标记该会话已成功载入 Redux
          loadedSessionIdRef.current = sessionId;
        } else if (firstQuestion) {
          // 如果是新会话
          setSessionTitle("新会话");
          setSessionCreatedAt(new Date().toLocaleString());
          setSessionSystemPrompt(currentSystemPrompt);
          // 新会话默认已载入当前配置
          loadedSessionIdRef.current = sessionId;
        }
      } catch (err) {
        console.error("加载会话失败", err);
      }
    };
    fetchSessionData();
  }, [sessionId]);

  useEffect(() => {
    if (firstQuestion && sessionId) {
      // 检查是否已经存在该会话的消息，防止切换时重复触发
      if (messages.length === 0) {
        sendMessage(true, firstQuestion);
      }
    }
  }, [firstQuestion, sessionId]);

  const sendMessage = async (isFirst:boolean,messageContent?: string) => {
    const content = messageContent ?? input; 
    if (!content.trim()) return;

    if (provider === "local" && !hasLoaded) {
      toast("未载入本地模型");
      return;
    }

    if (provider === "third-party" && !apiKey) {
      toast("请先在「模型」或「设置」中配置 API Key");
      return;
    }

    const now = new Date().toLocaleString("zh-CN", { hour12: false });

    // 添加用户消息
    const userMsg: Message = { role: "user", content, time: now };
    const updatedMessagesWithUser = [...messages, userMsg];
    setMessages(updatedMessagesWithUser);

    if(!isFirst){
      dispatch(addMessage(userMsg));
      // 用户发送消息后立即持久化并更新排序
      saveCurrentSession(updatedMessagesWithUser);
      // 清除该会话的草稿
      dispatch(clearDraft(sessionId));
    }

    setInput("");
    setLoading(true);

    try {
      const fullMessages: Message[] = [
        { role: "system", content: sessionSystemPrompt || currentSystemPrompt },
        ...messages,
        userMsg
      ];

      const assistantMsg: Message = { role: "assistant", content: "", time: "生成中..." };
      setMessages((prev) => [...prev, assistantMsg]);

      let fullResponse = "";
      const stream = askModelStream(
        fullMessages, 
        provider, 
        apiKey, 
        provider === "local" ? selected?.name : modelName, 
        apiUrl,
        config
      );

      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { 
            ...assistantMsg, 
            content: fullResponse, 
            time: new Date().toLocaleString("zh-CN", { hour12: false }) 
          };
          return newMsgs;
        });
      }

      const finalAssistantMsg: Message = { 
        role: "assistant", 
        content: fullResponse, 
        time: new Date().toLocaleString("zh-CN", { hour12: false }) 
      };

      const finalMessages = [...messages, userMsg, finalAssistantMsg];
      dispatch(addMessage(finalAssistantMsg));
      
      // 流式结束，立即进行一次持久化
      await saveCurrentSession(finalMessages);

      // 如果是新会话，第一个回复结束后刷新侧边栏列表
      if (sessionTitle === "新会话" || !sessionTitle) {
        window.dispatchEvent(new CustomEvent("refresh-sessions"));
      }

    } catch (err: any) {
      const errorMsg = `出错了: ${err.message}`;
      const errorAssistantMsg = { 
        role: "assistant", 
        content: errorMsg, 
        time: new Date().toLocaleString("zh-CN", { hour12: false }) 
      };
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = errorAssistantMsg;
        return newMsgs;
      });
      dispatch(addMessage(errorAssistantMsg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 h-screen justify-center bg-gray-100 p-4 pt-12">
      <div className="flex flex-col flex-1 h-full w-full items-center justify-center">
        <div className="w-full max-w-2xl h-[500px] bg-white shadow rounded-lg p-4 overflow-y-auto flex flex-col flex-1 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* 气泡 */}
            <div
              className={`chat chat- ${
                msg.role === "user"
                  ? "start"
                  : "end"
              }`}
            >
                <div className="chat-header text-black">
                    {msg.role === "user"?"user":"assistant"}
                    <time className="text-xs opacity-50 ">{msg.time}</time>
                </div>
              <div  className={`chat-bubble ${
                    msg.role === "user"
                  ? "chat-bubble-primary"
                  : "chat-bubble-success"
                }`}
                >
                  {msg.role === "assistant" && msg.content === "" ? (
                    <span className="loading loading-dots loading-sm"></span>
                  ) : (
                    msg.content
                  )}
                </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <div className="w-full max-w-2xl flex mt-2 items-end">
      <textarea
        ref={textareaRef}
        rows={1} // 默认只有一行
        placeholder="请输入消息..."
        className="textarea textarea-bordered flex-1 bg-gray-300 text-gray-700 min-h-[40px] max-h-[80px] resize-none overflow-y-auto"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const canSend = provider === "third-party" ? !!apiKey : hasLoaded;
            if(!canSend){
              toast(provider === "third-party" ? "请输入 API Key" : "未载入模型")
              return;
            }
            if (!input.trim()){
              toast("未输入问题")
              return;
            }
            sendMessage(false);
          }
        }}
      />
        <button className={`btn ml-2 self-center ${
          !(provider === "third-party" ? !!apiKey : hasLoaded) || !input.trim()
            ? " btn-active btn-error" 
            : " btn-active btn-primary"
        }`}
        onClick={()=>{
          const canSend = provider === "third-party" ? !!apiKey : hasLoaded;
          if(!canSend){
            toast(provider === "third-party" ? "请输入 API Key" : "未载入模型")
            return;
          }
          if (!input.trim()){
            toast("未输入问题")
            return;
          }
          sendMessage(false);
        }}
        >
          发送
        </button>
        
      </div>
      </div>
    </div>
  );
}

