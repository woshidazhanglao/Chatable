import Chat from "../components/Chat";
import ModelSelector from "../components/ModelSelector";
import PromptEditor from"../components/PromptEditor"
import MessageSider from "../components/MessageSider";
import Accordion, { AccordionHandle } from "../components/Accordion";
import StartChat from "../components/StartChat";
import { useState,useRef, useEffect } from "react";
import { useDispatch,useSelector } from "react-redux";
import { setSession } from "../store/chatSlice";
import { RootState } from "../store/store";
import { invoke } from "@tauri-apps/api/core";
import { type ChatSession } from "../type/chat";
import { setDraft, clearDraft, setLastSelectedSessionId } from "../store/uiSlice";

export default function ChatPage() {
  const { drafts, lastSelectedSessionId } = useSelector((state: RootState) => state.ui);
  const draft = drafts["startChat"] || "";
  const [selectedSessionId, setSelectedSessionId] = useState<string>(lastSelectedSessionId || "");
  const [startQuestion, setStartQuestion] = useState(draft);
  const [firstQuestion, setFirstQuestion] = useState(""); 
  const dispatch=useDispatch()
  const { systemPrompt, config } = useSelector((state: RootState) => state.chat);

  const accordionRef = useRef<AccordionHandle>(null);

  // 同步草稿到 Redux
  useEffect(() => {
    dispatch(setDraft({ key: "startChat", text: startQuestion }));
  }, [startQuestion, dispatch]);

  // 同步当前选择的会话到 Redux
  useEffect(() => {
    dispatch(setLastSelectedSessionId(selectedSessionId || null));
  }, [selectedSessionId, dispatch]);

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    setFirstQuestion(""); // 切换会话时清除开场问题，防止在新会话中触发
  };

  const handleNewSession = () => {
    setSelectedSessionId("");
    setFirstQuestion("");
  };

  const handleStartChat = async () => {
    if (!startQuestion.trim()) return;

    const now = new Date().toLocaleString();
    const sessionId = `session_${Date.now()}`;

    // 在内存中先创建会话，title 暂时用加载占位
    const newSession: ChatSession = {
      id: sessionId,
      systemPrompt,
      config,
      messages: [],
      title: "新会话",
      createdAt: now,
      lastMessageAt: now,
    };

    dispatch(setSession(newSession));
    setFirstQuestion(startQuestion);
    setStartQuestion("");
    // 清除开场问题的草稿
    dispatch(clearDraft("startChat"));
    setSelectedSessionId(sessionId);
    // 这里暂时不调用 invoke("save_session")，等 AI 第一个回复出来后再保存
  };
  

  return (
<MessageSider
  sidebar={
    <Accordion
      ref={accordionRef}
      selectedSessionId={selectedSessionId}
      onSelectSession={handleSelectSession}
    />
  }
>
  <div className="relative flex h-screen w-full overflow-hidden">
    {/* 浮动操作按钮组 */}
    <div className="absolute top-6 left-6 flex gap-3 z-10">
      <label 
        htmlFor="left-drawer" 
        className="btn btn-sm btn-primary shadow-lg hover:shadow-xl transition-all border-none"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        会话列表
      </label>
      <button 
        className="btn btn-sm bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-lg hover:shadow-xl transition-all"
        onClick={handleNewSession}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        新会话
      </button>
    </div>

    {selectedSessionId ? (
      <div className="flex-1 flex w-full h-full">
        <Chat key={selectedSessionId} sessionId={selectedSessionId} firstQuestion={firstQuestion}  />
      </div>
  ) : (
      <div className="flex-1 w-full h-full">
      <StartChat
      startQuestion={startQuestion}
      setStartQuestion={setStartQuestion}
      handleStartChat={handleStartChat}
      />
      </div>
  )}

   
      <div className="hidden lg:flex w-80 xl:w-96 flex-col border-l border-gray-100 p-4 overflow-hidden">
        <PromptEditor />
      </div>
  </div>

</MessageSider>
  );
}