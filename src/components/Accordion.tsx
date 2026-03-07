// Accordion.tsx
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type ChatSession } from "../type/chat";

interface AccordionProps {
  onSelectSession: (sessionId: string) => void;
  selectedSessionId?: string;
}

export interface AccordionHandle {
  fetchSessions: () => void;
}

const Accordion = forwardRef<AccordionHandle, AccordionProps>(
  ({ onSelectSession, selectedSessionId }, ref) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);

    const fetchSessions = async () => {
      try {
        const data = await invoke<ChatSession[]>("get_sessions");
        setSessions(data);
      } catch (err) {
        console.error("获取会话列表失败:", err);
      }
    };

    useImperativeHandle(ref, () => ({
      fetchSessions,
    }));

    useEffect(() => {
      fetchSessions();

      // 监听全局刷新事件
      const handleRefresh = () => fetchSessions();
      window.addEventListener("refresh-sessions", handleRefresh);
      
      return () => {
        window.removeEventListener("refresh-sessions", handleRefresh);
      };
    }, []);

    return (
      <div className="join join-vertical bg-base-100">
        {sessions.map((session, idx) => (
          <div key={session.id} className="collapse collapse-arrow join-item border-base-300 border">
            <input
              type="radio"
              name="my-accordion-4"
              checked={selectedSessionId === session.id}
              onChange={() => onSelectSession(session.id)}
            />
            <div className="collapse-title font-semibold">
              {session.title || `会话 ${idx + 1}`}
            </div>
            <div className="collapse-content text-sm">
              {session.messages.length > 0
                ? session.messages[session.messages.length - 1].content
                : "暂无消息"}
            </div>
          </div>
        ))}
      </div>
    );
  }
);

export default Accordion;
