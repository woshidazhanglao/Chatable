import"../App.css"
import { useState, useRef, useEffect } from "react";
import { type Message } from "../type/chat";
import { useSelector,useDispatch } from "react-redux";
import { RootState } from "../store/store";
import { askModel } from "../utils/chat";
import axios from "axios";
import { toast } from "sonner"
import { addMessage } from "../store/chatSlice";

interface ChatProps {
  sessionId: string;
  firstQuestion?: string; // 新增
}

export default function Chat({ sessionId,firstQuestion }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loading,setLoading]=useState(false);
  const systemPrompt = useSelector(
    (state: RootState) => state.chat.systemPrompt
  );

  const hasLoaded = useSelector(
      (state: RootState) => state.model.hasLoaded
  );

  const dispatch=useDispatch()

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
    const fetchSession = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/sessions/${sessionId}`);
        const session = res.data;
        console.log(session)
        if (!session.error && session.messages && session.messages.length > 0&&!firstQuestion) {
          setMessages(session.messages);
        }
      } catch (err) {
        console.error("加载会话失败", err);
        //setMessages([]);
      }
    };
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
  if (firstQuestion) {
    console.log(66)
    sendMessage(true,firstQuestion);
  }
  }, [firstQuestion]);

  useEffect(()=>{
    console.log(messages)
  },[messages])

  const sendMessage = async (isFirst:boolean,messageContent?: string) => {
    const content = messageContent ?? input; // 如果传了参数就用参数，否则用输入框
    if (!content.trim()) return;

    const now = new Date().toLocaleString("zh-CN", { hour12: false });

    console.log(now)

    // 添加用户消息
    setMessages((prev) => [
      ...prev,
      { role: "user", content, time: now },
    ]);

    if(!isFirst){
      dispatch(addMessage({ role: "user", content, time: now }));
    }

    setInput("");
    setLoading(true);

    try {
      const {response,timestamp} = await askModel(content, systemPrompt,sessionId,isFirst,now);

      console.log(timestamp)
      // 添加助手消息
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response, time: timestamp },
      ]);
      dispatch(addMessage({ role: "assistant", content: response, time: timestamp }));

      //console.log(messages)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "出错了，请稍后再试", time: new Date().toLocaleString("zh-CN", { hour12: false }) },
      ]);
      dispatch(addMessage( { role: "assistant", content: "出错了，请稍后再试", time: new Date().toLocaleString("zh-CN", { hour12: false }) }));
    } finally {
      //console.log(messages)
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1  h-screen  justify-center h-screen bg-gray-100 p-4 ">
      
      <div className="p-2 border-b flex ">
        {/* 这个按钮就能打开侧边栏 */}
        <label htmlFor="left-drawer" className="btn btn-sm btn-primary">
          会话列表
        </label>
      </div>

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
                >{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="chat chat-start">
              <div className="chat-header text-black">
                assistant
              </div>
              <div className="chat-bubble chat-bubble-success">
                <span className="loading loading-dots loading-sm"></span>
              </div>
            </div>
          </div>
        )}
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
            if(!hasLoaded){
              toast("未载入模型")
            }
            if (!input.trim()){
              toast("未输入问题")
            }
            sendMessage(false);
          }
        }}
      />
        <button className={`btn ml-2 self-center ${
          !hasLoaded||!input.trim()
            ? " btn-active btn-error" 
            : " btn-active btn-primary"
        }`}
        onClick={()=>{
          if(!hasLoaded){
            toast("未载入模型")
          }
          if (!input.trim()){
            toast("未输入问题")
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

