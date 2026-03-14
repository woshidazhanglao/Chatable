// Accordion.tsx
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type ChatSession } from "../type/chat";
import { Trash2 } from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";

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

    const handleDeleteSession = async (e: React.MouseEvent, id: string, title: string) => {
      e.stopPropagation(); // 防止触发选择会话
      
      const confirmed = await ask(`确定要删除会话 "${title || '未命名'}" 吗？`, {
        title: '删除确认',
        kind: 'warning',
      });

      if (confirmed) {
        try {
          await invoke("delete_session", { id });
          await fetchSessions();
          // 如果删除的是当前选中的会话，通知父组件清空选择
          if (selectedSessionId === id) {
            onSelectSession("");
          }
        } catch (err) {
          console.error("删除会话失败:", err);
        }
      }
    };

    return (
      <div className="menu bg-base-100 p-0 w-full overflow-hidden rounded-lg">
        {sessions.map((session, idx) => (
          <div key={session.id} className="group collapse collapse-arrow border-b border-base-300 rounded-none last:border-b-0 relative">
            <input
              type="radio"
              name="my-accordion-4"
              checked={selectedSessionId === session.id}
              onChange={() => onSelectSession(session.id)}
            />
            <div className="collapse-title font-semibold pr-16 truncate flex items-center justify-between">
              <span className="truncate">{session.title || `会话 ${idx + 1}`}</span>
              <button 
                className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity absolute right-10 z-10"
                onClick={(e) => handleDeleteSession(e, session.id, session.title)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="collapse-content text-sm text-gray-500 line-clamp-2 overflow-hidden">
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
