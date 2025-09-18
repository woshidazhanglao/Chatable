import Chat from "../components/Chat";
import ModelSelector from "../components/ModelSelector";
import PromptEditor from"../components/PromptEditor"
import MessageSider from "../components/MessageSider";
import Accordion, { AccordionHandle } from "../components/Accordion";
import StartChat from "../components/StartChat";
import { useState,useRef } from "react";
import axios from "axios";
import { useDispatch,useSelector } from "react-redux";
import { setSession } from "../store/chatSlice";
import { RootState } from "../store/store";

export default function ChatPage() {

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [startQuestion, setStartQuestion] = useState("");
  const [firstQuestion, setFirstQuestion] = useState(""); 
  const dispatch=useDispatch()
  const systemPrompt = useSelector((state: RootState) => state.chat.systemPrompt);

  const accordionRef = useRef<AccordionHandle>(null);

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
  };

  const handleStartChat = async () => {
    if (!startQuestion.trim()) return;

    try {
      const now = new Date().toLocaleString();

      const res = await axios.post(
        "http://localhost:8000/sessions",
        null, 
        {
          params: {
            content: startQuestion,
            time: now, 
            systemPrompt: systemPrompt,
          },
        }
      );

      const session = res.data.session;

      //把新会话存入 store（包含 systemPrompt 和 messages）
      dispatch(setSession(session));

      // 把开场问题传给 Chat
      setFirstQuestion(startQuestion);
      setStartQuestion(""); 

      accordionRef.current?.fetchSessions();

      setSelectedSessionId(session.id); // 切换到新会话

    } catch (err) {
      console.error(err);
      alert("创建会话失败");
    }
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
  <div className="flex h-screen space-x-4 mt-2">
    {selectedSessionId ? (
      <div className="flex-1 border-r flex">
        <Chat sessionId={selectedSessionId} firstQuestion={firstQuestion}  />
      </div>
  ) : (
      <div className="flex-1 border-r">
      <StartChat
      startQuestion={startQuestion}
      setStartQuestion={setStartQuestion}
      handleStartChat={handleStartChat}
      />
      </div>
  )}

      <div className="w-92 p-4 p-3">
        <ModelSelector />
        <PromptEditor />
      </div>
  </div>

</MessageSider>
  );
}